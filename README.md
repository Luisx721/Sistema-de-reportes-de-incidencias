# Sistema de Reportes de Incidencias UES

Aplicación Angular con interfaces conectadas por rol y datos locales de demostración.

## Ejecutar

Usa Node 24 desde la versión 24.15 y npm 11.

```sh
npm ci
npm start
```

Abre `http://localhost:4200`. No requiere PostgreSQL para esta demostración.

## Organización y cuentas de prueba

Consulta [Implementación Angular](docs/IMPLEMENTACION_ANGULAR.md) para la estructura por capas, las credenciales ficticias, los recorridos y las reglas provisionales pendientes de validación en el documento final.

## Verificar

```sh
npm run build
npm test -- --watch=false
npx playwright install chromium
npm run test:e2e
```

El frontend utiliza IndexedDB para reportes y fotografías, localStorage para cuentas y catálogos y sessionStorage para la sesión. La API C# y PostgreSQL 17 en Docker siguen pendientes. Los controles del frontend son de demostración y deben reproducirse en el servidor antes de utilizar datos reales.

El prototipo anterior se conserva en `incidencias/` como referencia histórica. La aplicación activa está en `src/app/`.
