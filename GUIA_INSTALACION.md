# 📖 Guía de Puesta en Marcha (Post `git pull`)

Esta guía describe los pasos necesarios para que cualquier miembro del equipo levante y trabaje en el proyecto Angular localmente después de descargar los cambios del repositorio.

---

## 1. Requisitos del Sistema

- **Node.js**: Versión `v20.x`, `v22.x` o `v24.x`.
  ```bash
  node -v
  ```
- **npm**: Incluido con Node.js (`v10.x` o superior).
  ```bash
  npm -v
  ```
- **Git**: Para control de versiones.

---

## 2. Flujo de Trabajo al hacer `git pull`

Cada vez que descargues la versión más reciente del proyecto:

```bash
# 1. Traer los últimos cambios
git pull origin main

# 2. Instalar y sincronizar dependencias de Angular y librerías (Leaflet, etc.)
npm install

# 3. Iniciar el servidor local
npm start
```

Una vez que la consola muestre que el empaquetado finalizó, abre tu navegador en:
👉 **http://localhost:4200**

---

## 3. Comandos Útiles del Proyecto

| Comando | Acción |
| :--- | :--- |
| `npm start` | Inicia el servidor de desarrollo en `http://localhost:4200` con recarga en caliente. |
| `npm run build` | Compila el proyecto en modo producción y verifica que no existan errores de TypeScript. |
| `npm test` | Ejecuta las pruebas unitarias con Vitest. |
| `npm start -- --port 4201` | Inicia el servidor en un puerto alternativo si el 4200 está ocupado. |

---

## 4. Notas para Usuarios de Windows PowerShell

Si al ejecutar comandos de npm o ng en PowerShell recibes el mensaje:
> *`... no se puede cargar el archivo porque la ejecución de scripts está deshabilitada en este sistema`*

Ejecuta este comando una sola vez en tu terminal de PowerShell:
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```
O bien utiliza los ejecutables de comando de Windows directamente:
```cmd
npm.cmd install
npm.cmd start
```

---

## 5. Datos Locales y Prototipo

- Los reportes se almacenan en la base de datos **IndexedDB** de tu navegador (`ues-incidencias-demo`).
- La aplicación incluye 5 reportes iniciales de ejemplo: de `UESDEMO0001` a `UESDEMO0005`.
- Puedes probar el flujo de seguimiento ingresando cualquiera de esos códigos en `/seguimiento`.
- Para reiniciar los datos a su estado original de fábrica, ve a `/admin` > pestaña **Respaldo y restauración** > **Restaurar sistema**.
