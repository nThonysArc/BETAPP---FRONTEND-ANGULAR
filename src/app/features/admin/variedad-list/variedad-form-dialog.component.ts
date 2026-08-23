import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';

import { Variedad, VariedadRequest } from '../../../core/models/variedad.model';

export interface VariedadFormDialogData {
  variedad: Variedad | null;
  productoId: number;
}

@Component({
  selector: 'app-variedad-form-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule],
  templateUrl: './variedad-form-dialog.component.html',
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
export class VariedadFormDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly dialogRef = inject(MatDialogRef<VariedadFormDialogComponent>);
  readonly data = inject<VariedadFormDialogData>(MAT_DIALOG_DATA);

  readonly esEdicion = this.data.variedad !== null;

  readonly form = this.fb.group({
    nombre: [this.data.variedad?.nombre ?? '', Validators.required],
    orden: [this.data.variedad?.orden ?? 0, [Validators.required, Validators.min(0)]]
  });

  guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();

    const request: VariedadRequest = {
      productoId: this.data.productoId,
      nombre: raw.nombre!,
      orden: raw.orden!
    };

    this.dialogRef.close(request);
  }

  cancelar(): void {
    this.dialogRef.close(null);
  }
}
