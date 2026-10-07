import { Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';

import { TEMAS, TemaApp, ThemeService } from '../../core/theme/theme.service';

/**
 * Selector de tema (Claro, Oscuro, Planta). Planta sube el contraste y el
 * tamaño de los controles para usar la app a pleno sol o con guantes.
 */
@Component({
  selector: 'app-theme-toggle',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, MatMenuModule],
  template: `
    <button
      mat-icon-button
      type="button"
      [matMenuTriggerFor]="menu"
      [attr.aria-label]="'Cambiar tema. Tema actual: ' + nombreActual()"
    >
      <mat-icon>{{ iconoActual() }}</mat-icon>
    </button>
    <mat-menu #menu="matMenu">
      @for (t of temas; track t.id) {
        <button mat-menu-item type="button" (click)="elegir(t.id)" [attr.aria-current]="t.id === themeService.tema()">
          <mat-icon>{{ t.id === themeService.tema() ? 'check' : t.icono }}</mat-icon>
          <span>{{ t.nombre }}</span>
        </button>
      }
    </mat-menu>
  `
})
export class ThemeToggleComponent {
  protected readonly themeService = inject(ThemeService);
  protected readonly temas = TEMAS;

  protected readonly iconoActual = computed(
    () => TEMAS.find((t) => t.id === this.themeService.tema())?.icono ?? 'light_mode'
  );
  protected readonly nombreActual = computed(
    () => TEMAS.find((t) => t.id === this.themeService.tema())?.nombre ?? 'Claro'
  );

  protected elegir(tema: TemaApp): void {
    this.themeService.cambiar(tema);
  }
}
