# Backend núcleo del Rol 2

La API del sistema está en `backend/Incidencias.Api/`. Usa .NET 10 y PostgreSQL 17. En el entorno local del proyecto, PostgreSQL utiliza la base `midb` y se expone en el puerto `5440`. Angular consume la API mediante `HttpClient`.

## Preparar una base local de pruebas

Desde la raíz del repositorio, levantá PostgreSQL:

```powershell
docker compose -f .\ProyectoBD\docker-compose.yml up -d
```

Al crear un volumen nuevo, PostgreSQL ejecuta los archivos de `ProyectoBD/sql-init/`. Para completar una base nueva, aplicá los scripts de `db/official/` en este orden:

1. `002_rol2_sessions.sql` y `003_rol2_versions.sql` crean el soporte de sesiones y versiones.
2. Para preparar la cuenta técnica de desarrollo, ejecutá `.\db\official\solicitar-clave.ps1` desde la raíz. El script pide la contraseña y aplica `004_dev_seed.sql`.
3. `005_dev_catalogs.sql` carga los catálogos opcionales de desarrollo.
4. `006_views.sql` crea `VW_Listado_incidencias`, que utiliza el panel.
5. `007_schema_alignment.sql`, `008_codigo_seguimiento.sql` y `009_control_respaldo.sql` completan los ajustes del esquema, del código de seguimiento y del control de respaldo.

Si la base ya existe, comprobá cuáles de estos cambios tiene aplicados antes de ejecutar los pendientes.

## Compilar e iniciar la API

Configurá la conexión a la base mediante `INCIDENCIAS_DB` o `ConnectionStrings:Incidencias` en la configuración local. El archivo `backend/Incidencias.Api/appsettings.example.json` sirve de ejemplo. Mantené las credenciales fuera del repositorio.

Desde la raíz, ejecutá en PowerShell:

```powershell
dotnet build .\backend\sistema-de-reportes-de-incindencias.slnx
$env:ASPNETCORE_ENVIRONMENT = 'Development'
dotnet run --project .\backend\Incidencias.Api -- --urls http://localhost:5080
```

Con la API en ejecución, abrí `http://localhost:5080/health` para comprobar que responde.

## Rutas principales

| Ruta | Comportamiento |
|---|---|
| `POST /api/sesiones` | Inicia sesión y devuelve el token. |
| `GET /api/sesiones/actual` y `DELETE /api/sesiones/actual` | Consultan y cierran la sesión vigente. |
| `POST /api/incidencias` | Registra una incidencia. Si encuentra una coincidencia abierta, devuelve el código existente y `isDuplicate: true` sin exponer la identidad del reportante. Solo un registro anónimo nuevo recibe el token temporal para subir fotos. |
| `GET /api/seguimiento/{code}` | Seguimiento público RF-10. Muestra fecha, estado y observación técnica de los cambios. Para el estado inicial devuelve «Reporte recibido.». |
| `GET /api/incidencias/publicas` | Lista pública resumida de hasta 100 incidencias, sin identidad, descripción ni prioridad técnica. |
| `GET /api/incidencias/panel` | Panel centralizado RF-13 para Mantenimiento y Desarrollo Físico. Ambas unidades pueden ver el resumen general. Abrir o editar un expediente requiere autorización sobre ese caso. |
| `GET /api/incidencias` | Bandeja autenticada con filtros y alcance según el perfil o área. |
| `GET /api/incidencias/{code}` | Devuelve el expediente al usuario autorizado. |
| `PUT /api/incidencias/{code}` | Actualiza estado o prioridad. Requiere permiso, observación de al menos diez caracteres y versión vigente. Una versión obsoleta devuelve `409`. |

## Contrato OpenAPI

El contrato versionado está en [docs/api/openapi.json](../api/openapi.json). Con la API local en ambiente `Development`, también se puede consultar en `http://localhost:5080/openapi/v1.json`.

## Comprobar el funcionamiento

El programa de pruebas contiene 54 comprobaciones base. Si `INCIDENCIAS_DB` está configurada, también ejecuta comprobaciones de integración con PostgreSQL.

En una segunda terminal, desde la raíz:

```powershell
dotnet run --project .\backend\Incidencias.Domain.Tests
.\backend\scripts\Probar-Recorrido-Rol2.ps1 -BaseUrl http://localhost:5080
```

Ejecutá el recorrido contra una base de pruebas. Pide la contraseña de la cuenta técnica y verifica registro, duplicados, seguimiento público, panel RF-13, permisos, cambios de estado, conflicto de versión y cierre de sesión. Para comprobar la repetibilidad, ejecutá el mismo script dos veces seguidas.