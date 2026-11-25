# Backend núcleo Rol 2

La solución queda en `backend/` y usa .NET 11.0.100. El contrato conserva los nombres del modelo Angular (`code`, `category`, `location`, `description`, `state`, `created`, `history`, `priority`, `responsibleUnit`) y añade `version`. PostgreSQL usa una clave interna `id`; la API identifica reportes por el código público único, nunca interpreta los IDs locales de Angular como IDs de PostgreSQL. La adaptación del cliente debe hacerse mediante DTO/mapeo explícito cuando se conecte Angular; sus interfaces actuales no se modificaron.

## Requisitos comprobados en el equipo

- .NET SDK 11.0.100 y runtimes ASP.NET Core/.NET 10.0.15 y 11.0.0.
- Docker 29.9.3 y Docker Compose v5.7.0.
- Angular existente en raíz; no se encontró backend anterior.
- No se encontraron `AGENTS.md` ni `docs/DIAGNOSTICO_Y_PLAN_IMPLEMENTACION.md`.

## Base provisional aislada

`compose.rol2.yml` crea PostgreSQL 17 en `127.0.0.1:55432`, base `incidencias_rol2`, volumen dedicado `incidencias_rol2_pgdata` y usuario de desarrollo `rol2_app`. La contraseña local por defecto `rol2_dev_local` solo es de desarrollo. Para cambiarla, define `ROL2_DB_PASSWORD` antes de levantar Docker y `INCIDENCIAS_DB` para la API. No uses datos reales. No borres volúmenes existentes.

Desde la raíz del repositorio, PowerShell:

```powershell
docker compose -f compose.rol2.yml up -d
docker compose -f compose.rol2.yml ps
dotnet restore .\backend\Incidencias.Api\Incidencias.Api.csproj
dotnet build .\backend\Incidencias.Api\Incidencias.Api.csproj --no-restore
dotnet run --project .\backend\Incidencias.Api\Incidencias.Api.csproj --urls http://localhost:5080
```

La inicialización SQL de `db/provisional/001_schema.sql` corre solo cuando Docker crea por primera vez el volumen dedicado. Para una instancia provisional ya creada, aplica cambios SQL manualmente sobre esa instancia. No uses `down -v`.

Para preparar una cuenta técnica solo en esta base provisional, ejecuta `.\backend\scripts\Crear-Usuario-Prueba-Rol2.ps1` en otra ventana PowerShell. Pide la contraseña sin mostrarla y almacena únicamente PBKDF2-SHA256 con salt aleatorio. Usa Mantenimiento o Desarrollo Físico para probar cambios; el script de recorrido crea expedientes dentro y fuera de la unidad.

## Pruebas

En otra terminal:

```powershell
dotnet run --project .\backend\Incidencias.Domain.Tests\Incidencias.Domain.Tests.csproj
$env:ROL2_TEST_USER = 'usuario-de-prueba'
$env:ROL2_TEST_PASSWORD = Read-Host 'Contraseña de prueba'
$env:INCIDENCIAS_DB = 'Host=localhost;Port=55432;Database=incidencias_rol2;Username=rol2_app;Password=rol2_dev_local'
.\backend\scripts\Probar-Recorrido-Rol2.ps1
Remove-Item Env:ROL2_TEST_PASSWORD,Env:INCIDENCIAS_DB,Env:ROL2_TEST_USER
```

La primera orden cubre reglas, autorización por rol/área, estados, observación, prioridad, DTO público y seguimiento sin sesión. El script HTTP verifica registro, seguimiento anónimo, panel protegido, inicio/consulta/cierre de sesión, filtros, expediente dentro/fuera del ámbito (403), cambio de estado/prioridad y conflicto por versión obsoleta (409). Requiere una cuenta técnica provisional; el script `Crear-Usuario-Prueba-Rol2.ps1` prepara una en esta base aislada.

La prueba Angular existente es independiente:

```powershell
npm.cmd test -- --watch=false
npm.cmd run build
```

## Superficie HTTP

- `POST /api/sesiones`, `GET /api/sesiones/actual`, `DELETE /api/sesiones/actual`: inicio, consulta y cierre. Los permisos se recuperan de la cuenta activa y cada consulta extiende la actividad; 30 minutos sin actividad invalidan la sesión. El token crudo se entrega solo al iniciar y en PostgreSQL se conserva su SHA-256.
- `POST /api/incidencias`: registro público. Código aleatorio generado en servidor; descripción de 20 a 2000 caracteres.
- `GET /api/seguimiento/{code}`: seguimiento sin token, con estado e historial y sin campos de identidad.
- `GET /api/incidencias`: panel autenticado con `query`, `category`, `location`, `state`, `from`, `to`; la API limita resultados por rol/área.
- `GET /api/incidencias/{code}`: expediente de la unidad o área con permiso vigente.
- `PUT /api/incidencias/{code}`: cuerpo `{ "state", "priority", "note", "version" }`. Requiere observación de diez caracteres, permiso y versión actual. La escritura y el historial comparten transacción; versión obsoleta responde 409.

Los DTO usan camelCase de ASP.NET Core. El panel entrega `version` para concurrencia. El seguimiento público deliberadamente no entrega descripción, referencia, nombre del reportante, vínculo, responsable ni actor del historial; también sustituye las observaciones libres por textos genéricos para impedir que una nota revele datos personales.

## Integración del DDL definitivo

`Incidencias.Infrastructure/PostgresIncidentStore.cs` es el único adaptador SQL. Al recibir el DDL oficial, conserva contratos y reglas de `Domain`/`Application`, reemplaza las tablas/campos/joins del adaptador por las tablas oficiales y actualiza `db/provisional/001_schema.sql` únicamente si sigue siendo necesario para desarrollo. Configura la conexión definitiva por `INCIDENCIAS_DB`/ConnectionStrings fuera del repositorio. No reutilices ni migres el volumen provisional como base institucional sin un plan aprobado. Los IDs se traducen en las consultas del adaptador; el código Angular no se pasa como PK local.

## Límites conocidos

La base provisional parte sin cuentas y no incluye carga de imágenes. Un operador debe provisionar usuarios desde el proceso institucional con hash PBKDF2-SHA256, salt aleatorio de 16 bytes y 210 000 iteraciones; no se habilitó registro público de cuentas ni elevación de permisos. La regla de asignación técnica por categoría es provisional y debe sustituirse por unidad responsable oficial. La API no acepta origen Angular distinto de localhost hasta configurar `Cors:Origins`. Las pruebas HTTP autenticadas requieren usuario de prueba; el build y la restauración dependen de que NuGet permita descargar Npgsql.
