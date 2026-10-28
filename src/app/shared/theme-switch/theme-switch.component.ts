import { Component, inject } from '@angular/core';

import { TEMAS, TemaApp, ThemeService } from '../../core/theme/theme.service';

const ETIQUETAS: Record<TemaApp, string> = {
  light: 'Claro',
  dark: 'Oscuro',
  planta: 'Planta'
};

/**
 * Selector de tema con las tres opciones siempre a la vista (Claro, Oscuro,
 * Planta). A diferencia de app-theme-toggle (icono + menú), no esconde Planta
 * detrás de un toque extra: el operario de planta lo necesita antes de iniciar
 * sesión. Sus colores salen de los tokens; para ponerlo sobre otro fondo basta
 * definir --sw-tinta (texto, borde y opción activa) y --sw-papel (texto sobre
 * la opción activa).
 */
@Component({
  selector: 'app-theme-switch',
  standalone: true,
  template: `
    <div class="conmutador" role="group" aria-label="Tema de la aplicación">
      @for (t of temas; track t.id) {
        <button
          type="button"
          class="conmutador__opcion"
          [attr.aria-pressed]="t.id === themeService.tema()"
          (click)="elegir(t.id)"
        >
          {{ etiquetas[t.id] }}
        </button>
      }
    </div>
  `,
  styles: `
    :host {
      display: inline-block;
    }

    .conmutador {
      --tinta: var(--sw-tinta, var(--brand));
      display: flex;
      align-items: center;
      padding: 3px;
      border: 1px solid color-mix(in srgb, var(--tinta) 45%, transparent);
      border-radius: var(--radius-pill);
      background: color-mix(in srgb, var(--tinta) 12%, transparent);
    }

    .conmutador__opcion {
      min-height: 44px;
      padding: 0 var(--space-3);
      border: 0;
      border-radius: var(--radius-pill);
      background: transparent;
      color: var(--tinta);
      font: 700 0.875rem/1.25rem var(--font-sans);
      cursor: pointer;
    }

    .conmutador__opcion[aria-pressed='true'] {
      background: var(--tinta);
      color: var(--sw-papel, var(--on-brand));
    }

    :host-context([data-theme='planta']) .conmutador {
      border: 2px solid var(--tinta);
    }

    :host-context([data-theme='planta']) .conmutador__opcion {
      min-height: var(--touch-min);
      font-size: 1rem;
    }
  `
})
export class ThemeSwitchComponent {
  protected readonly themeService = inject(ThemeService);
  protected readonly temas = TEMAS;
  protected readonly etiquetas = ETIQUETAS;

  protected elegir(tema: TemaApp): void {
    this.themeService.cambiar(tema);
  }
}
