import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
// Guard de acceso: decide si la persona puede entrar a una ruta
export const accessGuard: CanActivateFn = async (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);
   // Espera a que se termine de recuperar la sesion
  await auth.ready;
  const user = auth.user();
   // Sin sesion, va al login
  if (!user) return router.createUrlTree(['/login']);
 // Si la ruta no pide roles, o el perfil esta permitido, entra; si no, va al panel
  return (
    !route.data['roles'] ||
    route.data['roles'].includes(user.profile) ||
    router.createUrlTree(['/panel'])
  );
};
