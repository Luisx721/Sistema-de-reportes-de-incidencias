# Interfaz Angular por roles

## Referencias y alcance

Referencia principal: `origin/main` en `3bcdd6f`, documento `documentacion/Documentacion de sistema incidencias.docx.pdf`, requisitos de las páginas 16 a 20 y decisiones de las páginas 40 y 41. Se consultaron también el documento PPI, el diccionario de base de datos y la guía anterior de ajustes de interfaces. El prototipo HTML de `incidencias` se conserva como referencia histórica; Angular es la aplicación que se ejecuta.

Esta entrega conecta las interfaces como demostración local. No implementa todavía la API ASP.NET Core ni PostgreSQL 17 en Docker. Esos componentes siguen siendo necesarios para completar los requisitos de persistencia relacional, seguridad y despliegue de PPI. Los guards del navegador y la contraseña de demostración no constituyen autorización de servidor.

## Capas

- `src/app/domain`: modelos y reglas puras de competencia, visibilidad y transiciones.
- `src/app/application`: servicios de cuentas, sesión, incidencias, documentos y respaldo; guards de navegación.
- `src/app/infrastructure`: adaptadores de IndexedDB y localStorage. La API C# reemplazará estos adaptadores.
- `src/app/presentation/features`: vistas por funcionalidad. Los componentes contienen estado y coordinación; HTML contiene plantillas y CSS estilos.
- `src/app/presentation/shared`: encabezado, pie, estados y notificaciones comunes.

No se utilizan variables globales mutables compartidas entre pantallas. Los servicios inyectables mantienen el estado común. Los componentes separan dependencias, estado, validaciones y procesos mediante comentarios de texto sin adornos.

## Recorridos

- Invitado: inicio, ayuda, reporte con fotos opcionales, código, comprobante PDF y seguimiento.
- Reportante autenticado: mismo portal y Mis reportes asociados a su identificador, sin apropiarse de reportes anónimos anteriores.
- Jefatura y Ordenanza habilitada: Mi área y registro asistido mediante una selección explícita en el formulario. Declarar un vínculo en el registro público no concede estos permisos.
- Mantenimiento y Desarrollo Físico: bandeja compartida con filtros, expediente, fotos, prioridad y actualización con observación mínima de diez caracteres. Estado e historial se guardan en la misma transacción de IndexedDB.
- Desarrollo Físico y Autoridad: informe por fecha de registro, cinco estados, porcentajes, recurrencia por categoría y ubicación y CSV compatible con hojas de cálculo.
- Administrador: cuentas, categorías, ubicaciones, respaldo completo y restauración desde archivo. Reiniciar cuentas y catálogos conserva los reportes y es una acción diferente de restaurar un respaldo.

## Decisiones provisionales

D-01 sigue abierto. Para ejercitar ambos perfiles técnicos, la demostración asocia Edificios y Espacios comunes con Desarrollo Físico y el resto con Mantenimiento. No representa una aprobación institucional ni una asignación registrada por un coordinador. Administrador no recibe edición técnica universal.

D-02 sigue abierto. Las cuentas internas de Ordenanza de ejemplo están habilitadas para su área. Un invitado con vínculo Ordenanza continúa siendo reportante público.

D-03 usa las transiciones conservadoras del documento y del prototipo anterior. Recibido permite En proceso o Rechazado/Cerrado. En proceso permite En espera o Resuelto. En espera permite En proceso. Los estados finales no se reabren. La espera directa desde Recibido no se habilita.

D-05 exporta un resumen por incidencia filtrado por fecha de registro, no todos los eventos. D-06 genera un archivo PDF local tamaño carta con campos para firma y sello, sin afirmar que exista firma institucional. D-07 conserva el mapa de demostración; no convierte esa función en requisito aprobado. D-04 no se ha validado con carga de cincuenta usuarios concurrentes.

## Credenciales ficticias

Contraseña compartida de las cuentas internas de prueba: `DemoUES2026!`. Las cuentas nuevas creadas por Administración también usan esa contraseña en esta demostración.

| Perfil | Usuario |
| --- | --- |
| Administrador | carlos.menjivar |
| Jefatura | sonia.rivas |
| Ordenanza | rosa.melgar |
| Mantenimiento | mauricio.fuentes |
| Desarrollo Físico | elena.castillo |
| Autoridad | walter.orellana |
| Reportante | reportante@demo.ues |

`jorge.bonilla` está desactivado para probar el rechazo del inicio de sesión. El registro público crea exclusivamente cuentas Reportante y conserva una huella de la contraseña en almacenamiento local. Utilizar únicamente datos y contraseñas ficticios. El backend deberá sustituir este mecanismo por autenticación y almacenamiento seguros en servidor.

## Ejecución y pruebas

Node 24 a partir de 24.15 y npm 11.

```sh
npm ci
npm start
npm run build
npm test -- --watch=false
```

Pruebas de navegador reproducibles:

```sh
npx playwright install chromium
npm run test:e2e
```

Playwright inicia su propio servidor en el puerto 4202. En Linux se puede usar Chromium ya instalado con `CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e`. Las pruebas crean contextos aislados y no modifican los datos del navegador habitual del usuario.

Las pruebas cubren registro, consulta, PDF, cuentas incorrectas y desactivadas, roles, restricciones de área, actualización de estados, persistencia, catálogos, CSV, respaldo y restauración y anchuras de pantalla de 360, 768 y 1920 píxeles. No sustituyen una auditoría de seguridad, prueba de carga o validación de reglas institucionales.

## Integración posterior

Conservar Angular como cliente de una API HTTPS en C#. Los permisos, transiciones, validación de archivos, unicidad de códigos y transacciones deberán verificarse también en la API. PostgreSQL 17 almacenará cuentas, áreas, catálogos, incidencias e historial; las fotos requieren almacenamiento persistente. No conectar PostgreSQL directamente al navegador. El diccionario permite prioridad nula hasta la evaluación y reportes comunitarios sin área solicitante.
