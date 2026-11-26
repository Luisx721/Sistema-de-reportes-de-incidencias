import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
export const accessGuard: CanActivateFn = async (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.ready;
  const user = auth.user();
  if (!user) return router.createUrlTree(['/login']);
  return (
    !route.data['roles'] ||
    route.data['roles'].includes(user.profile) ||
    router.createUrlTree(['/panel'])
  );
};
