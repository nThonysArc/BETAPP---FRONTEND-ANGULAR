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
    </mat-toolbar>

    <div class="contenido">
      <h2>Panel principal</h2>

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
    .usuario { margin-right: var(--space-2); font-size: 0.9rem; }
    .cerrar-sesion,
    app-theme-toggle { --mdc-text-button-label-text-color: var(--on-brand); --mat-icon-button-icon-color: var(--on-brand); color: var(--on-brand); }
    .contenido { padding: var(--space-5); }
    .accesos { display: flex; flex-wrap: wrap; gap: var(--space-3); margin: var(--space-4) 0; }
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
