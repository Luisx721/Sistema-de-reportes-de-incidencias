import { test, expect, Page } from '@playwright/test';
async function login(page: Page, user: string, password = 'DemoUES2026!') {
  await page.goto('/login');
  await page.locator('#email').fill(user);
  await page.locator('#password').fill(password);
  await page.locator('button[type=submit]').click();
}
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
test('invitado registra consulta y descarga PDF sin exponer identidad', async ({ page }) => {
  await page.goto('/reporte');
  await page.locator('#send-report').click();
  await expect(page.locator('#category-error')).toBeVisible();
  const code = await report(page);
  expect(code).toMatch(/^[A-Z0-9]{8,}$/);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Descargar comprobante PDF' }).click();
  expect((await download).suggestedFilename()).toBe(code + '.pdf');
  await page.goto('/seguimiento?codigo=' + code);
  await expect(
    page.getByText('Luminaria averiada en la entrada principal de la biblioteca'),
  ).toBeVisible();
});
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
  await page.goto('/admin');
  await expect(page).toHaveURL(/login/);
});
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
    await page.goto('/admin');
    await expect(page).toHaveURL(/panel/);
    if (['Jefatura', 'Ordenanza'].includes(role)) {
      await expect(page.locator('h1')).toHaveText('Reportes de mi área');
      await expect(page.locator('.report-card')).toHaveCount(role === 'Jefatura' ? 3 : 2);
    }
    if (['Autoridad', 'Desarrollo Físico'].includes(role)) {
      await page.getByRole('button', { name: 'Informes y exportación' }).click();
      const download = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Descargar CSV' }).click();
      expect((await download).suggestedFilename()).toBe('incidencias.csv');
    }
    if (role === 'Autoridad') {
      await page.getByRole('button', { name: 'Bandeja de incidencias' }).click();
      await page.getByRole('button', { name: 'Abrir expediente' }).first().click();
      await expect(page.getByRole('button', { name: 'Guardar cambio' })).toHaveCount(0);
    }
  });
}
test('atencion persiste estado observacion y seguimiento publico', async ({ page }) => {
  const code = await report(page);
  await login(page, 'mauricio.fuentes');
  await expect(page.locator('.report-card').filter({ hasText: code })).toBeVisible();
  await page
    .locator('.report-card')
    .filter({ hasText: code })
    .getByRole('button', { name: 'Abrir expediente' })
    .click();
  await page.locator('[name=nextState]').selectOption('En proceso');
  await page.locator('[name=note]').fill('Inspección técnica realizada en el sitio');
  await page.getByRole('button', { name: 'Guardar cambio' }).click();
  await expect(page.getByText('Cambio guardado con historial.', { exact: false })).toBeVisible();
  await page.reload();
  await expect(page.locator('.report-card').filter({ hasText: code })).toContainText('En proceso');
  await page.goto('/seguimiento?codigo=' + code);
  await expect(page.getByText('Inspección técnica realizada en el sitio')).toBeVisible();
});
test('catalogos administrativos alimentan formulario y persisten', async ({ page }) => {
  await login(page, 'carlos.menjivar');
  await expect(page).toHaveURL(/admin/);
  await page.locator('#tab-catalogos-btn').click();
  await page.locator('#btn-new-catalog-item').click();
  await page.locator('#catalog-name').fill('Equipamiento de prueba');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await page.reload();
  await page.goto('/reporte');
  await expect(
    page.locator('#category option').filter({ hasText: 'Equipamiento de prueba' }),
  ).toHaveCount(1);
});
test('respaldo completo puede restaurarse y archivo invalido se rechaza', async ({ page }) => {
  await report(page);
  await login(page, 'carlos.menjivar');
  await page.locator('#tab-respaldo-btn').click();
  const download = page.waitForEvent('download');
  await page.locator('#btn-generate-backup').click();
  const file = await download;
  await file.saveAs(test.info().outputPath('backup.json'));
  await page.locator('input[type=file]').setInputFiles({
    name: 'invalid.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{}'),
  });
  await page.getByRole('button', { name: 'Confirmar reemplazo desde archivo' }).click();
  await expect(page.getByText('Formato de respaldo no valido')).toBeVisible();
  await page.locator('input[type=file]').setInputFiles(test.info().outputPath('backup.json'));
  await page.getByRole('button', { name: 'Confirmar reemplazo desde archivo' }).click();
  await expect(page).toHaveURL(/login/);
});
for (const width of [360, 768, 1920])
  test('navegacion y panel sin desbordamiento a ' + width, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await login(page, 'mauricio.fuentes');
    await expect(page.locator('.report-card').first()).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });
