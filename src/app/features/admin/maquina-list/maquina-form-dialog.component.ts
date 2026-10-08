import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { catchError } from 'rxjs/operators';
import { of } from 'rxjs';

import { Maquina, MaquinaRequest } from '../../../core/models/maquina.model';
import { UsuarioResumen } from '../../../core/models/usuario.model';
import { UsuarioService } from '../../../core/services/usuario.service';

export interface MaquinaFormDialogData {
  maquina: Maquina | null;
  campanaId: number;
}

@Component({
  selector: 'app-maquina-form-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatSelectModule],
  templateUrl: './maquina-form-dialog.component.html',
  styles: [`
    .form-grid {
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-width: 320px;
      padding-top: 8px;
    }
  `]
})
export class MaquinaFormDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly dialogRef = inject(MatDialogRef<MaquinaFormDialogComponent>);
  private readonly usuarioService = inject(UsuarioService);
  readonly data = inject<MaquinaFormDialogData>(MAT_DIALOG_DATA);

  readonly supervisores = signal<UsuarioResumen[]>([]);

  readonly esEdicion = this.data.maquina !== null;

  readonly form = this.fb.group({
    nombre: [this.data.maquina?.nombre ?? '', Validators.required],
    orden: [this.data.maquina?.orden ?? 0, [Validators.required, Validators.min(0)]],
    supervisorId: [this.data.maquina?.supervisorId ?? null as number | null]
  });

  constructor() {
    this.usuarioService
      .listarSupervisores()
      .pipe(catchError(() => of([] as UsuarioResumen[])))
      .subscribe((activos) => {
        const opciones = [...activos];
        const actual = this.data.maquina;
        // Si el supervisor actual ya no esta activo se mantiene visible para no borrarlo sin querer.
        if (actual?.supervisorId && !opciones.some((u) => u.id === actual.supervisorId)) {
          opciones.push({
            id: actual.supervisorId,
            nombreCompleto: actual.supervisorNombre ?? `Usuario ${actual.supervisorId}`,
            rol: 'SUPERVISOR'
          });
        }
        this.supervisores.set(opciones);
      });
  }

  guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();

    const request: MaquinaRequest = {
      campanaId: this.data.campanaId,
      nombre: raw.nombre!,
      orden: raw.orden!,
      supervisorId: raw.supervisorId ?? null
    };

    this.dialogRef.close(request);
  }

  cancelar(): void {
    this.dialogRef.close(null);
  }
}
