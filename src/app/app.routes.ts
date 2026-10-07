import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/login/login.component').then((m) => m.LoginComponent)
  },
  {
    path: '',
    canActivate: [authGuard],
    // Placeholder: aqui va el futuro dashboard/home una vez lo construyamos.
    // Por ahora redirige a login si no hay sesion (el guard se encarga).
    loadComponent: () =>
      import('./features/login/login.component').then((m) => m.LoginComponent)
  },
  { path: '**', redirectTo: '' }
];
