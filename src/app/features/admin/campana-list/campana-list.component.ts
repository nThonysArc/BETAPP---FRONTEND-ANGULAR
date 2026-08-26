import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { forkJoin } from 'rxjs';

import { CampanaService } from '../../../core/services/campana.service';
import { ProductoService } from '../../../core/services/producto.service';
import { Campana, CampanaRequest } from '../../../core/models/campana.model';
import { Producto } from '../../../core/models/producto.model';
import { CampanaFormDialogComponent } from './campana-form-dialog.component';
import { ConfirmDialogComponent } from '../../../shared/confirm-dialog/confirm-dialog.component';
import { LoadingSpinnerComponent } from '../../../shared/loading-spinner/loading-spinner.component';

@Component({
  selector: 'app-campana-list',
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
  templateUrl: './campana-list.component.html',
  styleUrl: './campana-list.component.scss'
})
export class CampanaListComponent {
  private readonly campanaService = inject(CampanaService);
  private readonly productoService = inject(ProductoService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);

  readonly columnas = ['nombre', 'producto', 'anio', 'fechaInicio', 'fechaFin', 'activa', 'acciones'];
  readonly campanas = signal<Campana[]>([]);
  readonly productos = signal<Producto[]>([]);
  readonly cargando = signal(true);
  readonly mostrarInactivas = signal(false);

  constructor() {
    this.cargarDatos();
  }

  onToggleMostrarInactivas(valor: boolean): void {
    this.mostrarInactivas.set(valor);
    this.cargarDatos();
  }

  private cargarDatos(): void {
    this.cargando.set(true);
    forkJoin({
      campanas: this.campanaService.listar(this.mostrarInactivas()),
      productos: this.productoService.listar()
    }).subscribe({
      next: ({ campanas, productos }) => {
        this.campanas.set(campanas);
        this.productos.set(productos);
        this.cargando.set(false);
      },
      error: () => {
        this.cargando.set(false);
        this.snackBar.open('No se pudieron cargar las campanas', 'Cerrar', { duration: 4000 });
      }
    });
  }

  abrirNuevaCampana(): void {
    const ref = this.dialog.open(CampanaFormDialogComponent, {
      width: '480px',
      data: { campana: null, productos: this.productos() }
    });

    ref.afterClosed().subscribe((request: CampanaRequest | null) => {
      if (!request) return;

      this.campanaService.crear(request).subscribe({
        next: () => {
          this.snackBar.open('Campana creada', 'Cerrar', { duration: 3000 });
          this.cargarDatos();
        },
        error: (err) => {
          this.snackBar.open(err.error?.message ?? 'Error al crear la campana', 'Cerrar', { duration: 4000 });
        }
      });
    });
  }

  editarCampana(campana: Campana): void {
    const ref = this.dialog.open(CampanaFormDialogComponent, {
      width: '480px',
      data: { campana, productos: this.productos() }
    });

    ref.afterClosed().subscribe((request: CampanaRequest | null) => {
      if (!request) return;

      this.campanaService.actualizar(campana.id, request).subscribe({
        next: () => {
          this.snackBar.open('Campana actualizada', 'Cerrar', { duration: 3000 });
          this.cargarDatos();
        },
        error: (err) => {
          this.snackBar.open(err.error?.message ?? 'Error al actualizar la campana', 'Cerrar', { duration: 4000 });
        }
      });
    });
  }

  verMaquinas(campana: Campana): void {
    this.router.navigate(['/admin/campanas', campana.id, 'maquinas']);
  }

  verProcesoDeHoy(campana: Campana): void {
    this.router.navigate(['/procesos', campana.id]);
  }

  verHistorial(campana: Campana): void {
    this.router.navigate(['/procesos/historial', campana.id]);
  }

  desactivar(campana: Campana): void {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: '360px',
      data: {
        titulo: 'Desactivar campana',
        mensaje: `Desactivar la campana "${campana.nombre}"?`,
        textoConfirmar: 'Desactivar',
        color: 'warn'
      }
    });

    ref.afterClosed().subscribe((confirmado: boolean) => {
      if (!confirmado) return;

      this.campanaService.desactivar(campana.id).subscribe({
        next: () => {
          this.snackBar.open('Campana desactivada', 'Cerrar', { duration: 3000 });
          this.cargarDatos();
        },
        error: () => {
          this.snackBar.open('Error al desactivar la campana', 'Cerrar', { duration: 4000 });
        }
      });
    });
  }

  reactivar(campana: Campana): void {
    this.campanaService.reactivar(campana.id).subscribe({
      next: () => {
        this.snackBar.open('Campana reactivada', 'Cerrar', { duration: 3000 });
        this.cargarDatos();
      },
      error: (err) => {
        this.snackBar.open(err.error?.message ?? 'Error al reactivar la campana', 'Cerrar', { duration: 4000 });
      }
    });
  }

  volver(): void {
    this.router.navigate(['/']);
  }
}
