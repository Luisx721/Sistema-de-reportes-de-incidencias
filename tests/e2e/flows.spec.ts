import { test, expect, Page } from '@playwright/test';

// Pruebas de extremo a extremo (e2e): Playwright abre el navegador
// y usa el sistema como lo haria una persona real.

// Esta suite E2E usa exclusivamente demo local; no necesita la API Rol 2 ni PostgreSQL.
// Antes de cada prueba se activa el modo demo, que guarda los datos en el navegador.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('ues-api-mode', 'demo'));
});

// Funcion auxiliar: inicia sesion con un usuario de prueba.
// La contrasena por defecto es la de las cuentas de demostracion.
async function login(page: Page, user: string, password = 'DemoUES2026!') {
  await page.goto('/login');
  await page.locator('#email').fill(user);
  await page.locator('#password').fill(password);
  await page.locator('button[type=submit]').click();
}

// Funcion auxiliar: llena y envia un reporte valido.
// Devuelve el codigo de seguimiento que aparece en la confirmacion.
async function report(page: Page) {
  await page.goto('/reporte');
  await page.locator('#category').selectOption('Electricidad');
  await page.locator('#location').selectOption('biblioteca');
  await page
    .locator('#description')
    .fill('Luminaria averiada en la entrada principal de la biblioteca');
  await page.locator('#send-report').click();
  await expect(page).toHaveURL(/confirmacion/);
  return new URL(page.url()).searchParams.get('codigo')!;
}

// Prueba 1: flujo completo de una persona invitada (sin cuenta)
test('invitado registra consulta y descarga PDF sin exponer identidad', async ({ page }) => {
  // Enviar el formulario vacio debe mostrar el error de categoria
  await page.goto('/reporte');
  await page.locator('#send-report').click();
  await expect(page.locator('#category-error')).toBeVisible();

  // Enviar un reporte valido y comprobar el formato del codigo
  const code = await report(page);
  expect(code).toMatch(/^[A-Z0-9]{8,}$/);

  // Descargar el comprobante en PDF, nombrado con el codigo
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Descargar comprobante PDF' }).click();
  expect((await download).suggestedFilename()).toBe(code + '.pdf');

  // Consultar el seguimiento publico con el codigo
  await page.goto('/seguimiento?codigo=' + code);
  await expect(
    page.getByText('Luminaria averiada en la entrada principal de la biblioteca'),
  ).toBeVisible();
});

// Prueba 2: acceso rechazado con contrasena incorrecta o cuenta desactivada
test('credenciales incorrectas y cuenta inactiva no acceden', async ({ page }) => {
  for (const [user, password] of [
    ['mauricio.fuentes', 'incorrecta'],
    ['jorge.bonilla', 'DemoUES2026!'],
  ]) {
    await login(page, user, password);
    await expect(
      page.getByText('Usuario o contraseña incorrectos o cuenta desactivada.'),
    ).toBeVisible();
    await expect(page).toHaveURL(/login/);
  }

  // Sin sesion, la pagina de administracion redirige al login
  await page.goto('/admin');
  await expect(page).toHaveURL(/login/);
});

// Prueba 3: se repite una vez por cada perfil interno.
// Comprueba que cada rol entra al panel y ve solo lo que le corresponde.
for (const [user, role] of [
  ['sonia.rivas', 'Jefatura'],
  ['rosa.melgar', 'Ordenanza'],
  ['mauricio.fuentes', 'Mantenimiento'],
  ['elena.castillo', 'Desarrollo Físico'],
  ['walter.orellana', 'Autoridad'],
]) {
  test('acceso y permisos de ' + role, async ({ page }) => {
    await login(page, user);
    await expect(page).toHaveURL(/panel/);
    await expect(page.locator('.report-card').first()).toBeVisible();

    // Ningun perfil de estos puede entrar a /admin: vuelve al panel
    await page.goto('/admin');
    await expect(page).toHaveURL(/panel/);

    // Jefatura y Ordenanza solo ven los reportes de su area
    if (['Jefatura', 'Ordenanza'].includes(role)) {
      await expect(page.locator('h1')).toHaveText('Reportes de mi área');
      await expect(page.locator('.report-card')).toHaveCount(role === 'Jefatura' ? 3 : 2);
    }

    // Autoridad y Desarrollo Fisico pueden exportar el CSV
    if (['Autoridad', 'Desarrollo Físico'].includes(role)) {
      await page.getByRole('button', { name: 'Informes y exportación' }).click();
      const download = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Descargar CSV' }).click();
      expect((await download).suggestedFilename()).toBe('incidencias.csv');
    }

    // Autoridad solo consulta: no debe poder guardar cambios
    if (role === 'Autoridad') {
      await page.getByRole('button', { name: 'Bandeja de incidencias' }).click();
      await page.getByRole('button', { name: 'Abrir expediente' }).first().click();
      await expect(page.getByRole('button', { name: 'Guardar cambio' })).toHaveCount(0);
    }
  });
}

