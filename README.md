# Sistema de Reportes de Incidencias UES

Sistema de reportes de incidencias de la UES con interfaces por rol en Angular, una API en .NET 10 y PostgreSQL 17.

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

La aplicación Angular consume la API de `backend/Incidencias.Api/`, desarrollada en .NET 10 y conectada a PostgreSQL 17. El modo de demostración utiliza almacenamiento local del navegador.

Para levantar la base de datos, iniciar la API y ejecutar las pruebas, consultá las [instrucciones del backend](docs/guias/INSTRUCCIONES_ROL_2.md). El [contrato OpenAPI](docs/api/openapi.json) documenta las rutas disponibles.

El prototipo anterior se conserva en `incidencias/` como referencia histórica. La aplicación activa está en `src/app/`.
