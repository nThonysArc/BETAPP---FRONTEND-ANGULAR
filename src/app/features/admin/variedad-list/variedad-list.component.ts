import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';

import { VariedadService } from '../../../core/services/variedad.service';
import { ProductoService } from '../../../core/services/producto.service';
import { Variedad, VariedadRequest } from '../../../core/models/variedad.model';
import { Producto } from '../../../core/models/producto.model';
import { VariedadFormDialogComponent } from './variedad-form-dialog.component';
import { ConfirmDialogComponent } from '../../../shared/confirm-dialog/confirm-dialog.component';
import { LoadingSpinnerComponent } from '../../../shared/loading-spinner/loading-spinner.component';

@Component({
  selector: 'app-variedad-list',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatChipsModule,
    MatSelectModule,
    MatFormFieldModule,
    MatDialogModule,
    MatSnackBarModule,
    MatSlideToggleModule,
    LoadingSpinnerComponent
  ],
  templateUrl: './variedad-list.component.html',
  styleUrl: './variedad-list.component.scss'
})
export class VariedadListComponent {
  private readonly fb = inject(FormBuilder);
  private readonly variedadService = inject(VariedadService);
  private readonly productoService = inject(ProductoService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);

  readonly columnas = ['nombre', 'orden', 'activo', 'acciones'];
  readonly productos = signal<Producto[]>([]);
  readonly variedades = signal<Variedad[]>([]);
  readonly cargando = signal(true);
  readonly mostrarInactivas = signal(false);

  readonly productoControl = this.fb.control<number | null>(null);

  constructor() {
    this.productoService.listar().subscribe({
      next: (productos) => {
        this.productos.set(productos);
        if (productos.length > 0) {
          this.productoControl.setValue(productos[0].id);
          this.cargarVariedades();
        } else {
          this.cargando.set(false);
        }
      },
      error: () => {
        this.cargando.set(false);
        this.snackBar.open('Error al cargar productos', 'Cerrar', { duration: 4000 });
      }
    });
  }

  onProductoChange(): void {
    this.cargarVariedades();
  }

  onToggleMostrarInactivas(valor: boolean): void {
    this.mostrarInactivas.set(valor);
    this.cargarVariedades();
  }

  private cargarVariedades(): void {
    const productoId = this.productoControl.value;
    if (!productoId) return;

    this.cargando.set(true);
    this.variedadService.listarPorProducto(productoId, this.mostrarInactivas()).subscribe({
      next: (variedades) => {
        this.variedades.set(variedades);
        this.cargando.set(false);
      },
      error: () => {
        this.cargando.set(false);
        this.snackBar.open('Error al cargar variedades', 'Cerrar', { duration: 4000 });
      }
    });
  }

  abrirNuevaVariedad(): void {
    const productoId = this.productoControl.value;
    if (!productoId) return;

    const ref = this.dialog.open(VariedadFormDialogComponent, {
      width: '400px',
      data: { variedad: null, productoId }
    });

    ref.afterClosed().subscribe((request: VariedadRequest | null) => {
      if (!request) return;

      this.variedadService.crear(request).subscribe({
        next: () => {
          this.snackBar.open('Variedad creada', 'Cerrar', { duration: 3000 });
          this.cargarVariedades();
        },
        error: (err) => {
          this.snackBar.open(err.error?.message ?? 'Error al crear la variedad', 'Cerrar', { duration: 4000 });
        }
      });
    });
  }

  editarVariedad(variedad: Variedad): void {
    const ref = this.dialog.open(VariedadFormDialogComponent, {
      width: '400px',
      data: { variedad, productoId: variedad.productoId }
    });

    ref.afterClosed().subscribe((request: VariedadRequest | null) => {
      if (!request) return;

      this.variedadService.actualizar(variedad.id, request).subscribe({
        next: () => {
          this.snackBar.open('Variedad actualizada', 'Cerrar', { duration: 3000 });
          this.cargarVariedades();
        },
        error: (err) => {
          this.snackBar.open(err.error?.message ?? 'Error al actualizar la variedad', 'Cerrar', { duration: 4000 });
        }
      });
    });
  }

  desactivar(variedad: Variedad): void {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: '360px',
      data: {
        titulo: 'Desactivar variedad',
        mensaje: `Desactivar la variedad "${variedad.nombre}"?`,
        textoConfirmar: 'Desactivar',
        color: 'warn'
      }
    });

    ref.afterClosed().subscribe((confirmado: boolean) => {
      if (!confirmado) return;

      this.variedadService.desactivar(variedad.id).subscribe({
        next: () => {
          this.snackBar.open('Variedad desactivada', 'Cerrar', { duration: 3000 });
          this.cargarVariedades();
        },
        error: () => {
          this.snackBar.open('Error al desactivar la variedad', 'Cerrar', { duration: 4000 });
        }
      });
    });
  }

  reactivar(variedad: Variedad): void {
    this.variedadService.reactivar(variedad.id).subscribe({
      next: () => {
        this.snackBar.open('Variedad reactivada', 'Cerrar', { duration: 3000 });
        this.cargarVariedades();
      },
      error: () => {
        this.snackBar.open('Error al reactivar la variedad', 'Cerrar', { duration: 4000 });
      }
    });
  }

  volver(): void {
    this.router.navigate(['/']);
  }
}
