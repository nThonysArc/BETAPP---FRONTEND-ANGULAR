import { HttpClient, HttpContext, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { OfflineStore } from './offline-store.service';
import { EscrituraPendiente } from './offline.model';
import { SALTAR_OFFLINE, esFalloDeRed } from './offline.context';

const INTERVALO_REINTENTO_MS = 20_000;

/**
 * Envia al servidor, en orden (FIFO), lo que se registro sin conexion.
 *
 * Se detiene en el primer problema para no alterar el orden de los cortes (el servidor numera los
 * cortes en el orden en que llegan):
 *  - Sin red / error 5xx / 401: se reintenta solo mas tarde (la cola se conserva intacta, tambien tras
 *    volver a iniciar sesion).
 *  - Error de negocio (400/404/409...): la escritura queda marcada con el mensaje y espera a que la persona
 *    decida reintentar o descartar. Nunca se descarta nada sin avisar.
 */
@Injectable({ providedIn: 'root' })
export class OfflineSyncService {
  private readonly http = inject(HttpClient);
  private readonly store = inject(OfflineStore);

  readonly sincronizando = signal(false);
  /** Sube cada vez que se termina de enviar algo: las pantallas lo observan para recargar datos reales. */
  readonly version = signal(0);
  private enCurso = false;
  private temporizador: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => void this.sincronizar());
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void this.sincronizar();
      });
      setInterval(() => void this.sincronizar(), INTERVALO_REINTENTO_MS);
      void this.sincronizar();
    }
  }

  /** Pide un envio pronto (tras encolar algo o al volver la red). */
  programar(delayMs = 300): void {
    if (this.temporizador) clearTimeout(this.temporizador);
    this.temporizador = setTimeout(() => void this.sincronizar(), delayMs);
  }

  async sincronizar(): Promise<void> {
    if (this.enCurso) return;
    this.enCurso = true;
    this.sincronizando.set(true);
    try {
      await this.store.refrescarPendientes();
      // Cola en orden. Se vuelve a leer en cada vuelta: la persona puede haber editado mientras tanto.
      for (;;) {
        const item = this.store.pendientes()[0];
        if (!item || item.error) break;
        const continuar = await this.enviar(item);
        if (!continuar) break;
      }
    } finally {
      this.enCurso = false;
      this.sincronizando.set(false);
    }
  }

  /** @returns true si se envio y hay que seguir con la siguiente. */
  private async enviar(item: EscrituraPendiente): Promise<boolean> {
    try {
      const respuesta = await firstValueFrom(
        this.http.request(item.metodo, item.url, {
          body: item.cuerpo,
          context: new HttpContext().set(SALTAR_OFFLINE, true)
        })
      );
      this.store.marcarConRed();
      await this.store.aplicarResultado(item, respuesta);
      if (item.seq !== undefined) await this.store.quitarDeCola(item.seq);
      if (this.store.pendientes().length === 0) this.version.update((v) => v + 1);
      return true;
    } catch (e) {
      const err = e as HttpErrorResponse;
      if (esFalloDeRed(err)) {
        this.store.marcarSinRed();
        return false;
      }
      this.store.marcarConRed();
      // 401: el interceptor de autenticacion ya llevo al login; la cola se conserva y sigue al volver.
      // 5xx / 408 / 429: fallo temporal del servidor, se reintenta solo.
      if (err.status === 401 || err.status >= 500 || err.status === 408 || err.status === 429) return false;
      const mensaje = err.error?.message ?? `El servidor rechazo el envio (${err.status})`;
      await this.store.marcarError(item, mensaje);
      return false;
    }
  }

  async reintentar(item: EscrituraPendiente): Promise<void> {
    await this.store.limpiarError(item);
    await this.sincronizar();
  }

  /** Descarta una escritura rechazada. La pantalla vuelve a leer el estado real del servidor. */
  async descartar(item: EscrituraPendiente): Promise<void> {
    if (item.seq !== undefined) await this.store.quitarDeCola(item.seq);
    await this.sincronizar();
  }
}
