import { accessGuard } from './application/guards/access.guard';
import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    title: 'Inicio | Reportes UES',
    loadComponent: () =>
      import('./presentation/features/home/home.component').then((m) => m.HomeComponent),
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
      import('./presentation/features/incidencias/incidencias.component').then(
        (m) => m.IncidenciasComponent,
      ),
  },
  {
    path: 'seguimiento',
    title: 'Consultar seguimiento | Reportes UES',
    loadComponent: () =>
      import('./presentation/features/seguimiento/seguimiento.component').then(
        (m) => m.SeguimientoComponent,
      ),
  },
  {
    path: 'reporte',
    title: 'Reportar incidencia | Reportes UES',
    loadComponent: () =>
      import('./presentation/features/reporte/reporte.component').then((m) => m.ReporteComponent),
  },
  {
    path: 'confirmacion',
    title: 'Reporte recibido | Reportes UES',
    loadComponent: () =>
      import('./presentation/features/confirmacion/confirmacion.component').then(
        (m) => m.ConfirmacionComponent,
      ),
  },
  {
    path: 'ayuda',
    title: 'Cómo reportar | Reportes UES',
    loadComponent: () =>
      import('./presentation/features/ayuda/ayuda.component').then((m) => m.AyudaComponent),
  },
  {
    path: 'login',
    title: 'Iniciar sesión | Reportes UES',
    loadComponent: () =>
      import('./presentation/features/auth/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'registro',
    title: 'Crear cuenta | Reportes UES',
    loadComponent: () =>
      import('./presentation/features/auth/registro/registro.component').then(
        (m) => m.RegistroComponent,
      ),
  },
  {
    path: 'admin',
    canActivate: [accessGuard],
    data: { roles: ['Administrador'] },
    title: 'Administración del sistema | Reportes UES',
    loadComponent: () =>
      import('./presentation/features/admin/admin.component').then((m) => m.AdminComponent),
  },
  {
    path: 'panel',
    canActivate: [accessGuard],
    loadComponent: () =>
      import('./presentation/features/workspace/workspace.component').then(
        (m) => m.WorkspaceComponent,
      ),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
