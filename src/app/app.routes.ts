import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    title: 'Inicio | Reportes UES',
    loadComponent: () =>
      import('./features/home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'inicio',
    redirectTo: '',
    pathMatch: 'full',
  },
  {
    path: 'incidencias',
    title: 'Incidencias del campus | Reportes UES',
    loadComponent: () =>
      import('./features/incidencias/incidencias.component').then(
        (m) => m.IncidenciasComponent
      ),
  },
  {
    path: 'seguimiento',
    title: 'Consultar seguimiento | Reportes UES',
    loadComponent: () =>
      import('./features/seguimiento/seguimiento.component').then(
        (m) => m.SeguimientoComponent
      ),
  },
  {
    path: 'reporte',
    title: 'Reportar incidencia | Reportes UES',
    loadComponent: () =>
      import('./features/reporte/reporte.component').then(
        (m) => m.ReporteComponent
      ),
  },
  {
    path: 'confirmacion',
    title: 'Reporte recibido | Reportes UES',
    loadComponent: () =>
      import('./features/confirmacion/confirmacion.component').then(
        (m) => m.ConfirmacionComponent
      ),
  },
  {
    path: 'ayuda',
    title: 'Cómo reportar | Reportes UES',
    loadComponent: () =>
      import('./features/ayuda/ayuda.component').then((m) => m.AyudaComponent),
  },
  {
    path: 'login',
    title: 'Iniciar sesión | Reportes UES',
    loadComponent: () =>
      import('./features/auth/login/login.component').then(
        (m) => m.LoginComponent
      ),
  },
  {
    path: 'registro',
    title: 'Crear cuenta | Reportes UES',
    loadComponent: () =>
      import('./features/auth/registro/registro.component').then(
        (m) => m.RegistroComponent
      ),
  },
  {
    path: 'admin',
    title: 'Administración del sistema | Reportes UES',
    loadComponent: () =>
      import('./features/admin/admin.component').then((m) => m.AdminComponent),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
