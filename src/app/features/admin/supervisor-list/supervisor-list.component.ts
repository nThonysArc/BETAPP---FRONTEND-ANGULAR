import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';

import { UsuarioService } from '../../../core/services/usuario.service';
import { SupervisorRequest, UsuarioResumen } from '../../../core/models/usuario.model';
import { SupervisorFormDialogComponent } from './supervisor-form-dialog.component';
import { ConfirmDialogComponent } from '../../../shared/confirm-dialog/confirm-dialog.component';
import { LoadingSpinnerComponent } from '../../../shared/loading-spinner/loading-spinner.component';

@Component({
  selector: 'app-supervisor-list',
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
    MatSlideToggleModule,
    LoadingSpinnerComponent
  ],
  templateUrl: './supervisor-list.component.html',
  styleUrl: './supervisor-list.component.scss'
})
export class SupervisorListComponent {
  private readonly usuarioService = inject(UsuarioService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);

  readonly columnas = ['nombre', 'activo', 'acciones'];
  readonly supervisores = signal<UsuarioResumen[]>([]);
  readonly cargando = signal(true);
  readonly mostrarInactivos = signal(false);

  constructor() {
    this.cargarSupervisores();
  }

  onToggleMostrarInactivos(valor: boolean): void {
    this.mostrarInactivos.set(valor);
    this.cargarSupervisores();
  }

  private cargarSupervisores(): void {
    this.cargando.set(true);
    this.usuarioService.listarSupervisores(this.mostrarInactivos()).subscribe({
      next: (supervisores) => {
        this.supervisores.set(supervisores);
        this.cargando.set(false);
      },
      error: () => {
        this.cargando.set(false);
        this.snackBar.open('Error al cargar los supervisores', 'Cerrar', { duration: 4000 });
      }
    });
  }

  abrirNuevoSupervisor(): void {
    const ref = this.dialog.open(SupervisorFormDialogComponent, {
      width: '440px',
      data: { supervisor: null }
    });

    ref.afterClosed().subscribe((request: SupervisorRequest | null) => {
      if (!request) return;

      this.usuarioService.crearSupervisor(request).subscribe({
        next: () => {
          this.snackBar.open('Supervisor creado', 'Cerrar', { duration: 3000 });
          this.cargarSupervisores();
        },
        error: (err) => {
          this.snackBar.open(err.error?.message ?? 'Error al crear el supervisor', 'Cerrar', { duration: 4000 });
        }
      });
    });
  }

  editarSupervisor(supervisor: UsuarioResumen): void {
    const ref = this.dialog.open(SupervisorFormDialogComponent, {
      width: '440px',
      data: { supervisor }
    });

    ref.afterClosed().subscribe((request: SupervisorRequest | null) => {
      if (!request) return;

      this.usuarioService.actualizarSupervisor(supervisor.id, request).subscribe({
        next: () => {
          this.snackBar.open('Supervisor actualizado', 'Cerrar', { duration: 3000 });
          this.cargarSupervisores();
        },
        error: (err) => {
          this.snackBar.open(err.error?.message ?? 'Error al actualizar el supervisor', 'Cerrar', { duration: 4000 });
        }
      });
    });
  }

  desactivar(supervisor: UsuarioResumen): void {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: '380px',
      data: {
        titulo: 'Desactivar supervisor',
        mensaje: `Desactivar a "${supervisor.nombreCompleto}"? Dejara de aparecer al elegir supervisor, pero se conserva en los cortes ya registrados.`,
        textoConfirmar: 'Desactivar',
        color: 'warn'
      }
    });

    ref.afterClosed().subscribe((confirmado: boolean) => {
      if (!confirmado) return;

      this.usuarioService.desactivar(supervisor.id).subscribe({
        next: () => {
          this.snackBar.open('Supervisor desactivado', 'Cerrar', { duration: 3000 });
          this.cargarSupervisores();
        },
        error: () => {
          this.snackBar.open('Error al desactivar el supervisor', 'Cerrar', { duration: 4000 });
        }
      });
    });
  }

  reactivar(supervisor: UsuarioResumen): void {
    this.usuarioService.reactivar(supervisor.id).subscribe({
      next: () => {
        this.snackBar.open('Supervisor reactivado', 'Cerrar', { duration: 3000 });
        this.cargarSupervisores();
      },
      error: () => {
        this.snackBar.open('Error al reactivar el supervisor', 'Cerrar', { duration: 4000 });
      }
    });
  }

  volver(): void {
    this.router.navigate(['/']);
  }
}
