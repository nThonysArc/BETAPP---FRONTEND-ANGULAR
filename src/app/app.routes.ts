import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';

/**
 * ORDEN DE RUTAS — regla critica del router de Angular:
 * Las rutas se evaluan en orden de declaracion; la primera que coincide gana.
 * Por eso las rutas con segmentos estaticos (historial, detalle, ingreso, cortes)
 * deben ir ANTES que la ruta parametrica generica (:campanaId / :procesoId).
 * Si ':campanaId' estuviera primero, absorberia 'historial/5', 'detalle/3', etc.
 */
export const routes: Routes = [
  // ── Publicas ───────────────────────────────────────────────────────────────
  {
    path: 'login',
    loadComponent: () =>
      import('./features/login/login.component').then((m) => m.LoginComponent)
  },

  // ── Dashboard ──────────────────────────────────────────────────────────────
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent)
  },

  // ── Administracion ─────────────────────────────────────────────────────────
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
    path: 'admin/supervisores',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/admin/supervisor-list/supervisor-list.component').then(
        (m) => m.SupervisorListComponent
      )
  },
  {
    path: 'admin/variedades',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/admin/variedad-list/variedad-list.component').then((m) => m.VariedadListComponent)
  },

  // ── Procesos — rutas con segmento estatico PRIMERO ─────────────────────────
  {
    // Historial de todos los procesos de una campana
    path: 'procesos/historial/:campanaId',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/proceso/proceso-historial/proceso-historial.component').then(
        (m) => m.ProcesoHistorialComponent
      )
  },
  {
    // Acceso directo a un proceso especifico por su id (desde el historial)
    path: 'procesos/detalle/:procesoId',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/proceso/proceso-detalle/proceso-detalle.component').then((m) => m.ProcesoDetalleComponent)
  },
  {
    // Ingreso de materia prima de un proceso
    path: 'procesos/:procesoId/ingreso',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/proceso/ingreso-materia-prima/ingreso-materia-prima.component').then(
        (m) => m.IngresoMateriaPrimaComponent
      )
  },
  {
    // Formulario de nuevo corte
    path: 'procesos/:procesoId/cortes/nuevo',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/proceso/corte-form/corte-form.component').then((m) => m.CorteFormComponent)
  },
  {
    // Formulario de edicion de corte existente
    path: 'procesos/:procesoId/cortes/:corteId/editar',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/proceso/corte-form/corte-form.component').then((m) => m.CorteFormComponent)
  },
  {
    // Proceso de HOY de una campana — va AL FINAL de las rutas /procesos/*
    // para no capturar 'historial', 'detalle', etc.
    path: 'procesos/:campanaId',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/proceso/proceso-detalle/proceso-detalle.component').then((m) => m.ProcesoDetalleComponent)
  },

  // ── Fallback ───────────────────────────────────────────────────────────────
  { path: '**', redirectTo: '' }
];
