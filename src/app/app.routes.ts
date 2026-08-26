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
  {
    path: 'admin/maquinas/:maquinaId/katos',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/admin/maquina-kato-list/maquina-kato-list.component').then(
        (m) => m.MaquinaKatoListComponent
      )
  },
  {
    path: 'admin/variedades',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/admin/variedad-list/variedad-list.component').then((m) => m.VariedadListComponent)
  },
  {
    path: 'procesos/:campanaId',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/proceso/proceso-detalle/proceso-detalle.component').then((m) => m.ProcesoDetalleComponent)
  },
  {
    path: 'procesos/historial/:campanaId',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/proceso/proceso-historial/proceso-historial.component').then(
        (m) => m.ProcesoHistorialComponent
      )
  },
  {
    path: 'procesos/detalle/:procesoId',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/proceso/proceso-detalle/proceso-detalle.component').then((m) => m.ProcesoDetalleComponent)
  },
  {
    path: 'procesos/:procesoId/ingreso',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/proceso/ingreso-materia-prima/ingreso-materia-prima.component').then(
        (m) => m.IngresoMateriaPrimaComponent
      )
  },
  {
    path: 'procesos/:procesoId/cortes/nuevo',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/proceso/corte-form/corte-form.component').then((m) => m.CorteFormComponent)
  },
  {
    path: 'procesos/:procesoId/cortes/:corteId/editar',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/proceso/corte-form/corte-form.component').then((m) => m.CorteFormComponent)
  },
  { path: '**', redirectTo: '' }
];
