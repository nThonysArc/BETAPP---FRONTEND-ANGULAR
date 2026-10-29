import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBarModule } from '@angular/material/snack-bar';

import { ReporteService } from '../../../core/services/reporte.service';
import { AvanceHora, AvanceVivoResponse } from '../../../core/models/avance-vivo.model';
import { ReporteCompartirDialogComponent } from '../../../shared/reporte-compartir-dialog/reporte-compartir-dialog.component';
import { LoadingSpinnerComponent } from '../../../shared/loading-spinner/loading-spinner.component';

/** Cada cuanto se pregunta "¿cambio algo?" mientras el proceso esta abierto. */
const INTERVALO_ABIERTO_MS = 10_000;
/** Un proceso cerrado casi no cambia (solo si lo reabren): se pregunta mucho menos. */
const INTERVALO_CERRADO_MS = 60_000;
/** Tope de espera tras errores seguidos (retroceso exponencial). */
const INTERVALO_MAXIMO_MS = 60_000;

/**
 * Avance del dia en vivo (solo lectura).
 *
 * Tiempo real por CONSULTA PERIODICA INTELIGENTE: cada ~10 s se pide solo la "huella" del proceso
 * (una respuesta de pocos bytes) y el avance completo unicamente cuando la huella cambio. Asi 20
 * personas mirando la pantalla no recargan el servidor ni la red del celular. Ademas:
 *  - se pausa si la pestaña esta oculta y consulta de inmediato al volver;
 *  - ante un fallo mantiene lo ultimo mostrado y reintenta con espera creciente;
 *  - si algun dia se cambia a push (SSE/WebSocket), solo cambia el metodo `consultar()`:
 *    la tabla y el resto de la pantalla no se tocan.
 */
@Component({
  selector: 'app-avance-vivo',
  standalone: true,
  imports: [
    CommonModule,
    DecimalPipe,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatSnackBarModule,
    MatDialogModule,
    LoadingSpinnerComponent
  ],
  templateUrl: './avance-vivo.component.html',
  styleUrl: './avance-vivo.component.scss'
})
export class AvanceVivoComponent implements OnInit {
  private readonly reporteService = inject(ReporteService);
  private readonly dialog = inject(MatDialog);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly procesoId = Number(this.route.snapshot.paramMap.get('procesoId'));

  readonly datos = signal<AvanceVivoResponse | null>(null);
  readonly cargando = signal(true);
  /** Error definitivo (sin permiso, proceso inexistente): detiene la consulta. */
  readonly errorFatal = signal<string | null>(null);
  /** Fallo de red pasajero: se conserva lo ultimo mostrado y se sigue reintentando. */
  readonly sinConexion = signal(false);
  readonly pausado = signal(false);
  readonly actualizando = signal(false);
  /** Momento del ultimo chequeo exitoso (aunque no haya habido cambios). */
  readonly ultimoChequeo = signal<Date | null>(null);
  /** Se incrementa cada segundo para refrescar el texto "hace X s". */
  private readonly reloj = signal(Date.now());

  private versionActual: string | null = null;
  private fallosSeguidos = 0;
  private temporizador: ReturnType<typeof setTimeout> | null = null;
  private enCurso = false;
  private destruido = false;

  readonly avance = computed(() => this.datos()?.avance ?? null);

  /** Horas de la mas reciente a la mas antigua: en una pantalla de monitoreo lo nuevo va arriba. */
  readonly horasRecientesPrimero = computed<AvanceHora[]>(() => [...(this.avance()?.horas ?? [])].reverse());

  /** Porcentaje de los kilos a procesar que ya se procesaron (0-100). */
  readonly porcentajeProcesado = computed(() => {
    const a = this.avance();
    if (!a || !a.ingresoKilos) return 0;
    return Math.max(0, Math.min(100, (a.pie.acumuladoKilos / a.ingresoKilos) * 100));
  });

  readonly estadoConexion = computed(() => {
    if (this.pausado()) return 'pausa';
    if (this.sinConexion()) return 'sin-conexion';
    return 'en-vivo';
  });

  readonly haceCuanto = computed(() => {
    const ultimo = this.ultimoChequeo();
    if (!ultimo) return '';
    const seg = Math.max(0, Math.round((this.reloj() - ultimo.getTime()) / 1000));
    if (seg < 5) return 'justo ahora';
    if (seg < 60) return `hace ${seg} s`;
    return `hace ${Math.floor(seg / 60)} min`;
  });

