import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';

import { RolUsuario } from '../../../core/models/auth.model';
import {
  CatalogoPermisos,
  PermisoItem,
  UsuarioAdmin,
  UsuarioAdminRequest
} from '../../../core/models/usuario-admin.model';

export interface UsuarioFormDialogData {
  usuario: UsuarioAdmin | null;
  catalogo: CatalogoPermisos;
}

interface ModuloPermisos {
  modulo: string;
  permisos: PermisoItem[];
}

/**
 * Alta/edicion de usuario con su checklist de permisos agrupada por modulo.
 *
 * La checklist respeta dependencias: marcar "Crear cortes" marca tambien "Ver cortes", "Ver proceso"
 * y "Ver materia prima" (sin eso la pantalla no funcionaria); desmarcar "Ver cortes" desmarca todo
 * lo que lo necesita. El backend vuelve a completar las dependencias al guardar.
 */
@Component({
  selector: 'app-usuario-form-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatCheckboxModule,
    MatSlideToggleModule
  ],
  template: `
    <h2 mat-dialog-title>{{ esEdicion ? 'Editar usuario' : 'Nuevo usuario' }}</h2>

    <mat-dialog-content>
      <form [formGroup]="form" class="form-grid">
        <mat-form-field appearance="outline">
          <mat-label>Nombre completo</mat-label>
          <input matInput formControlName="nombreCompleto" />
          @if (form.get('nombreCompleto')?.hasError('required') && form.get('nombreCompleto')?.touched) {
            <mat-error>Requerido</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Email (usuario de acceso)</mat-label>
          <input matInput type="email" formControlName="email" autocomplete="off" />
          @if (form.get('email')?.hasError('email')) {
            <mat-error>Email invalido</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>{{ esEdicion ? 'Nueva contrasena (opcional)' : 'Contrasena (min. 8 caracteres)' }}</mat-label>
          <input matInput type="password" formControlName="password" autocomplete="new-password" />
          @if (form.get('password')?.hasError('minlength')) {
            <mat-error>Minimo 8 caracteres</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Rol base</mat-label>
          <mat-select formControlName="rol" (selectionChange)="onRolChange($event.value)">
            @for (r of roles; track r.valor) {
              <mat-option [value]="r.valor">{{ r.etiqueta }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        @if (esEdicion) {
          <mat-slide-toggle formControlName="activo">Usuario activo</mat-slide-toggle>
        }
      </form>

      <div class="cabecera-permisos">
        <h3>Permisos</h3>
        @if (!esSuperAdmin()) {
          <button mat-button type="button" (click)="aplicarPlantilla()">Aplicar plantilla del rol</button>
        }
      </div>

      @if (esSuperAdmin()) {
        <p class="nota">El super admin tiene todos los permisos y no se puede restringir.</p>
      } @else {
        @for (grupo of modulos; track grupo.modulo) {
          <div class="modulo">
            <div class="modulo-titulo">{{ grupo.modulo }}</div>
            @for (p of grupo.permisos; track p.codigo) {
              <div class="permiso">
                <mat-checkbox [checked]="marcados().has(p.codigo)" (change)="alternar(p, $event.checked)">
                  {{ p.accion }}
                </mat-checkbox>
                <span class="descripcion">{{ p.descripcion }}</span>
              </div>
            }
          </div>
        }
        <p class="nota">Al marcar un permiso se marcan solos los que necesita para funcionar.</p>
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button type="button" (click)="cancelar()">Cancelar</button>
      <button mat-flat-button color="primary" type="button" (click)="guardar()">Guardar</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .form-grid { display: flex; flex-direction: column; gap: 8px; padding-top: 8px; }
    .cabecera-permisos { display: flex; align-items: center; justify-content: space-between; margin-top: 8px; }
    h3 { margin: 0; }
    .modulo { margin: 8px 0 12px; }
    .modulo-titulo { font-weight: 600; color: var(--ink); margin-bottom: 2px; }
    .permiso { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    .descripcion { color: var(--ink-muted); font-size: 0.85rem; }
    .nota { color: var(--ink-muted); font-size: 0.85rem; margin: 8px 0 4px; }
  `]
})
export class UsuarioFormDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly dialogRef = inject(MatDialogRef<UsuarioFormDialogComponent>);
  readonly data = inject<UsuarioFormDialogData>(MAT_DIALOG_DATA);

  readonly esEdicion = this.data.usuario !== null;
  readonly roles: { valor: RolUsuario; etiqueta: string }[] = [
    { valor: 'SUPER_ADMIN', etiqueta: 'Super admin (todos los permisos)' },
    { valor: 'ADMIN', etiqueta: 'Administrador' },
    { valor: 'SUPERVISOR', etiqueta: 'Supervisor' },
    { valor: 'OPERADOR', etiqueta: 'Operador' }
  ];

  readonly modulos: ModuloPermisos[] = this.agruparPorModulo(this.data.catalogo.permisos);
  readonly marcados = signal<Set<string>>(new Set(this.data.usuario?.permisos ?? []));

  readonly form = this.fb.group({
    nombreCompleto: [this.data.usuario?.nombreCompleto ?? '', [Validators.required, Validators.maxLength(150)]],
    email: [
      this.data.usuario?.puedeIniciarSesion === false ? '' : (this.data.usuario?.email ?? ''),
      [Validators.email, Validators.maxLength(150)]
    ],
    password: ['', [Validators.minLength(8), Validators.maxLength(100)]],
    rol: [(this.data.usuario?.rol ?? 'OPERADOR') as RolUsuario, Validators.required],
    activo: [this.data.usuario?.activo ?? true]
  });

  constructor() {
    if (!this.esEdicion) {
      this.aplicarPlantilla();
    }
  }

  esSuperAdmin(): boolean {
    return this.form.get('rol')?.value === 'SUPER_ADMIN';
  }

  onRolChange(_rol: RolUsuario): void {
    // Al crear, cambiar el rol precarga su plantilla; al editar no se pisa lo ya marcado.
    if (!this.esEdicion) {
      this.aplicarPlantilla();
    }
  }

  aplicarPlantilla(): void {
    const rol = this.form.get('rol')?.value as RolUsuario;
    this.marcados.set(new Set(this.data.catalogo.plantillas[rol] ?? []));
  }

  alternar(permiso: PermisoItem, marcado: boolean): void {
    const nuevo = new Set(this.marcados());
    if (marcado) {
      this.agregarConDependencias(permiso.codigo, nuevo);
    } else {
      this.quitarConDependientes(permiso.codigo, nuevo);
    }
    this.marcados.set(nuevo);
  }

  private agregarConDependencias(codigo: string, set: Set<string>): void {
    if (set.has(codigo)) return;
    set.add(codigo);
    const item = this.data.catalogo.permisos.find((p) => p.codigo === codigo);
    item?.requiere.forEach((dep) => this.agregarConDependencias(dep, set));
  }

  private quitarConDependientes(codigo: string, set: Set<string>): void {
    if (!set.delete(codigo)) return;
    this.data.catalogo.permisos
      .filter((p) => p.requiere.includes(codigo))
      .forEach((p) => this.quitarConDependientes(p.codigo, set));
  }

  private agruparPorModulo(permisos: PermisoItem[]): ModuloPermisos[] {
    const mapa = new Map<string, PermisoItem[]>();
    permisos.forEach((p) => mapa.set(p.modulo, [...(mapa.get(p.modulo) ?? []), p]));
    return Array.from(mapa, ([modulo, items]) => ({ modulo, permisos: items }));
  }

  guardar(): void {
    const raw = this.form.getRawValue();
    const rol = raw.rol as RolUsuario;
    const tieneEmail = !!raw.email?.trim();
    const tienePassword = !!raw.password?.trim();

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    // Al crear: email y contrasena juntos; solo un supervisor puede existir sin acceso.
    if (!this.esEdicion) {
      const incompleto = tieneEmail !== tienePassword || (!tieneEmail && rol !== 'SUPERVISOR');
      if (incompleto) {
        this.form.get('email')?.setErrors({ required: true });
        this.form.markAllAsTouched();
        return;
      }
    }

    const request: UsuarioAdminRequest = {
      nombreCompleto: raw.nombreCompleto!.trim(),
      email: tieneEmail ? raw.email!.trim() : null,
      password: tienePassword ? raw.password!.trim() : null,
      rol,
      activo: this.esEdicion ? raw.activo : null,
      permisos: rol === 'SUPER_ADMIN' ? [] : Array.from(this.marcados())
    };
    this.dialogRef.close(request);
  }

  cancelar(): void {
    this.dialogRef.close(null);
  }
}
