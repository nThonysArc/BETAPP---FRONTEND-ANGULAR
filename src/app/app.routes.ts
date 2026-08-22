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
    loadComponent: () =>
      import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent)
  },
  {
    path: 'admin/campanas',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/admin/campana-list/campana-list.component').then((m) => m.CampanaListComponent)
  },
  {
    path: 'admin/campanas/:campanaId/maquinas',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/admin/maquina-list/maquina-list.component').then((m) => m.MaquinaListComponent)
  },
  { path: '**', redirectTo: '' }
];
