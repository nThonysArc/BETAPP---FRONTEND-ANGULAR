import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

/**
 * Interceptor funcional (patron moderno de Angular 15+, sin necesidad de
 * una clase HttpInterceptor con NgModule).
 *
 * 1. Agrega el JWT a cada request saliente hacia el backend, si existe.
 * 2. Si el backend responde 401 (token vencido o invalido), cierra la
 *    sesion local y redirige al login - evita que la app quede en un
 *    estado "autenticado" fantasma con un token que el servidor ya rechaza.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const token = authService.getToken();
  const reqConToken = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(reqConToken).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        authService.logout();
        router.navigate(['/login']);
      }
      return throwError(() => error);
    })
  );
};
