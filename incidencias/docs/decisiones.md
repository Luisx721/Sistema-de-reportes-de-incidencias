# Registro de Decisiones Técnicas (ADR)

## Decisión 01: Adaptación de la Interfaz y Menú Principal para el Reporte de Incidencias

- **Fecha:** 2026-11-07
- **Estado:** Aceptada
- **Contexto:** En el marco de la Unidad I y II, se requiere adaptar el diseño de la aplicación universitaria (UES) para centrarse inicialmente en el formulario de captura de incidencias de infraestructura del campus. El menú principal contenía enlaces no prioritarios (Perfil, Reportes, Configuración, Ayuda).
- **Decisión:**
  1. Se simplificó la navegación principal conservando únicamente la opción de **"Reportar Incidencia"** para guiar la atención del usuario hacia la funcionalidad de reporte.
  2. Se diseñó el formulario en `index.html` bajo estándares semánticos HTML5 (`<form>`, `<fieldset>`, `<legend>`, `<label>`, `<input>`, `<select>`, `<textarea>`) y diseño responsivo móvil-primero (CSS Grid/Flexbox) en `styles/index.css`.
  3. Se incluyeron todos los campos descritos en los requerimientos funcionales mínimos (F1 y Modelo de Datos): rol universitario, nombre, correo institucional, categoría, edificio/área, detalle de ubicación, descripción detallada (mínimo 20 caracteres) y zona de carga de evidencia fotográfica con previsualización.
  4. Se respetó la paleta cromática e identidad institucional de la Universidad de El Salvador (rojo institucional `#CC0000`, rojo oscuro `#800000`, fondo blanco y tonos neutros de soporte).
- **Consecuencias:** La página inicial queda enfocada y lista para la siguiente fase de validaciones avanzadas e integración con el backend.


## Decisión 02: Restricciones de Validación y Adaptación al Ancho de Pantalla

- **Fecha:** 2026-11-07
- **Estado:** Aceptada
- **Contexto:** Se requirió que el formulario no permita el envío cuando existan campos requeridos vacíos o con datos incompletos, y que la interfaz aproveche el ancho completo de la pantalla sin comprometer la armonía visual ni romper el diseño responsivo.
- **Decisión:**
  1. **Ajuste fluido de pantalla:** Se expandió el contenedor principal hasta `1280px` en coherencia con el banner institucional, empleando `clamp()` para márgenes y espaciados internos. Las filas de campos se estructuraron con CSS Grid usando `repeat(auto-fit, minmax(280px, 1fr))`, lo que permite 3 columnas en pantallas anchas, 2 en pantallas medianas y 1 en móviles sin desbordamiento horizontal (`overflow-x: hidden`).
  2. **Restricciones de envío:** Se interceptó el evento `submit` en JavaScript para evitar envíos con campos vacíos. Se valida que el rol, nombre (mínimo 3 caracteres), correo institucional válido, categoría, ubicación, detalle de ubicación y descripción (mínimo 20 caracteres) cumplan los criterios antes de procesar el reporte.
  3. **Retroalimentación visual y accesible:** Los campos inválidos se resaltan con bordes y fondos de error accesibles (`#dc3545`), acompañados de mensajes descriptivos y enfoque automático (`scrollIntoView` y `focus`) en el primer campo inválido.
  4. **Notificación de estado:** Se añadió un componente de alerta que muestra tanto advertencias de campos incompletos como la confirmación de éxito con código de seguimiento simulado (`INC-2026-XXXXX`).