// Prueba 4: el personal cambia el estado de un reporte y el cambio se conserva
test('atencion persiste estado observacion y seguimiento publico', async ({ page }) => {
  const code = await report(page);

  // Mantenimiento busca el reporte recien creado y abre su expediente
  await login(page, 'mauricio.fuentes');
  await expect(page.locator('.report-card').filter({ hasText: code })).toBeVisible();
  await page
    .locator('.report-card')
    .filter({ hasText: code })
    .getByRole('button', { name: 'Abrir expediente' })
    .click();

  // Cambia el estado y agrega una observacion
  await page.locator('[name=nextState]').selectOption('En proceso');
  await page.locator('[name=note]').fill('Inspección técnica realizada en el sitio');
  await page.getByRole('button', { name: 'Guardar cambio' }).click();
  await expect(page.getByText('Cambio guardado con historial.', { exact: false })).toBeVisible();

  // Al recargar, el estado sigue guardado
  await page.reload();
  await expect(page.locator('.report-card').filter({ hasText: code })).toContainText('En proceso');

  // La observacion tambien aparece en el seguimiento publico
  await page.goto('/seguimiento?codigo=' + code);
  await expect(page.getByText('Inspección técnica realizada en el sitio')).toBeVisible();
});

// Prueba 5: un elemento nuevo del catalogo aparece en el formulario de reporte
test('catalogos administrativos alimentan formulario y persisten', async ({ page }) => {
  await login(page, 'carlos.menjivar');
  await expect(page).toHaveURL(/admin/);

  // Crear una categoria nueva en la pestana de catalogos
  await page.locator('#tab-catalogos-btn').click();
  await page.locator('#btn-new-catalog-item').click();
  await page.locator('#catalog-name').fill('Equipamiento de prueba');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();

  // Despues de recargar, la categoria sigue en el formulario de reporte
  await page.reload();
  await page.goto('/reporte');
  await expect(
    page.locator('#category option').filter({ hasText: 'Equipamiento de prueba' }),
  ).toHaveCount(1);
});

// Prueba 6: respaldo completo, restauracion y rechazo de archivos invalidos
test('respaldo completo puede restaurarse y archivo invalido se rechaza', async ({ page }) => {
  await report(page);
  await login(page, 'carlos.menjivar');
  await page.locator('#tab-respaldo-btn').click();

  // Generar y guardar el respaldo
  const download = page.waitForEvent('download');
  await page.locator('#btn-generate-backup').click();
  const file = await download;
  await file.saveAs(test.info().outputPath('backup.json'));

  // Un archivo con formato incorrecto debe ser rechazado
  await page.locator('input[type=file]').setInputFiles({
    name: 'invalid.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{}'),
  });
  await page.getByRole('button', { name: 'Confirmar reemplazo desde archivo' }).click();
  await expect(page.getByText('Formato de respaldo no valido')).toBeVisible();

  // El respaldo real si se acepta y la sesion se cierra
  await page.locator('input[type=file]').setInputFiles(test.info().outputPath('backup.json'));
  await page.getByRole('button', { name: 'Confirmar reemplazo desde archivo' }).click();
  await expect(page).toHaveURL(/login/);
});

// Prueba 7: diseño responsive. Se repite con tres anchos de pantalla
// (celular, tableta y escritorio) y revisa que no haya scroll horizontal.
for (const width of [360, 768, 1920])
  test('navegacion y panel sin desbordamiento a ' + width, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await login(page, 'mauricio.fuentes');
    await expect(page.locator('.report-card').first()).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });

