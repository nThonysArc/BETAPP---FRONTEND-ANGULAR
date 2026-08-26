import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { ProcesoDiarioService } from '../../../core/services/proceso-diario.service';
import { CampanaService } from '../../../core/services/campana.service';
import { ProcesoDiario } from '../../../core/models/proceso-diario.model';
import { LoadingSpinnerComponent } from '../../../shared/loading-spinner/loading-spinner.component';

@Component({
  selector: 'app-proceso-historial',
  standalone: true,
  imports: [
    CommonModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatChipsModule,
    MatSnackBarModule,
    LoadingSpinnerComponent
  ],
  templateUrl: './proceso-historial.component.html',
  styleUrl: './proceso-historial.component.scss'
})
export class ProcesoHistorialComponent {
  private readonly procesoDiarioService = inject(ProcesoDiarioService);
  private readonly campanaService = inject(CampanaService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly columnas = ['fecha', 'estado', 'acciones'];
  readonly campanaId = Number(this.route.snapshot.paramMap.get('campanaId'));
  readonly nombreCampana = signal<string>('');
  readonly procesos = signal<ProcesoDiario[]>([]);
  readonly cargando = signal(true);

  constructor() {
    this.campanaService.obtener(this.campanaId).subscribe({
      next: (campana) => this.nombreCampana.set(campana.nombre)
    });

    this.cargarProcesos();
  }

  private cargarProcesos(): void {
    this.cargando.set(true);
    this.procesoDiarioService.listarPorCampana(this.campanaId).subscribe({
      next: (procesos) => {
        this.procesos.set(procesos);
        this.cargando.set(false);
      },
      error: () => {
        this.cargando.set(false);
        this.snackBar.open('Error al cargar el historial de procesos', 'Cerrar', { duration: 4000 });
      }
    });
  }

  verProceso(proceso: ProcesoDiario): void {
    this.router.navigate(['/procesos/detalle', proceso.id]);
  }

  volver(): void {
    this.router.navigate(['/admin/campanas']);
  }
}
