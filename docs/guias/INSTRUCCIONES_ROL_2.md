# Backend núcleo Rol 2

La solución del backend está en `backend/` y usa .NET 11.0.100. El contrato conserva los nombres del modelo Angular (`code`, `category`, `location`, `description`, `state`, `created`, `history`, `priority`, `responsibleUnit`) y añade `version`. PostgreSQL usa una clave interna `id`; la API identifica reportes por el código público único y no interpreta los IDs locales de Angular como IDs de PostgreSQL. La adaptación del cliente se realizará mediante DTO y mapeo explícito.

## Estado actual

El backend Rol 2 (`backend/Incidencias.Api`) ya está integrado y validado contra la BD oficial ProyectoBD: PostgreSQL 17, base `midb` en `localhost:5440`. Se retiraron `compose.rol2.yml` y `db/provisional/001_schema.sql`; los volúmenes Docker existentes se conservaron.

Pasaron las 15 pruebas de dominio y el recorrido HTTP completo contra `midb`: registro `201`, seguimiento público sin identidad `200`, panel anónimo `401`, login `200`, permisos `403`, filtros por fecha `200`, rango invertido `400`, expediente `200`, cambio de estado e historial `200`, conflicto de versión `409` y cierre de sesión `204`/posterior uso `401`.

## Preparar una base nueva de ProyectoBD

Los siguientes pasos documentan la preparación de una instancia nueva. No es necesario volver a aplicarlos a una instancia que ya tiene estas extensiones. Los scripts SQL se aplican una sola vez en la base correspondiente.

1. Levantar ProyectoBD con `ProyectoBD/docker-compose.yml`.
2. Aplicar por primera vez `db/official/002_rol2_sessions.sql` y `db/official/003_rol2_versions.sql` en el contenedor `sistema-de-reportes-de-incidencias`.
3. Ejecutar `db/official/solicitar-clave.ps1` para cargar el seed mínimo de desarrollo (`004_dev_seed.sql`). El script solicita una contraseña local y la guarda como hash PBKDF2-SHA256; no guardar claves en Git.
4. Levantar `backend/Incidencias.Api` en `http://localhost:5080`, configurando `INCIDENCIAS_DB` o User Secrets/configuración local basada en `backend/Incidencias.Api/appsettings.example.json`. No guardar credenciales en archivos versionados.
5. Ejecutar `backend/scripts/Probar-Recorrido-Rol2.ps1` contra `http://localhost:5080`.

El seed es mínimo y sirve para desarrollo y pruebas; los catálogos y cuentas institucionales finales siguen pendientes de acuerdo.

## Superficie HTTP

- `POST /api/sesiones`, `GET /api/sesiones/actual`, `DELETE /api/sesiones/actual`: inicio, consulta y cierre de sesión. Los permisos se recuperan de la cuenta activa y cada consulta extiende la actividad; 30 minutos sin actividad invalidan la sesión. El token crudo se entrega solo al iniciar y en PostgreSQL se conserva su SHA-256.
- `POST /api/incidencias`: registro público con código aleatorio generado en servidor y descripción de 20 a 2000 caracteres.
- `GET /api/seguimiento/{code}`: seguimiento sin token, con estado e historial y sin campos de identidad.
- `GET /api/incidencias`: panel autenticado con `query`, `category`, `location`, `state`, `from`, `to`; la API limita resultados por rol/área.
- `GET /api/incidencias/{code}`: expediente de la unidad o área con permiso vigente.
- `PUT /api/incidencias/{code}`: cuerpo `{ "state", "priority", "note", "version" }`. Requiere observación de diez caracteres, permiso y versión actual. La escritura y el historial comparten transacción; una versión obsoleta responde `409`.

Los DTO usan camelCase de ASP.NET Core. El panel entrega `version` para concurrencia. El seguimiento público no entrega descripción, referencia, nombre del reportante, vínculo, responsable ni actor del historial; sustituye las observaciones libres por textos genéricos para impedir que una nota revele datos personales.

## Configuración local

La API recibe la conexión por `INCIDENCIAS_DB` o `ConnectionStrings:Incidencias` en User Secrets/configuración local. Usa `backend/Incidencias.Api/appsettings.example.json` como plantilla y nunca guardes contraseñas en archivos versionados. El puerto de desarrollo es `http://localhost:5080`.

## Conexión pendiente de Angular

Angular aún usa adaptadores locales. Falta configurarlo con `HttpClient` para apuntar a `http://localhost:5080` en desarrollo y HTTPS en despliegue; mapear el modelo actual a los DTO camelCase (`code`, `category`, `location`, `description`, `state`, `created`, `history`, `priority`, `version`). Enviar el bearer token para panel, detalle y cambio; no guardarlo en IndexedDB con incidencias ni tratar guards como autorización. Manejar `401` cerrando o renovando sesión, `403` por ámbito y `409` recargando el expediente y solicitando reintento. El seguimiento público debe usar únicamente el DTO reducido de `/api/seguimiento/{code}`. Acordar catálogos y cuentas institucionales finales, además del contrato para modalidad asistida, identidad del reportante y cargas de fotografías, antes de conectar esos flujos.