// Prueba 8: una cuenta nueva no obtiene permisos internos aunque elija "jefatura"
test('registro comunitario no concede permisos por vinculo y conserva mis reportes', async ({
  page,
}) => {
  // Registrar una cuenta comunitaria
  await page.goto('/registro');
  await page.locator('#fullName').fill('Persona de prueba');
  await page.locator('#email').fill('prueba@example.test');
  await page.locator('#universityRole').selectOption('jefatura');
  await page.locator('#password').fill('SoloPrueba2026!');
  await page.locator('#confirmPassword').fill('SoloPrueba2026!');
  await page.locator('button[type=submit]').click();
  await expect(page).toHaveURL(/\/$/);

  // Enviar un reporte y comprobar que aparece en "Mis reportes"
  const code = await report(page);
  await page.goto('/panel');
  await expect(page.locator('h1')).toHaveText('Mis reportes');
  await expect(page.locator('.report-card')).toHaveCount(1);
  await expect(page.locator('.report-card')).toContainText(code);

  // Cerrar sesion y volver a entrar: el reporte se conserva
  await page.getByRole('button', { name: 'Salir', exact: true }).click();
  await login(page, 'prueba@example.test', 'SoloPrueba2026!');
  await expect(page).toHaveURL(/panel/);
  await expect(page.locator('.report-card')).toHaveCount(1);
});

// Prueba 9: validacion de fotografias y boton para limpiar el formulario
test('validacion de fotografias y limpieza del formulario', async ({ page }) => {
  await page.goto('/reporte');

  // Un archivo que no es imagen debe ser rechazado
  await page
    .locator('#photos')
    .setInputFiles({ name: 'no.txt', mimeType: 'text/plain', buffer: Buffer.from('no es imagen') });
  await expect(page.locator('#photo-error')).toContainText('solo JPG y PNG');

  // El boton Limpiar vacia los campos
  await page.locator('#description').fill('Texto de prueba para comprobar limpieza');
  await page.getByRole('button', { name: 'Limpiar', exact: false }).click();
  await expect(page.locator('#description')).toHaveValue('');
});

// Prueba 10: el administrador crea, desactiva y reactiva una cuenta
test('crear desactivar y reactivar cuentas de prueba', async ({ page }) => {
  await login(page, 'carlos.menjivar');
  await page.locator('#btn-new-account').click();

  // Guardar sin nombre debe mostrar el error
  await page.getByRole('button', { name: 'Guardar cuenta' }).click();
  await expect(page.getByText('Ingresa el nombre completo.')).toBeVisible();

  // Llenar los datos y crear la cuenta
  await page.locator('#account-name').fill('Tecnico de prueba');
  await page.locator('#account-username').fill('tecnico.prueba');
  await page.locator('#account-role').selectOption('Mantenimiento');
  await page.locator('#account-area').fill('Servicios Generales');
  await page.getByRole('button', { name: 'Guardar cuenta' }).click();
  const row = page.locator('tr').filter({ hasText: 'tecnico.prueba' });
  await expect(row).toBeVisible();

  // Desactivar la cuenta (pide confirmacion en un dialogo)
  await row.getByRole('button', { name: 'Desactivar', exact: true }).click();
  await page
    .locator('dialog')
    .getByRole('button', { name: 'Desactivar cuenta', exact: true })
    .click();
  await expect(row).toContainText('Desactivada');

  // Reactivarla y comprobar que ya puede iniciar sesion
  await row.getByRole('button', { name: 'Reactivar', exact: true }).click();
  await page.getByRole('button', { name: 'Salir', exact: true }).click();
  await login(page, 'tecnico.prueba');
  await expect(page).toHaveURL(/panel/);
});