  ngOnInit(): void {
    const reloj = setInterval(() => this.reloj.set(Date.now()), 1000);
    const alCambiarVisibilidad = () => {
      if (!document.hidden && !this.pausado() && !this.errorFatal()) {
        this.consultar(); // volvio a la pestaña: ponerse al dia ya
      }
    };
    document.addEventListener('visibilitychange', alCambiarVisibilidad);

    this.destroyRef.onDestroy(() => {
      this.destruido = true;
      clearInterval(reloj);
      document.removeEventListener('visibilitychange', alCambiarVisibilidad);
      this.cancelarTemporizador();
    });

    this.consultar();
  }

  // ── Consulta periodica ────────────────────────────────────────────────────

  /**
   * Un ciclo: pregunta la huella; si cambio (o es la primera vez) baja el avance completo.
   * Cualquier ciclo termina reprogramando el siguiente.
   */
  consultar(forzar = false): void {
    if (this.enCurso || this.destruido) return;
    this.cancelarTemporizador();
    this.enCurso = true;

    this.reporteService.obtenerVersionAvance(this.procesoId).subscribe({
      next: (v) => {
        this.marcarExito();
        if (forzar || v.version !== this.versionActual) {
          this.descargarAvance();
        } else {
          this.terminarCiclo();
        }
      },
      error: (err: HttpErrorResponse) => this.alFallar(err)
    });
  }

  private descargarAvance(): void {
    this.actualizando.set(true);
    this.reporteService.obtenerAvance(this.procesoId).subscribe({
      next: (resp) => {
        this.versionActual = resp.version;
        this.datos.set(resp);
        this.cargando.set(false);
        this.actualizando.set(false);
        this.marcarExito();
        this.terminarCiclo();
      },
      error: (err: HttpErrorResponse) => {
        this.actualizando.set(false);
        this.alFallar(err);
      }
    });
  }

  private marcarExito(): void {
    this.fallosSeguidos = 0;
    this.sinConexion.set(false);
    this.ultimoChequeo.set(new Date());
  }

  private alFallar(err: HttpErrorResponse): void {
    this.enCurso = false;
    this.cargando.set(false);

    // 401 lo maneja el interceptor (vuelve al login). 403/404: no tiene sentido reintentar.
    if (err.status === 403 || err.status === 404) {
      this.errorFatal.set(
        err.status === 403
          ? 'No tienes permiso para ver el avance de este proceso.'
          : 'No se encontro este proceso.'
      );
      return;
    }

    this.fallosSeguidos++;
    this.sinConexion.set(true);
    this.programar(Math.min(INTERVALO_ABIERTO_MS * 2 ** this.fallosSeguidos, INTERVALO_MAXIMO_MS));
  }

  private terminarCiclo(): void {
    this.enCurso = false;
    const cerrado = this.datos()?.estadoProceso === 'CERRADO';
    this.programar(cerrado ? INTERVALO_CERRADO_MS : INTERVALO_ABIERTO_MS);
  }

  private programar(ms: number): void {
    this.cancelarTemporizador();
    if (this.destruido || this.pausado()) return;
    this.temporizador = setTimeout(() => {
      // Con la pestaña oculta no se gasta red: se reanuda en visibilitychange.
      if (document.hidden) return;
      this.consultar();
    }, ms);
  }

  private cancelarTemporizador(): void {
    if (this.temporizador) {
      clearTimeout(this.temporizador);
      this.temporizador = null;
    }
  }

  // ── Acciones de la pantalla ───────────────────────────────────────────────

  alternarPausa(): void {
    this.pausado.update((p) => !p);
    if (this.pausado()) {
      this.cancelarTemporizador();
    } else {
      this.consultar();
    }
  }

  actualizarAhora(): void {
    this.cancelarTemporizador();
    this.enCurso = false;
    this.consultar(true);
  }

  /** La imagen PNG de siempre, dentro del sistema y lista para compartir por WhatsApp o correo. */
  verImagen(): void {
    this.dialog.open(ReporteCompartirDialogComponent, {
      data: { procesoDiarioId: this.procesoId, fecha: this.avance()?.fecha },
      width: '900px',
      maxWidth: '95vw'
    });
  }

  volver(): void {
    this.router.navigate(['/procesos/detalle', this.procesoId]);
  }

  hora(valor: string | null | undefined): string {
    return valor ? valor.slice(0, 5) : '';
  }
}
