import { Component, inject } from '@angular/core';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { ThemeToggleComponent } from '../../shared/theme-toggle/theme-toggle.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [MatToolbarModule, MatButtonModule, MatIconModule, ThemeToggleComponent],
  template: `
    <mat-toolbar color="primary">
      <span>Avance de Produccion - Beta Agroindustrial</span>
      <span class="spacer"></span>
      <span class="usuario">{{ authService.usuario()?.nombreCompleto }} ({{ authService.usuario()?.rol }})</span>
      <app-theme-toggle />
      <button mat-button class="cerrar-sesion" (click)="cerrarSesion()">Cerrar sesion</button>
      <button mat-icon-button class="cerrar-sesion cerrar-sesion--icono" aria-label="Cerrar sesion" (click)="cerrarSesion()">
        <mat-icon>logout</mat-icon>
      </button>
    </mat-toolbar>

    <div class="contenido">
      <h2>Panel principal</h2>
      <p class="sesion">{{ authService.usuario()?.nombreCompleto }} ({{ authService.usuario()?.rol }})</p>

      <div class="accesos">
        @if (authService.tiene('PROCESOS_VER')) {
          <button mat-flat-button color="primary" (click)="irACampanas()">
            <mat-icon>agriculture</mat-icon>
            {{ authService.tiene('CATALOGOS_ADMINISTRAR') ? 'Administrar Campanas' : 'Campanas y procesos' }}
          </button>
        }

        @if (authService.tiene('CATALOGOS_ADMINISTRAR')) {
          <button mat-stroked-button (click)="irAVariedades()">
            <mat-icon>eco</mat-icon>
            Administrar Variedades
          </button>
        }

        @if (authService.tiene('SUPERVISORES_ADMINISTRAR')) {
          <button mat-stroked-button (click)="irASupervisores()">
            <mat-icon>supervisor_account</mat-icon>
            Administrar Supervisores
          </button>
        }

        @if (authService.esSuperAdmin()) {
          <button mat-stroked-button (click)="irAUsuarios()">
            <mat-icon>admin_panel_settings</mat-icon>
            Usuarios y permisos
          </button>
        }
      </div>
    </div>
  `,
  styles: [`
    .spacer { flex: 1 1 auto; }
    .cerrar-sesion,
    app-theme-toggle { --mdc-text-button-label-text-color: var(--on-brand); --mat-icon-button-icon-color: var(--on-brand); color: var(--on-brand); }

    /* Celular: el nombre del usuario baja al contenido y "Cerrar sesion" pasa a icono,
       así la barra solo lleva título, tema y salir. */
    .usuario, .cerrar-sesion:not(.cerrar-sesion--icono) { display: none; }
    .sesion { margin: 0 0 var(--space-4); color: var(--ink-muted); overflow-wrap: anywhere; }
    .accesos { display: grid; gap: var(--space-3); margin: var(--space-4) 0; }
    .accesos button { width: 100%; justify-content: flex-start; }

    @media (min-width: 720px) {
      .usuario { display: inline; margin-right: var(--space-2); font-size: 0.9rem; }
      .cerrar-sesion:not(.cerrar-sesion--icono) { display: inline-flex; }
      .cerrar-sesion--icono, .sesion { display: none; }
      .accesos { display: flex; flex-wrap: wrap; }
      .accesos button { width: auto; }
    }
  `]
})
export class DashboardComponent {
  protected readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  cerrarSesion(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  irACampanas(): void {
    this.router.navigate(['/admin/campanas']);
  }

  irAVariedades(): void {
    this.router.navigate(['/admin/variedades']);
  }

  irAUsuarios(): void {
    this.router.navigate(['/admin/usuarios']);
  }

  irASupervisores(): void {
    this.router.navigate(['/admin/supervisores']);
  }
}
