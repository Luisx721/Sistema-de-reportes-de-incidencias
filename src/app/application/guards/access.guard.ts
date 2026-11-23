import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
export const accessGuard: CanActivateFn = (route) => {
  const user = inject(AuthService).user();
  const router = inject(Router);
  if (!user) return router.createUrlTree(['/login']);
  return (
    !route.data['roles'] ||
    route.data['roles'].includes(user.profile) ||
    router.createUrlTree(['/panel'])
  );
};
