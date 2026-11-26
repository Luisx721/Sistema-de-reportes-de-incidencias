# Fotografías de incidencias: estado de las dos API

La API activa (`backend/Incidencias.Api`) no expone endpoints de fotografías, no recibe `multipart/form-data` y no conserva archivos. Angular avisa que las imágenes seleccionadas son solo una vista previa. `POST /api/incidencias` acepta JSON, no archivos.

La API anterior (`backend/sistema-de-reportes-de-incindencias`) expone `POST /api/fotografia` con `multipart/form-data` (campos `Archivo` e `IdIncidencia`) y `POST /api/fotografia/json`; lista mediante `GET /api/fotografias?idIncidencia=...`, consulta metadatos con `GET /api/fotografia/{id}` y sirve el archivo con `GET /api/fotografia/{id}/archivo`. Guarda metadatos en PostgreSQL y binarios en `App_Data/fotografias`. Esos endpoints usan IDs de incidencia y autenticación distintos; no son compatibles con códigos de seguimiento ni sesiones de la API activa.

Para completar la función en la API activa se necesita:

- `POST /api/incidencias/{code}/fotografias` autenticado con Bearer y `multipart/form-data` (`files`), con un máximo de tres archivos JPG/PNG de hasta 5 MiB cada uno.
- `GET /api/incidencias/{code}/fotografias` para listar metadatos y un endpoint autenticado para entregar los binarios.
- Metadatos relacionales (incidencia, orden, nombre seguro, MIME y tamaño) y almacenamiento durable (volumen de archivos respaldado o almacenamiento de objetos). La carga ocurre después de crear el expediente y obtener su código.
