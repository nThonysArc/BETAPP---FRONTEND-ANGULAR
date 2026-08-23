import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';

import { MaquinaService } from '../../../core/services/maquina.service';
import { CampanaService } from '../../../core/services/campana.service';
import { Maquina, MaquinaRequest } from '../../../core/models/maquina.model';
import { MaquinaFormDialogComponent } from './maquina-form-dialog.component';
import { ConfirmDialogComponent } from '../../../shared/confirm-dialog/confirm-dialog.component';
import { LoadingSpinnerComponent } from '../../../shared/loading-spinner/loading-spinner.component';

@Component({
  selector: 'app-maquina-list',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatDialogModule,
    MatSnackBarModule,
    MatToolbarModule,
    MatSlideToggleModule,
    LoadingSpinnerComponent
  ],
  templateUrl: './maquina-list.component.html',
  styleUrl: './maquina-list.component.scss'
})
export class MaquinaListComponent {
  private readonly maquinaService = inject(MaquinaService);
  private readonly campanaService = inject(CampanaService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly columnas = ['nombre', 'orden', 'supervisor', 'activo', 'acciones'];
  readonly maquinas = signal<Maquina[]>([]);
  readonly cargando = signal(true);
  readonly nombreCampana = signal<string>('');
  readonly mostrarInactivas = signal(false);

  private readonly campanaId = Number(this.route.snapshot.paramMap.get('campanaId'));

  constructor() {
    this.cargarDatos();
  }

  onToggleMostrarInactivas(valor: boolean): void {
    this.mostrarInactivas.set(valor);
    this.cargarDatos();
  }

  private cargarDatos(): void {
    this.cargando.set(true);

    this.campanaService.obtener(this.campanaId).subscribe({
      next: (campana) => this.nombreCampana.set(campana.nombre)
    });

    this.maquinaService.listarPorCampana(this.campanaId, this.mostrarInactivas()).subscribe({
      next: (maquinas) => {
        this.maquinas.set(maquinas);
        this.cargando.set(false);
      },
      error: () => {
        this.cargando.set(false);
        this.snackBar.open('No se pudieron cargar las maquinas', 'Cerrar', { duration: 4000 });
      }
    });
  }

  abrirNuevaMaquina(): void {
    const ref = this.dialog.open(MaquinaFormDialogComponent, {
      width: '420px',
      data: { maquina: null, campanaId: this.campanaId }
    });

    ref.afterClosed().subscribe((request: MaquinaRequest | null) => {
      if (!request) return;

      this.maquinaService.crear(request).subscribe({
        next: () => {
          this.snackBar.open('Maquina creada', 'Cerrar', { duration: 3000 });
          this.cargarDatos();
        },
        error: (err) => {
          this.snackBar.open(err.error?.message ?? 'Error al crear la maquina', 'Cerrar', { duration: 4000 });
        }
      });
    });
  }

  verKatos(maquina: Maquina): void {
    this.router.navigate(['/admin/maquinas', maquina.id, 'katos']);
  }

  editarMaquina(maquina: Maquina): void {
    const ref = this.dialog.open(MaquinaFormDialogComponent, {
      width: '420px',
      data: { maquina, campanaId: this.campanaId }
    });

    ref.afterClosed().subscribe((request: MaquinaRequest | null) => {
      if (!request) return;

      this.maquinaService.actualizar(maquina.id, request).subscribe({
        next: () => {
          this.snackBar.open('Maquina actualizada', 'Cerrar', { duration: 3000 });
          this.cargarDatos();
        },
        error: (err) => {
          this.snackBar.open(err.error?.message ?? 'Error al actualizar la maquina', 'Cerrar', { duration: 4000 });
        }
      });
    });
  }

  desactivar(maquina: Maquina): void {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: '360px',
      data: {
        titulo: 'Desactivar maquina',
        mensaje: `Desactivar la maquina "${maquina.nombre}"?`,
        textoConfirmar: 'Desactivar',
        color: 'warn'
      }
    });

    ref.afterClosed().subscribe((confirmado: boolean) => {
      if (!confirmado) return;

      this.maquinaService.desactivar(maquina.id).subscribe({
        next: () => {
          this.snackBar.open('Maquina desactivada', 'Cerrar', { duration: 3000 });
          this.cargarDatos();
        },
        error: () => {
          this.snackBar.open('Error al desactivar la maquina', 'Cerrar', { duration: 4000 });
        }
      });
    });
  }

  reactivar(maquina: Maquina): void {
    this.maquinaService.reactivar(maquina.id).subscribe({
      next: () => {
        this.snackBar.open('Maquina reactivada', 'Cerrar', { duration: 3000 });
        this.cargarDatos();
      },
      error: () => {
        this.snackBar.open('Error al reactivar la maquina', 'Cerrar', { duration: 4000 });
      }
    });
  }

  volver(): void {
    this.router.navigate(['/admin/campanas']);
  }
}
