import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';

import { Maquina, MaquinaRequest } from '../../../core/models/maquina.model';

export interface MaquinaFormDialogData {
  maquina: Maquina | null;
  campanaId: number;
}

@Component({
  selector: 'app-maquina-form-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule],
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
  readonly data = inject<MaquinaFormDialogData>(MAT_DIALOG_DATA);

  readonly esEdicion = this.data.maquina !== null;

  readonly form = this.fb.group({
    nombre: [this.data.maquina?.nombre ?? '', Validators.required],
    orden: [this.data.maquina?.orden ?? 0, [Validators.required, Validators.min(0)]]
  });

  guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();

    const request: MaquinaRequest = {
      campanaId: this.data.campanaId,
      nombre: raw.nombre!,
      orden: raw.orden!
    };

    this.dialogRef.close(request);
  }

  cancelar(): void {
    this.dialogRef.close(null);
  }
}
