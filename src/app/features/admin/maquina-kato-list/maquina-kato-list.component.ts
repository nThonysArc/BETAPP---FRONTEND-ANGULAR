import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';

import { MaquinaKatoService } from '../../../core/services/maquina-kato.service';
import { MaquinaKato, MaquinaKatoRequest } from '../../../core/models/maquina-kato.model';
import { MaquinaKatoFormDialogComponent } from './maquina-kato-form-dialog.component';

@Component({
  selector: 'app-maquina-kato-list',
  standalone: true,
  imports: [
    CommonModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatChipsModule,
    MatDialogModule,
    MatSnackBarModule,
    MatSlideToggleModule
  ],
  templateUrl: './maquina-kato-list.component.html',
  styleUrl: './maquina-kato-list.component.scss'
})
export class MaquinaKatoListComponent {
  private readonly maquinaKatoService = inject(MaquinaKatoService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly columnas = ['nombre', 'orden', 'activo', 'acciones'];
  readonly katos = signal<MaquinaKato[]>([]);
  readonly cargando = signal(true);
  readonly mostrarInactivos = signal(false);

  private readonly maquinaId = Number(this.route.snapshot.paramMap.get('maquinaId'));

  constructor() {
    this.cargarKatos();
  }

  onToggleMostrarInactivos(valor: boolean): void {
    this.mostrarInactivos.set(valor);
    this.cargarKatos();
  }

  private cargarKatos(): void {
    this.cargando.set(true);
    this.maquinaKatoService.listarPorMaquina(this.maquinaId, this.mostrarInactivos()).subscribe({
      next: (katos) => {
        this.katos.set(katos);
        this.cargando.set(false);
      },
      error: () => {
        this.cargando.set(false);
        this.snackBar.open('Error al cargar los katos', 'Cerrar', { duration: 4000 });
      }
    });
  }

  abrirNuevoKato(): void {
    const ref = this.dialog.open(MaquinaKatoFormDialogComponent, {
      width: '400px',
      data: { kato: null, maquinaId: this.maquinaId }
    });

    ref.afterClosed().subscribe((request: MaquinaKatoRequest | null) => {
      if (!request) return;

      this.maquinaKatoService.crear(request).subscribe({
        next: () => {
          this.snackBar.open('Kato creado', 'Cerrar', { duration: 3000 });
          this.cargarKatos();
        },
        error: (err) => {
          this.snackBar.open(err.error?.message ?? 'Error al crear el kato', 'Cerrar', { duration: 4000 });
        }
      });
    });
  }

  editarKato(kato: MaquinaKato): void {
    const ref = this.dialog.open(MaquinaKatoFormDialogComponent, {
      width: '400px',
      data: { kato, maquinaId: this.maquinaId }
    });

    ref.afterClosed().subscribe((request: MaquinaKatoRequest | null) => {
      if (!request) return;

      this.maquinaKatoService.actualizar(kato.id, request).subscribe({
        next: () => {
          this.snackBar.open('Kato actualizado', 'Cerrar', { duration: 3000 });
          this.cargarKatos();
        },
        error: (err) => {
          this.snackBar.open(err.error?.message ?? 'Error al actualizar el kato', 'Cerrar', { duration: 4000 });
        }
      });
    });
  }

  desactivar(kato: MaquinaKato): void {
    if (!confirm(`Desactivar el kato "${kato.nombre}"?`)) return;

    this.maquinaKatoService.desactivar(kato.id).subscribe({
      next: () => {
        this.snackBar.open('Kato desactivado', 'Cerrar', { duration: 3000 });
        this.cargarKatos();
      },
      error: () => {
        this.snackBar.open('Error al desactivar el kato', 'Cerrar', { duration: 4000 });
      }
    });
  }

  reactivar(kato: MaquinaKato): void {
    this.maquinaKatoService.reactivar(kato.id).subscribe({
      next: () => {
        this.snackBar.open('Kato reactivado', 'Cerrar', { duration: 3000 });
        this.cargarKatos();
      },
      error: () => {
        this.snackBar.open('Error al reactivar el kato', 'Cerrar', { duration: 4000 });
      }
    });
  }

  volver(): void {
    this.router.navigate(['/admin/campanas']);
  }
}
