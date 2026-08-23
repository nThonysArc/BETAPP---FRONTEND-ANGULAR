import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { HttpErrorResponse } from '@angular/common/http';

import { ProcesoDiarioService } from '../../../core/services/proceso-diario.service';
import { CorteService } from '../../../core/services/corte.service';
import { ProcesoDiario } from '../../../core/models/proceso-diario.model';
import { Corte } from '../../../core/models/corte.model';
import { toIsoDateString } from '../../../core/utils/date.util';

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
    MatSnackBarModule
  ],
  templateUrl: './proceso-detalle.component.html',
  styleUrl: './proceso-detalle.component.scss'
})
export class ProcesoDetalleComponent {
  private readonly procesoDiarioService = inject(ProcesoDiarioService);
  private readonly corteService = inject(CorteService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly columnas = ['numeroCorte', 'horaInicio', 'horaFin', 'jabas', 'peso', 'estado', 'acciones'];
  readonly campanaId = Number(this.route.snapshot.paramMap.get('campanaId'));
  readonly proceso = signal<ProcesoDiario | null>(null);
  readonly cortes = signal<Corte[]>([]);
  readonly cargando = signal(true);
  readonly buscandoProceso = signal(true);

  private readonly fechaHoy = toIsoDateString(new Date());

  constructor() {
    this.buscarProcesoDeHoy();
  }

  private buscarProcesoDeHoy(): void {
    this.buscandoProceso.set(true);

    this.procesoDiarioService.buscarPorCampanaYFecha(this.campanaId, this.fechaHoy).subscribe({
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
    this.procesoDiarioService.crear({ campanaId: this.campanaId, fecha: this.fechaHoy }).subscribe({
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

  cerrarProceso(): void {
    const proceso = this.proceso();
    if (!proceso) return;

    if (!confirm('Cerrar el proceso del dia? Despues de cerrarlo, editar cualquier corte exigira indicar un motivo.')) {
      return;
    }

    this.procesoDiarioService.cerrar(proceso.id).subscribe({
      next: (actualizado) => {
        this.proceso.set(actualizado);
        this.snackBar.open('Proceso cerrado', 'Cerrar', { duration: 3000 });
      },
      error: (err) => {
        this.snackBar.open(err.error?.message ?? 'Error al cerrar el proceso', 'Cerrar', { duration: 4000 });
      }
    });
  }

  volver(): void {
    this.router.navigate(['/admin/campanas']);
  }
}
