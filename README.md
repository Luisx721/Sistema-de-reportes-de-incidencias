# Sistema de Reportes de Incidencias · UES

Plataforma web para el reporte, seguimiento y gestión de incidencias de infraestructura en el campus de la **Facultad Multidisciplinaria Oriental, Universidad de El Salvador (FMO-UES)**.

El proyecto ha sido migrado a **Angular 22** con componentes independientes (*Standalone Components*), arquitectura reactiva (*Signals*), mapas interactivos con *Leaflet / OpenStreetMap* y persistencia local para prototipado con *IndexedDB*.

---

## 📋 Requisitos Previos

Antes de ejecutar el proyecto, asegúrate de tener instaladas las siguientes herramientas en tu equipo:

1. **Node.js**: Versión `v20.x`, `v22.x` o superior (`v24.x`).
   - Puedes verificar tu versión con:
     ```bash
     node -v
     ```
2. **npm** (gestor de paquetes de Node, incluido con Node.js):
   - Verificar versión:
     ```bash
     npm -v
     ```
3. **Angular CLI** (opcional de forma global, ya que el proyecto incluye los scripts necesarios):
   ```bash
   npm install -g @angular/cli
   ```

---

## 🚀 Guía Rápida para colaboradores (después de hacer `git pull`)

Sigue estos pasos en la terminal cada vez que descargues cambios del repositorio:

### Paso 1: Actualizar el repositorio
Asegúrate de estar en la rama principal y obtener los últimos cambios:
```bash
git pull origin main
```

### Paso 2: Instalar o sincronizar dependencias
Al incorporar nuevos paquetes (como Angular 22, Leaflet, etc.), es indispensable sincronizar `node_modules`:
```bash
npm install
```
> **Nota:** Si prefieres una instalación exacta y limpia basada en el `package-lock.json`, puedes usar:
> ```bash
> npm ci
> ```

### Paso 3: Iniciar el servidor local de desarrollo
Ejecuta el script de inicio:
```bash
npm start
```
*(O también `ng serve` si tienes Angular CLI instalado globalmente).*

### Paso 4: Abrir la aplicación en el navegador
Una vez compilado el proyecto, abre tu navegador web en:
👉 **[http://localhost:4200](http://localhost:4200)**

La aplicación cuenta con recarga automática en vivo (*Live Reload*); cualquier cambio guardado en el código fuente refrescará el navegador automáticamente.

---

## 🗺️ Mapa de Rutas y Funcionalidades

| Ruta | Nombre | Funcionalidad principal |
| :--- | :--- | :--- |
| `/` | **Inicio** | Portal público, bienvenida, accesos rápidos y las 3 incidencias más recientes. |
| `/incidencias` | **Incidencias** | Listado completo de reportes con filtros y alternador a vista de **Mapa interactivo** (OpenStreetMap). |
| `/seguimiento` | **Seguimiento** | Búsqueda por código (`UESDEMO0001` a `UESDEMO0005`), vista de fotos y timeline de estados. |
| `/reporte` | **Nuevo Reporte** | Formulario accesible en 4 pasos con arrastre y previsualización de hasta 3 fotografías y generación de código de seguimiento único. |
| `/confirmacion`| **Confirmación** | Visualización de código generado, botón de copia al portapapeles y resumen imprimible optimizado para papel (`Ctrl + P`). |
| `/ayuda` | **Cómo reportar** | Guía de 4 pasos para reportantes y glosario explicativo de los 5 estados de atención. |
| `/login` | **Iniciar sesión** | Acceso al prototipo interactivo (simulación de sesión en `sessionStorage`) o acceso como invitado. |
| `/registro` | **Crear cuenta** | Formulario de registro de reportante con validaciones de rol universitario y contraseña. |
| `/admin` | **Administración**| Panel de control de infraestructura: gestión de cuentas, catálogo de categorías/ubicaciones y generación/restauración de copias de seguridad JSON. |

---

## 🧪 Pruebas y Compilación

### Compilación para Producción
Para validar que todo el proyecto compile sin errores de tipado o empaquetado:
```bash
npm run build
```
Los archivos optimizados para producción se generarán en la carpeta `dist/ues-incidencias/browser`.

### Pruebas Unitarias
Para ejecutar la suite de pruebas unitarias con Vitest:
```bash
npm test
```
O en modo de una sola ejecución:
```bash
npm test -- --watch=false
```

---

## 🛠️ Solución de Problemas Frecuentes

### 1. Error en Windows PowerShell: `No se puede cargar el archivo ... ps1 porque la ejecución de scripts está deshabilitada`
**Causa:** Política de seguridad por defecto de Windows para scripts de PowerShell.  
**Solución:** Puedes utilizar el comando agregando la extensión `.cmd` o habilitar la ejecución para el proceso actual:
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
npm install
npm start
```
O ejecutando directamente:
```cmd
npm.cmd start
```

### 2. Error: `Port 4200 is already in use`
**Causa:** Otra aplicación o una sesión previa de `ng serve` sigue activa en el puerto 4200.  
**Solución:** Puedes levantar el servidor en otro puerto alternativo:
```bash
npm start -- --port 4201
```

### 3. Inconsistencia o errores con `node_modules` tras actualizar ramas
**Causa:** Conflicto de paquetes o caché desactualizada tras cambios mayores en `package.json`.  
**Solución:** Elimina `node_modules` y reinstala:
- En Windows (PowerShell):
  ```powershell
  Remove-Item -Recurse -Force node_modules
  npm install
  ```
- En Linux / macOS:
  ```bash
  rm -rf node_modules
  npm install
  ```

### 4. Datos de prueba no visibles o restaurar estado inicial
**Explicación:** La aplicación utiliza **IndexedDB** local (`ues-incidencias-demo`) en tu navegador para que los reportes y fotos persistan entre recargas. Si deseas reiniciar los datos a los valores de ejemplo de fábrica:
1. Dirígete a la ruta `/admin` en tu navegador.
2. Ve a la pestaña **Respaldo y restauración**.
3. Haz clic en **Restaurar sistema** y confirma.
*(También puedes limpiar los datos del sitio desde las Herramientas de Desarrollador del navegador: `F12` > `Application` / `Almacenamiento` > `IndexedDB`).*

---

## 📁 Estructura del Repositorio

- `src/app/core/`: Modelos de datos TypeScript y servicios singleton (`DataService`, `AuthService`, `AdminService`, `ToastService`).
- `src/app/shared/`: Componentes transversales reutilizables (`Header`, `Footer`, `Badge`, `Toast`).
- `src/app/features/`: Componentes de página organizados por dominio funcional.
- `src/styles.css`: Hojas de estilos globales con la identidad institucional de la UES (paleta `#b20813`, diseño responsivo y reglas de impresión).
- `public/`: Recursos estáticos (logos institucionales e iconos).
- `incidencias/`: Respaldo del prototipo estático original en HTML/CSS/JS.
