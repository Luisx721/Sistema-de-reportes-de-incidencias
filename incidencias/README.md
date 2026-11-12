# Frontend del reportante · Reportes UES

Prototipo en HTML, CSS y JavaScript sin dependencias de compilación. Todo lo necesario está en esta carpeta; no utiliza archivos de `figma/`.

## Abrir localmente

Desde esta carpeta:

```sh
python3 -m http.server 8000
```

Abrir http://localhost:8000. Se necesita un servidor HTTP, no abrir los HTML con `file://`, porque los scripts utilizan módulos JavaScript.

## Recorrido

- `index.html`: portal público. Accesible sin cuenta.
- `login.html`, `registro.html`: validación de formularios y sesión **simulada** de reportante. Ambos abren el portal al completar los datos.
- `reporte.html`: categoría, ubicación, descripción de 20 caracteres o más, fotografías opcionales (3, JPG/PNG, 5 MiB cada una) e identificación opcional.
- `confirmacion.html`: código, copia, resumen imprimible y acceso al seguimiento.
- `seguimiento.html`: consulta por código e historial público.
- `incidencias.html`: listado con filtros y mapa **esquemático**, no geográfico.
- `ayuda.html`: guía y significado de los cinco estados.

## Datos de demostración

`data.js` separa el almacenamiento de la interfaz. IndexedDB (`ues-incidencias-demo`) conserva reportes y fotografías en este navegador y origen. Los ejemplos usan códigos `UESDEMO0001` a `UESDEMO0005`. Limpiar datos del sitio elimina los reportes locales; cambiar host o puerto cambia el almacenamiento. No se envía información a la universidad.

El registro y login **no crean cuentas, verifican credenciales ni ofrecen autorización real**. Una entrada válida abre una sesión ficticia en sessionStorage. Solo se guarda el nombre del perfil de demostración; no se guardan contraseñas. Elegir un vínculo universitario nunca concede permisos administrativos.

No se muestran nombre ni vínculo del reportante en listados, seguimiento o impresión. La descripción, referencia y fotografías se consideran contenido visible: la interfaz pide evitar datos personales. En producción se necesitarán reglas de visibilidad/moderación.

El mapa es una propuesta adicional. Sus posiciones, ubicaciones y datos de ejemplo no representan una cartografía validada del campus. El resumen imprimible es una demostración, no una constancia institucional ni el PDF oficial de las unidades autorizadas.

## Integración pendiente

- API y base de datos, generación única de código en servidor, subida de archivos, validación y límites del lado servidor.
- Autenticación real, sesiones y permisos de cada perfil; catálogo de vínculos y política de contraseñas definitivos.
- Paneles internos, asignación de unidad, prioridad técnica, actualizaciones de estado y observación, comprobante institucional, estadísticas y exportación.
- Validar los catálogos y la cartografía; acordar publicación de incidencias. Alertas de duplicados no incluidas en este prototipo.
- Selección del framework exigido por la asignatura e integración final. Esta maqueta por sí sola no cumple todo el proyecto PPI.

El CSS comparte variables y componentes en `styles/index.css`. `styles/login.css` adapta las pantallas de acceso. No hay fuentes ni mapas de terceros necesarios para abrir el prototipo.

## Formato del código

Los archivos HTML, CSS y JavaScript usan sangría de dos espacios y comentarios sencillos en español para identificar cada sección. La configuración de Prettier y EditorConfig está dentro de esta carpeta.

En Visual Studio Code puedes instalar la extensión Prettier y usar Formatear documento para conservar este estilo. El formateador es opcional para editar y no es necesario para ejecutar la página.
