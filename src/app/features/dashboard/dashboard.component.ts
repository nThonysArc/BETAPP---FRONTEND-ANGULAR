import { Component, inject } from '@angular/core';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [MatToolbarModule, MatButtonModule, MatIconModule],
  template: `
    <mat-toolbar color="primary">
      <span>Avance de Produccion - Beta Agroindustrial</span>
      <span class="spacer"></span>
      <span class="usuario">{{ authService.usuario()?.nombreCompleto }} ({{ authService.usuario()?.rol }})</span>
      <button mat-button (click)="cerrarSesion()">Cerrar sesion</button>
    </mat-toolbar>

    <div class="contenido">
      <h2>Panel principal</h2>

      <div class="accesos">
        <button mat-flat-button color="primary" (click)="irACampanas()">
          <mat-icon>agriculture</mat-icon>
          Administrar Campanas
        </button>
      </div>

      <p class="nota">
        Aqui iran mas adelante los accesos al registro de cortes por proceso diario.
      </p>
    </div>
  `,
  styles: [`
    .spacer { flex: 1 1 auto; }
    .usuario { margin-right: 16px; font-size: 0.9rem; }
    .contenido { padding: 24px; }
    .accesos { display: flex; gap: 12px; margin: 16px 0; }
    .nota { color: rgba(0, 0, 0, 0.6); }
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
}
