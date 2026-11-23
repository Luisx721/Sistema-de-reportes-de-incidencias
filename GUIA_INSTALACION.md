# Puesta en marcha

Usar Node 24 desde la versión 24.15 y npm 11.

```sh
npm ci
npm start
```

Abrir http://localhost:4200. La demostración Angular no necesita PostgreSQL.

Consultar [la guía de implementación](docs/IMPLEMENTACION_ANGULAR.md) para perfiles de prueba, arquitectura, comprobaciones y alcance pendiente de la API C# y PostgreSQL 17 en Docker.

```sh
npm run build
npm test -- --watch=false
npx playwright install chromium
npm run test:e2e
```

En PowerShell, si se bloquea npm.ps1, utilizar npm.cmd. Para detener el servidor usar Ctrl+C.
