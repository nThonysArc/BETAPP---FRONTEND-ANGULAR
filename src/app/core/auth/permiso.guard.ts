import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/**
 * Guard de permiso: ademas de exigir sesion, exige que el usuario tenga el permiso indicado.
 * Es una comodidad de navegacion (evita entrar a una pantalla que el backend rechazaria con 403);
 * el control real esta en el backend.
 */
export const permisoGuard = (permiso: string): CanActivateFn => () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.estaAutenticado()) {
    router.navigate(['/login']);
    return false;
  }
  if (auth.tiene(permiso)) {
    return true;
  }
  router.navigate(['/']);
  return false;
};

/** Pantallas exclusivas del super admin (gestion de usuarios). */
export const superAdminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.esSuperAdmin()) {
    return true;
  }
  router.navigate([auth.estaAutenticado() ? '/' : '/login']);
  return false;
};
