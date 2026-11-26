# Contrato pendiente: fotografías de incidencias

La API activa de Rol 2 (`Incidencias.Api`) no expone rutas de archivos. La UI conserva las fotos solo como vista previa local y debe informar que no se persistieron.

Contrato mínimo requerido antes de habilitar la carga:

- `POST /api/incidencias/{code}/fotografias`, autenticado con Bearer y `multipart/form-data` (`files`), máximo 3 archivos JPG/PNG de 5 MiB cada uno.
- Responder `201` con identificador, nombre/tipo/tamaño y URL de lectura; usar `400` para formato/tamaño inválido, `403` para falta de competencia y `409` al superar el límite.
- `GET /api/incidencias/{code}/fotografias` lista metadatos; `GET /api/fotografias/{id}/archivo` entrega el binario con autorización de expediente.
- La creación de incidencias no debe aceptar metadatos de fotos como prueba de persistencia; los archivos se cargan después de obtener el código del expediente.
