import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { HttpErrorResponse } from '@angular/common/http';

import { ProcesoDiarioService } from '../../../core/services/proceso-diario.service';
import { CorteService } from '../../../core/services/corte.service';
import { ReporteService } from '../../../core/services/reporte.service';
import { ProcesoDiario } from '../../../core/models/proceso-diario.model';
import { Corte } from '../../../core/models/corte.model';
import { toIsoDateString } from '../../../core/utils/date.util';
import { ConfirmDialogComponent } from '../../../shared/confirm-dialog/confirm-dialog.component';
import { LoadingSpinnerComponent } from '../../../shared/loading-spinner/loading-spinner.component';

@Component({
  selector: 'app-proceso-detalle',
  standalone: true,
  imports: [
    CommonModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatChipsModule,
    MatSnackBarModule,
    MatDialogModule,
    LoadingSpinnerComponent
  ],
  templateUrl: './proceso-detalle.component.html',
  styleUrl: './proceso-detalle.component.scss'
})
export class ProcesoDetalleComponent {
  private readonly procesoDiarioService = inject(ProcesoDiarioService);
  private readonly corteService = inject(CorteService);
  private readonly reporteService = inject(ReporteService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly columnas = ['numeroCorte', 'horaInicio', 'horaFin', 'jabas', 'peso', 'acciones'];

  /**
   * Dos formas de llegar a esta pantalla:
   * - '/procesos/:campanaId' -> atajo "proceso de hoy" (busca o permite abrir)
   * - '/procesos/detalle/:procesoId' -> acceso directo a un proceso especifico
   *   (desde el historial), sin importar la fecha ni si esta abierto o cerrado.
   */
  private readonly procesoIdDirecto = this.route.snapshot.paramMap.get('procesoId');
  private readonly campanaIdParam = this.route.snapshot.paramMap.get('campanaId');
  readonly esModoDirecto = this.procesoIdDirecto !== null;
  readonly campanaId = this.campanaIdParam !== null ? Number(this.campanaIdParam) : null;

  readonly proceso = signal<ProcesoDiario | null>(null);
  readonly cortes = signal<Corte[]>([]);
  readonly cargando = signal(true);
  readonly buscandoProceso = signal(true);
  readonly generandoReporte = signal(false);

  private readonly fechaHoy = toIsoDateString(new Date());

  constructor() {
    if (this.esModoDirecto) {
      this.cargarProcesoDirecto(Number(this.procesoIdDirecto));
    } else {
      this.buscarProcesoDeHoy();
    }
  }

  private cargarProcesoDirecto(procesoId: number): void {
    this.buscandoProceso.set(true);

    this.procesoDiarioService.obtener(procesoId).subscribe({
      next: (proceso) => {
        this.proceso.set(proceso);
        this.buscandoProceso.set(false);
        this.cargarCortes(proceso.id);
      },
      error: () => {
        this.buscandoProceso.set(false);
        this.cargando.set(false);
        this.snackBar.open('No se pudo cargar el proceso', 'Cerrar', { duration: 4000 });
      }
    });
  }

  private buscarProcesoDeHoy(): void {
    this.buscandoProceso.set(true);

    this.procesoDiarioService.buscarPorCampanaYFecha(this.campanaId!, this.fechaHoy).subscribe({
      next: (proceso) => {
        this.proceso.set(proceso);
        this.buscandoProceso.set(false);
        this.cargarCortes(proceso.id);
      },
      error: (err: HttpErrorResponse) => {
        this.buscandoProceso.set(false);
        this.cargando.set(false);
        if (err.status !== 404) {
          this.snackBar.open('Error al buscar el proceso del dia', 'Cerrar', { duration: 4000 });
        }
        // 404 es esperado: significa que aun no se ha abierto el proceso de hoy.
      }
    });
  }

  abrirProcesoDeHoy(): void {
    this.procesoDiarioService.crear({ campanaId: this.campanaId!, fecha: this.fechaHoy }).subscribe({
      next: (proceso) => {
        this.proceso.set(proceso);
        this.cargarCortes(proceso.id);
      },
      error: (err) => {
        this.snackBar.open(err.error?.message ?? 'Error al abrir el proceso', 'Cerrar', { duration: 4000 });
      }
    });
  }

  private cargarCortes(procesoDiarioId: number): void {
    this.cargando.set(true);
    this.corteService.listar(procesoDiarioId).subscribe({
      next: (cortes) => {
        this.cortes.set(cortes);
        this.cargando.set(false);
      },
      error: () => {
        this.cargando.set(false);
        this.snackBar.open('Error al cargar los cortes', 'Cerrar', { duration: 4000 });
      }
    });
  }

  nuevoCorte(): void {
    const proceso = this.proceso();
    if (!proceso) return;
    this.router.navigate(['/procesos', proceso.id, 'cortes', 'nuevo']);
  }

  verCorte(corteId: number): void {
    const proceso = this.proceso();
    if (!proceso) return;
    this.router.navigate(['/procesos', proceso.id, 'cortes', corteId, 'editar']);
  }

  verIngreso(): void {
    const proceso = this.proceso();
    if (!proceso) return;
    this.router.navigate(['/procesos', proceso.id, 'ingreso']);
  }

  verReporte(): void {
    const proceso = this.proceso();
    if (!proceso) return;

    this.generandoReporte.set(true);

    this.reporteService.obtenerImagenReporte(proceso.id).subscribe({
      next: (blob) => {
        this.generandoReporte.set(false);
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 30000);
      },
      error: () => {
        this.generandoReporte.set(false);
        this.snackBar.open('Error al generar el reporte', 'Cerrar', { duration: 4000 });
      }
    });
  }

  cerrarProceso(): void {
    const proceso = this.proceso();
    if (!proceso) return;

    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      data: {
        titulo: 'Cerrar proceso del dia',
        mensaje: 'Despues de cerrarlo, editar cualquier corte de este proceso exigira indicar un motivo. Deseas continuar?',
        textoConfirmar: 'Cerrar proceso',
        color: 'warn'
      }
    });

    ref.afterClosed().subscribe((confirmado: boolean) => {
      if (!confirmado) return;

      this.procesoDiarioService.cerrar(proceso.id).subscribe({
        next: (actualizado) => {
          this.proceso.set(actualizado);
          this.snackBar.open('Proceso cerrado', 'Cerrar', { duration: 3000 });
        },
        error: (err) => {
          this.snackBar.open(err.error?.message ?? 'Error al cerrar el proceso', 'Cerrar', { duration: 4000 });
        }
      });
    });
  }

  reabrirProceso(): void {
    const proceso = this.proceso();
    if (!proceso) return;

    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      data: {
        titulo: 'Reabrir proceso del dia',
        mensaje: 'Esto permite volver a agregar cortes nuevos a este dia. Deseas continuar?',
        textoConfirmar: 'Reabrir'
      }
    });

    ref.afterClosed().subscribe((confirmado: boolean) => {
      if (!confirmado) return;

      this.procesoDiarioService.reabrir(proceso.id).subscribe({
        next: (actualizado) => {
          this.proceso.set(actualizado);
          this.snackBar.open('Proceso reabierto', 'Cerrar', { duration: 3000 });
        },
        error: (err) => {
          this.snackBar.open(err.error?.message ?? 'Error al reabrir el proceso', 'Cerrar', { duration: 4000 });
        }
      });
    });
  }

  volver(): void {
    const proceso = this.proceso();
    if (this.esModoDirecto && proceso) {
      this.router.navigate(['/procesos/historial', proceso.campanaId]);
    } else {
      this.router.navigate(['/admin/campanas']);
    }
  }
}