// Prueba 11: caso asistido desde una jefatura y limpieza de filtros del panel
test('mi area registra un caso asistido y los filtros se limpian', async ({ page }) => {
  await login(page, 'sonia.rivas');

  // Enviar un reporte marcando la casilla de caso asistido
  await page.goto('/reporte');
  await page.getByRole('checkbox').check();
  await page.locator('#category').selectOption('Electricidad');
  await page.locator('#location').selectOption('biblioteca');
  await page.locator('#description').fill('Reporte asistido para mantenimiento de luminarias');
  await page.locator('#send-report').click();
  await expect(page).toHaveURL(/confirmacion/);
  const code = new URL(page.url()).searchParams.get('codigo')!;

  // Buscar por codigo deja una sola tarjeta
  await page.goto('/panel');
  await page.getByLabel('Buscar código o descripción').fill(code);
  await expect(page.locator('.report-card')).toHaveCount(1);

  // Limpiar filtros muestra todas las tarjetas otra vez
  await page.getByRole('button', { name: 'Limpiar filtros' }).click();
  await expect(page.locator('.report-card')).toHaveCount(4);
});

// Prueba 12: no se permite un rango de fechas invertido
test('rechaza rangos de fechas invertidos y permite recuperar resultados', async ({ page }) => {
  await login(page, 'walter.orellana');
  await page.getByRole('button', { name: 'Informes y exportación' }).click();

  // Fecha inicial posterior a la final: aparece alerta y se bloquea la descarga
  await page.getByLabel('Desde', { exact: true }).fill('2026-11-30');
  await page.getByLabel('Hasta', { exact: true }).fill('2026-11-01');
  await expect(page.getByRole('alert')).toContainText('fecha inicial');
  await expect(page.getByRole('button', { name: 'Descargar CSV' })).toBeDisabled();

  // Al limpiar los filtros, la descarga vuelve a estar disponible
  await page.getByRole('button', { name: 'Limpiar filtros' }).click();
  await expect(page.getByRole('button', { name: 'Descargar CSV' })).toBeEnabled();
});

// Prueba 13: el perfil de reportante no tiene permisos internos
test('perfil reportante de prueba inicia sin permisos internos', async ({ page }) => {
  await login(page, 'reportante@demo.ues');
  await expect(page).toHaveURL(/panel/);
  await expect(page.locator('h1')).toHaveText('Mis reportes');

  // Intentar entrar a /admin lo devuelve al panel
  await page.goto('/admin');
  await expect(page).toHaveURL(/panel/);
});

// Prueba 14: listado publico, cambio entre lista y mapa, y limpieza de filtros
test('listado publico alterna mapa y lista y limpia filtros', async ({ page }) => {
  await page.goto('/incidencias');
  await page.locator('#filter-category').selectOption('Electricidad');

  // Cambiar a la vista de mapa (Leaflet) y volver a la lista
  await page.locator('#map-view').click();
  await expect(page.locator('.leaflet-container')).toBeVisible();
  await page.locator('#list-view').click();

  // Limpiar filtros deja la categoria en blanco
  await page.locator('#clear-filters').click();
  await expect(page.locator('#filter-category')).toHaveValue('');
});

// Prueba 15: editar, desactivar y reactivar un elemento del catalogo
test('catalogo se edita desactiva y reactiva sin eliminar referencias', async ({ page }) => {
  await login(page, 'carlos.menjivar');
  await page.locator('#tab-catalogos-btn').click();

  // Editar el nombre de la categoria Electricidad
  let row = page.locator('#catalog-table-container tr').filter({ hasText: 'Electricidad' });
  await row.getByRole('button', { name: 'Editar', exact: true }).click();
  await page.locator('#catalog-name').fill('Electricidad revisada');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();

  // Desactivarla (con confirmacion) y luego reactivarla
  row = page.locator('#catalog-table-container tr').filter({ hasText: 'Electricidad revisada' });
  await row.getByRole('button', { name: 'Desactivar', exact: true }).click();
  await page.locator('dialog').getByRole('button', { name: 'Desactivar elemento', exact: true }).click();
  await expect(row.getByRole('button', { name: 'Reactivar' })).toBeVisible();
  await row.getByRole('button', { name: 'Reactivar' }).click();

  // La categoria vuelve a aparecer en el formulario de reporte
  await page.goto('/reporte');
  await expect(
    page.locator('#category option').filter({ hasText: 'Electricidad revisada' }),
  ).toHaveCount(1);
});