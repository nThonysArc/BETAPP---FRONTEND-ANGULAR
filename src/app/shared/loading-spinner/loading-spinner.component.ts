import { Component, Input } from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

/**
 * Spinner de carga consistente para toda la app, en vez de texto plano
 * "Cargando..." repetido (y con estilos distintos) en cada pantalla.
 */
@Component({
  selector: 'app-loading-spinner',
  standalone: true,
  imports: [MatProgressSpinnerModule],
  template: `
    <div class="loading-container">
      <mat-spinner diameter="36" />
      @if (mensaje) {
        <p class="loading-mensaje">{{ mensaje }}</p>
      }
    </div>
  `,
  styles: [`
    .loading-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 32px 0;
    }
    .loading-mensaje {
      color: var(--ink-muted);
      font-size: 0.9rem;
      margin: 0;
    }
  `]
})
export class LoadingSpinnerComponent {
  @Input() mensaje = 'Cargando...';
}
