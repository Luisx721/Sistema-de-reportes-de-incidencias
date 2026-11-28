# Puesta en marcha

Usar Node 24 desde la versión 24.15 y npm 11.

```sh
npm ci
npm start
```

Abrir http://localhost:4200. La demostración Angular no necesita PostgreSQL.

Para configurar PostgreSQL e iniciar la API, consultá las [instrucciones del backend](INSTRUCCIONES_ROL_2.md). Para conocer la estructura del frontend y los perfiles de prueba, consultá la [guía de implementación de Angular](../IMPLEMENTACION_ANGULAR.md).

```sh
npm run build
npm test -- --watch=false
npx playwright install chromium
npm run test:e2e
```

En PowerShell, si se bloquea npm.ps1, utilizar npm.cmd. Para detener el servidor usar Ctrl+C.
