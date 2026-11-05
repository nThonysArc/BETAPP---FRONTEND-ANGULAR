import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { OfflineStore } from './offline-store.service';
import { OfflineSyncService } from './offline-sync.service';
import { InfoConexion, calidadSenal } from './senal.util';

/**
 * Indicador de conexion: icono de wifi en la esquina superior derecha. Verde = buena, amarillo = debil
 * (menos barras), rojo = sin red (wifi tachado). No es una franja ni flota sobre el contenido;
 * al tocarlo se abre el detalle: estado, cuantos envios faltan y las acciones (enviar, reintentar).
 * Sigue cumpliendo el "contrato de confianza": la persona siempre sabe si su trabajo ya llego.
 */
@Component({
  selector: 'app-offline-banner',
  standalone: true,
  imports: [MatButtonModule, MatIconModule],
  template: `
    <div class="indicador" [class.abierto]="abierto()">
      <button type="button" class="icono-btn" [class]="nivel()" (click)="abierto.set(!abierto())"
              [attr.aria-label]="'Estado de conexion: ' + etiqueta()" [attr.aria-expanded]="abierto()"
              [title]="etiqueta()">
        <mat-icon>{{ icono() }}</mat-icon>
        @if (hayError()) {
          <span class="insignia error" aria-hidden="true">!</span>
        } @else if (store.pendientes().length > 0) {
          <span class="insignia" aria-hidden="true">{{ store.pendientes().length }}</span>
        }
      </button>

      @if (abierto()) {
        <div class="detalle" role="status" aria-live="polite">
          <div class="cabecera">
            <mat-icon [class]="'icono-detalle ' + nivel()">{{ icono() }}</mat-icon>
            <strong>{{ etiqueta() }}</strong>
            <button mat-icon-button class="cerrar" (click)="abierto.set(false)" aria-label="Cerrar">
              <mat-icon>close</mat-icon>
            </button>
          </div>
          <p>{{ detalle() }}</p>
          @if (errorItem(); as item) {
            <div class="acciones">
              <button mat-button (click)="sync.reintentar(item)">Reintentar</button>
              <button mat-button (click)="descartar(item)">Descartar</button>
            </div>
          } @else if (store.pendientes().length > 0 && store.enLinea() && !sync.sincronizando()) {
            <div class="acciones"><button mat-button (click)="sync.sincronizar()">Enviar ahora</button></div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    /* Esquina superior derecha, a la altura de la barra de titulo (que reserva este hueco: ver styles). */
    .indicador {
      position: fixed; z-index: 2000; right: 10px;
      top: calc(env(safe-area-inset-top, 0px) + 12px);
    }
    @media (min-width: 600px) { .indicador { top: calc(env(safe-area-inset-top, 0px) + 16px); right: 16px; } }

    .icono-btn {
      position: relative; display: grid; place-items: center; width: 32px; height: 32px; padding: 0;
      border: 0; border-radius: 50%; cursor: pointer;
      background: rgba(255,255,255,.94); box-shadow: 0 1px 3px rgba(0,0,0,.28);
    }
    .icono-btn mat-icon { font-size: 20px; width: 20px; height: 20px; line-height: 20px; }
    .buena mat-icon, .icono-detalle.buena { color: #1f8a3d; }
    .debil mat-icon, .icono-detalle.debil { color: #c98a00; }
    .sin-red mat-icon, .icono-detalle.sin-red { color: #d32f2f; }
    .icono-detalle { font-size: 22px; width: 22px; height: 22px; }

    .insignia {
      position: absolute; top: -4px; right: -4px; min-width: 16px; height: 16px; padding: 0 4px;
      border-radius: 8px; background: #333; color: #fff; font-size: 10px; font-weight: 700;
      line-height: 16px; text-align: center; box-sizing: border-box;
    }
    .insignia.error { background: #d32f2f; }

    .detalle {
      position: absolute; top: 40px; right: 0;
      width: min(300px, calc(100vw - 20px)); padding: 10px 12px; border-radius: 12px;
      background: #fff; color: #222; box-shadow: 0 6px 20px rgba(0,0,0,.3); font-size: 14px;
    }
    .cabecera { display: flex; align-items: center; gap: 8px; }
    .cabecera strong { flex: 1; }
    .cerrar { margin-right: -8px; }
    p { margin: 6px 0 0; line-height: 1.35; }
    .acciones { display: flex; gap: 4px; justify-content: flex-end; margin-top: 4px; }
  `]
})
export class OfflineBannerComponent {
  readonly store = inject(OfflineStore);
  readonly sync = inject(OfflineSyncService);

  readonly abierto = signal(false);
  private readonly conexion = signal<InfoConexion | null>(null);

  readonly errorItem = computed(() => this.store.pendientes().find((p) => p.error) ?? null);
  readonly hayError = computed(() => this.errorItem() !== null);
  readonly nivel = computed(() => calidadSenal(this.store.enLinea(), this.conexion()));

  /** Icono de wifi segun la senal: completo, con pocas barras o tachado. */
  readonly icono = computed(() => {
    switch (this.nivel()) {
      case 'sin-red': return 'wifi_off';
      case 'debil': return 'wifi_2_bar';
      default: return 'wifi';
    }
  });

  readonly etiqueta = computed(() => {
    switch (this.nivel()) {
      case 'sin-red': return 'Sin conexión';
      case 'debil': return 'Señal débil';
      default: return 'Conexión buena';
    }
  });

  readonly detalle = computed(() => {
    const n = this.store.pendientes().length;
    const error = this.errorItem();
    const pend = `${n} envío${n === 1 ? '' : 's'} pendiente${n === 1 ? '' : 's'}`;
    if (error) return `No se pudo enviar "${error.etiqueta}": ${error.error ?? ''}`;
    if (this.sync.sincronizando()) return 'Enviando al servidor…';
    if (this.nivel() === 'sin-red') {
      return n > 0
        ? `Todo se guarda en este dispositivo. ${pend}; se enviarán al volver la red.`
        : 'Puedes seguir registrando: se guarda en este dispositivo y se envía al volver la red.';
    }
    if (this.nivel() === 'debil') {
      return n > 0 ? `La red es lenta. ${pend}.` : 'La red es lenta; puede tardar en guardar, pero no se pierde nada.';
    }
    return n > 0 ? `${pend}.` : 'Todo está al día.';
  });

  constructor() {
    const c = (navigator as Navigator & { connection?: EventTarget & InfoConexion }).connection;
    if (c) {
      const leer = () => this.conexion.set({
        effectiveType: c.effectiveType, rtt: c.rtt, downlink: c.downlink, saveData: c.saveData
      });
      leer();
      c.addEventListener('change', leer);
      inject(DestroyRef).onDestroy(() => c.removeEventListener('change', leer));
    }
  }

  descartar(item: Parameters<OfflineSyncService['descartar']>[0]): void {
    if (confirm(`Se descartará "${item.etiqueta}" y no llegará al servidor. ¿Continuar?`)) {
      void this.sync.descartar(item);
    }
  }
}
