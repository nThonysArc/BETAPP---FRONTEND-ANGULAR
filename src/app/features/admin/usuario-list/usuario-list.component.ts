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

import { UsuarioAdminService } from '../../../core/services/usuario-admin.service';
import { CatalogoPermisos, UsuarioAdmin, UsuarioAdminRequest } from '../../../core/models/usuario-admin.model';
import { UsuarioFormDialogComponent } from './usuario-form-dialog.component';
import { LoadingSpinnerComponent } from '../../../shared/loading-spinner/loading-spinner.component';

@Component({
  selector: 'app-usuario-list',
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
    LoadingSpinnerComponent
  ],
  template: `
    <mat-toolbar color="primary">
      <button mat-icon-button (click)="volver()"><mat-icon>arrow_back</mat-icon></button>
      <span>Usuarios y permisos</span>
    </mat-toolbar>

    <div class="contenido">
      <div class="acciones-header">
        <button mat-flat-button color="primary" (click)="abrirFormulario(null)" [disabled]="!catalogo()">
          <mat-icon>person_add</mat-icon>
          Nuevo usuario
        </button>
      </div>

      @if (cargando()) {
        <app-loading-spinner mensaje="Cargando usuarios..." />
      } @else {
        <table mat-table [dataSource]="usuarios()" class="tabla tabla-apilada">
          <ng-container matColumnDef="nombre">
            <th mat-header-cell *matHeaderCellDef>Nombre</th>
            <td mat-cell *matCellDef="let u" data-label="Nombre" data-titulo>{{ u.nombreCompleto }}</td>
          </ng-container>
          <ng-container matColumnDef="email">
            <th mat-header-cell *matHeaderCellDef>Acceso</th>
            <td mat-cell *matCellDef="let u" data-label="Acceso">{{ u.puedeIniciarSesion ? u.email : 'Sin acceso al sistema' }}</td>
          </ng-container>
          <ng-container matColumnDef="rol">
            <th mat-header-cell *matHeaderCellDef>Rol</th>
            <td mat-cell *matCellDef="let u" data-label="Rol">{{ u.rol }}</td>
          </ng-container>
          <ng-container matColumnDef="permisos">
            <th mat-header-cell *matHeaderCellDef>Permisos</th>
            <td mat-cell *matCellDef="let u" data-label="Permisos">
              {{ u.rol === 'SUPER_ADMIN' ? 'Todos' : u.permisos.length + ' de ' + (catalogo()?.permisos?.length ?? '-') }}
            </td>
          </ng-container>
          <ng-container matColumnDef="activo">
            <th mat-header-cell *matHeaderCellDef>Estado</th>
            <td mat-cell *matCellDef="let u" data-label="Estado">
              <mat-chip [highlighted]="u.activo">{{ u.activo ? 'Activo' : 'Inactivo' }}</mat-chip>
            </td>
          </ng-container>
          <ng-container matColumnDef="acciones">
            <th mat-header-cell *matHeaderCellDef></th>
            <td mat-cell *matCellDef="let u" data-acciones>
              <button mat-icon-button (click)="abrirFormulario(u)" title="Editar y ver permisos">
                <mat-icon>edit</mat-icon>
              </button>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="columnas"></tr>
          <tr mat-row *matRowDef="let row; columns: columnas;"></tr>
        </table>
      }
    </div>
  `
})
export class UsuarioListComponent {
  private readonly servicio = inject(UsuarioAdminService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);

  readonly columnas = ['nombre', 'email', 'rol', 'permisos', 'activo', 'acciones'];
  readonly usuarios = signal<UsuarioAdmin[]>([]);
  readonly catalogo = signal<CatalogoPermisos | null>(null);
  readonly cargando = signal(true);

  constructor() {
    this.servicio.catalogo().subscribe({
      next: (c) => this.catalogo.set(c),
      error: () => this.snackBar.open('Error al cargar el catalogo de permisos', 'Cerrar', { duration: 4000 })
    });
    this.cargar();
  }

  private cargar(): void {
    this.cargando.set(true);
    this.servicio.listar().subscribe({
      next: (u) => {
        this.usuarios.set(u);
        this.cargando.set(false);
      },
      error: () => {
        this.cargando.set(false);
        this.snackBar.open('Error al cargar los usuarios', 'Cerrar', { duration: 4000 });
      }
    });
  }

  abrirFormulario(usuario: UsuarioAdmin | null): void {
    const catalogo = this.catalogo();
    if (!catalogo) return;

    const ref = this.dialog.open(UsuarioFormDialogComponent, {
      width: '560px',
      maxHeight: '90vh',
      data: { usuario, catalogo }
    });

    ref.afterClosed().subscribe((request: UsuarioAdminRequest | null) => {
      if (!request) return;
      const operacion = usuario
        ? this.servicio.actualizar(usuario.id, request)
        : this.servicio.crear(request);

      operacion.subscribe({
        next: () => {
          this.snackBar.open(usuario ? 'Usuario actualizado' : 'Usuario creado', 'Cerrar', { duration: 3000 });
          this.cargar();
        },
        error: (err) =>
          this.snackBar.open(err.error?.message ?? 'No se pudo guardar el usuario', 'Cerrar', { duration: 5000 })
      });
    });
  }

  volver(): void {
    this.router.navigate(['/']);
  }
}
