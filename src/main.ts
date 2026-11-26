// Funcion que arranca una aplicacion Angular en el navegador
import { bootstrapApplication } from '@angular/platform-browser';
// Configuracion global de la aplicacion (rutas, servicios, etc.)
import { appConfig } from './app/app.config';
// Componente principal, el que contiene a todas las pantallas
import { App } from './app/app';

// Punto de arranque del sistema:
// inicia el componente principal con la configuracion global
bootstrapApplication(App, appConfig)
  // Si algo falla al iniciar, el error se muestra en la consola del navegador
.catch((err) => console.error(err));
