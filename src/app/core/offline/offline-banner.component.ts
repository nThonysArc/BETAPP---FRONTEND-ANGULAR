import { Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { OfflineStore } from './offline-store.service';
import { OfflineSyncService } from './offline-sync.service';

/**
 * Franja fija que dice en todo momento el estado de la conexion y de lo que falta enviar.
 * Es el "contrato de confianza" del modo sin red: la persona siempre sabe si su trabajo esta
 * guardado en el dispositivo o ya llego al servidor.
 */
@Component({
  selector: 'app-offline-banner',
  standalone: true,
  imports: [MatButtonModule, MatIconModule],
  template: `
    @if (visible()) {
      <div class="franja" [class.error]="hayError()" [class.sin-red]="!store.enLinea()" role="status" aria-live="polite">
        <mat-icon aria-hidden="true">{{ icono() }}</mat-icon>
        <div class="texto">
          <strong>{{ titulo() }}</strong>
          <span>{{ detalle() }}</span>
        </div>
        @if (errorItem(); as item) {
          <button mat-button (click)="sync.reintentar(item)">Reintentar</button>
          <button mat-button (click)="descartar(item)">Descartar</button>
        } @else if (store.pendientes().length > 0 && store.enLinea() && !sync.sincronizando()) {
          <button mat-button (click)="sync.sincronizar()">Enviar ahora</button>
        }
      </div>
    }
  `,
  styles: [`
    .franja {
      position: fixed; left: 8px; right: 8px; bottom: 8px; z-index: 2000;
      display: flex; align-items: center; gap: 10px; padding: 10px 14px;
      border-radius: 10px; background: #1d6a38; color: #fff;
      box-shadow: 0 4px 16px rgba(0,0,0,.28); font-size: 14px; line-height: 1.3;
    }
    .franja.sin-red { background: #8a5a00; }
    .franja.error { background: #a3262a; }
    .texto { display: flex; flex-direction: column; flex: 1; min-width: 0; }
    .texto span { opacity: .92; font-size: 13px; }
    button { color: #fff; white-space: nowrap; }
    @media (min-width: 720px) { .franja { left: auto; right: 16px; max-width: 460px; } }
  `]
})
export class OfflineBannerComponent {
  readonly store = inject(OfflineStore);
  readonly sync = inject(OfflineSyncService);

  readonly errorItem = computed(() => this.store.pendientes().find((p) => p.error) ?? null);
  readonly hayError = computed(() => this.errorItem() !== null);
  readonly visible = computed(
    () => !this.store.enLinea() || this.store.pendientes().length > 0 || this.sync.sincronizando()
  );

  readonly icono = computed(() => {
    if (this.hayError()) return 'error_outline';
    if (!this.store.enLinea()) return 'cloud_off';
    return 'sync';
  });

  readonly titulo = computed(() => {
    const n = this.store.pendientes().length;
    const error = this.errorItem();
    if (error) return `No se pudo enviar: ${error.etiqueta}`;
    if (!this.store.enLinea()) return 'Sin conexion';
    if (n > 0) return this.sync.sincronizando() ? 'Enviando al servidor…' : 'Hay datos por enviar';
    return 'Conexion restablecida';
  });

  readonly detalle = computed(() => {
    const n = this.store.pendientes().length;
    const error = this.errorItem();
    if (error) return error.error ?? '';
    if (!this.store.enLinea()) {
      return n > 0
        ? `Todo se guarda en este dispositivo. ${n} pendiente${n === 1 ? '' : 's'} de enviar.`
        : 'Puedes seguir registrando: se guarda en este dispositivo y se envia al volver la red.';
    }
    return n > 0 ? `${n} pendiente${n === 1 ? '' : 's'} de enviar.` : 'Todo esta al dia.';
  });

  descartar(item: Parameters<OfflineSyncService['descartar']>[0]): void {
    if (confirm(`Se descartara "${item.etiqueta}" y no llegara al servidor. ¿Continuar?`)) {
      void this.sync.descartar(item);
    }
  }
}
