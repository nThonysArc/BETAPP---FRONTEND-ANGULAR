import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { OfflineStore } from './offline-store.service';
import { OfflineSyncService } from './offline-sync.service';
import { InfoConexion, calidadSenal } from './senal.util';

/**
 * Indicador compacto de conexion (semaforo): verde = buena, amarillo = debil, rojo = sin red.
 * Es un circulo pequeno en el borde superior (no una franja) para no tapar tarjetas ni botones;
 * al tocarlo se abre el detalle: estado, cuantos envios faltan y las acciones (enviar, reintentar).
 * Sigue cumpliendo el "contrato de confianza": la persona siempre sabe si su trabajo ya llego.
 */
@Component({
  selector: 'app-offline-banner',
  standalone: true,
  imports: [MatButtonModule, MatIconModule],
  template: `
    <div class="indicador" [class.abierto]="abierto()">
      <button type="button" class="punto-btn" (click)="abierto.set(!abierto())"
              [attr.aria-label]="'Estado de conexion: ' + etiqueta()" [attr.aria-expanded]="abierto()">
        <span class="punto" [class]="nivel()"></span>
        @if (hayError()) {
          <span class="aviso" aria-hidden="true">!</span>
        } @else if (store.pendientes().length > 0) {
          <span class="contador" aria-hidden="true">{{ store.pendientes().length }}</span>
        }
      </button>

      @if (abierto()) {
        <div class="detalle" role="status" aria-live="polite">
          <div class="cabecera">
            <span class="punto" [class]="nivel()"></span>
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
    .indicador {
      position: fixed; z-index: 2000; left: 50%; transform: translateX(-50%);
      top: calc(env(safe-area-inset-top, 0px) + 2px);
    }
    .punto-btn {
      display: flex; align-items: center; gap: 4px; min-width: 32px; height: 32px; padding: 0 8px;
      justify-content: center; border: 0; border-radius: 16px; cursor: pointer;
      background: rgba(255,255,255,.88); box-shadow: 0 1px 4px rgba(0,0,0,.3);
    }
    .punto { display: inline-block; width: 12px; height: 12px; border-radius: 50%; flex: none; }
    .punto.buena { background: #2e9e4f; }
    .punto.debil { background: #f2b200; }
    .punto.sin-red { background: #d32f2f; }
    .contador, .aviso { font-size: 12px; font-weight: 700; color: #333; line-height: 1; }
    .aviso { color: #d32f2f; }
    .detalle {
      position: absolute; top: 38px; left: 50%; transform: translateX(-50%);
      width: min(300px, calc(100vw - 16px)); padding: 10px 12px; border-radius: 10px;
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