test('registro comunitario no concede permisos por vinculo y conserva mis reportes', async ({
  page,
}) => {
  await page.goto('/registro');
  await page.locator('#fullName').fill('Persona de prueba');
  await page.locator('#email').fill('prueba@example.test');
  await page.locator('#universityRole').selectOption('jefatura');
  await page.locator('#password').fill('SoloPrueba2026!');
  await page.locator('#confirmPassword').fill('SoloPrueba2026!');
  await page.locator('button[type=submit]').click();
  await expect(page).toHaveURL(/\/$/);
  const code = await report(page);
  await page.goto('/panel');
  await expect(page.locator('h1')).toHaveText('Mis reportes');
  await expect(page.locator('.report-card')).toHaveCount(1);
  await expect(page.locator('.report-card')).toContainText(code);
  await page.getByRole('button', { name: 'Salir', exact: true }).click();
  await login(page, 'prueba@example.test', 'SoloPrueba2026!');
  await expect(page).toHaveURL(/panel/);
  await expect(page.locator('.report-card')).toHaveCount(1);
});
test('validacion de fotografias y limpieza del formulario', async ({ page }) => {
  await page.goto('/reporte');
  await page
    .locator('#photos')
    .setInputFiles({ name: 'no.txt', mimeType: 'text/plain', buffer: Buffer.from('no es imagen') });
  await expect(page.locator('#photo-error')).toContainText('solo JPG y PNG');
  await page.locator('#description').fill('Texto de prueba para comprobar limpieza');
  await page.getByRole('button', { name: 'Limpiar', exact: false }).click();
  await expect(page.locator('#description')).toHaveValue('');
});
test('crear desactivar y reactivar cuentas de prueba', async ({ page }) => {
  await login(page, 'carlos.menjivar');
  await page.locator('#btn-new-account').click();
  await page.getByRole('button', { name: 'Guardar cuenta' }).click();
  await expect(page.getByText('Ingresa el nombre completo.')).toBeVisible();
  await page.locator('#account-name').fill('Tecnico de prueba');
  await page.locator('#account-username').fill('tecnico.prueba');
  await page.locator('#account-role').selectOption('Mantenimiento');
  await page.locator('#account-area').fill('Servicios Generales');
  await page.getByRole('button', { name: 'Guardar cuenta' }).click();
  const row = page.locator('tr').filter({ hasText: 'tecnico.prueba' });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'Desactivar', exact: true }).click();
  await page
    .locator('dialog')
    .getByRole('button', { name: 'Desactivar cuenta', exact: true })
    .click();
  await expect(row).toContainText('Desactivada');
  await row.getByRole('button', { name: 'Reactivar', exact: true }).click();
  await page.getByRole('button', { name: 'Salir', exact: true }).click();
  await login(page, 'tecnico.prueba');
  await expect(page).toHaveURL(/panel/);
});
test('mi area registra un caso asistido y los filtros se limpian', async ({ page }) => {
  await login(page, 'sonia.rivas');
  await page.goto('/reporte');
  await page.getByRole('checkbox').check();
  await page.locator('#category').selectOption('Electricidad');
  await page.locator('#location').selectOption('biblioteca');
  await page.locator('#description').fill('Reporte asistido para mantenimiento de luminarias');
  await page.locator('#send-report').click();
  await expect(page).toHaveURL(/confirmacion/);
  const code = new URL(page.url()).searchParams.get('codigo')!;
  await page.goto('/panel');
  await page.getByLabel('Buscar código o descripción').fill(code);
  await expect(page.locator('.report-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'Limpiar filtros' }).click();
  await expect(page.locator('.report-card')).toHaveCount(4);
});
test('rechaza rangos de fechas invertidos y permite recuperar resultados', async ({ page }) => {
  await login(page, 'walter.orellana');
  await page.getByRole('button', { name: 'Informes y exportación' }).click();
  await page.getByLabel('Desde', { exact: true }).fill('2026-11-30');
  await page.getByLabel('Hasta', { exact: true }).fill('2026-11-01');
  await expect(page.getByRole('alert')).toContainText('fecha inicial');
  await expect(page.getByRole('button', { name: 'Descargar CSV' })).toBeDisabled();
  await page.getByRole('button', { name: 'Limpiar filtros' }).click();
  await expect(page.getByRole('button', { name: 'Descargar CSV' })).toBeEnabled();
});
test('perfil reportante de prueba inicia sin permisos internos', async ({ page }) => {
  await login(page, 'reportante@demo.ues');
  await expect(page).toHaveURL(/panel/);
  await expect(page.locator('h1')).toHaveText('Mis reportes');
  await page.goto('/admin');
  await expect(page).toHaveURL(/panel/);
});
test('listado publico alterna mapa y lista y limpia filtros', async ({ page }) => {
  await page.goto('/incidencias');
  await page.locator('#filter-category').selectOption('Electricidad');
  await page.locator('#map-view').click();
  await expect(page.locator('.leaflet-container')).toBeVisible();
  await page.locator('#list-view').click();
  await page.locator('#clear-filters').click();
  await expect(page.locator('#filter-category')).toHaveValue('');
});
test('catalogo se edita desactiva y reactiva sin eliminar referencias', async ({ page }) => {
  await login(page, 'carlos.menjivar');
  await page.locator('#tab-catalogos-btn').click();
  let row = page.locator('#catalog-table-container tr').filter({ hasText: 'Electricidad' });
  await row.getByRole('button', { name: 'Editar', exact: true }).click();
  await page.locator('#catalog-name').fill('Electricidad revisada');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  row = page.locator('#catalog-table-container tr').filter({ hasText: 'Electricidad revisada' });
  await row.getByRole('button', { name: 'Desactivar', exact: true }).click();
  await page.locator('dialog').getByRole('button', { name: 'Desactivar elemento', exact: true }).click();
  await expect(row.getByRole('button', { name: 'Reactivar' })).toBeVisible();
  await row.getByRole('button', { name: 'Reactivar' }).click();
  await page.goto('/reporte');
  await expect(
    page.locator('#category option').filter({ hasText: 'Electricidad revisada' }),
  ).toHaveCount(1);
});
