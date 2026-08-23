import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';

import { MaquinaKato, MaquinaKatoRequest } from '../../../core/models/maquina-kato.model';

export interface MaquinaKatoFormDialogData {
  kato: MaquinaKato | null;
  maquinaId: number;
}

@Component({
  selector: 'app-maquina-kato-form-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule],
  templateUrl: './maquina-kato-form-dialog.component.html',
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
export class MaquinaKatoFormDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly dialogRef = inject(MatDialogRef<MaquinaKatoFormDialogComponent>);
  readonly data = inject<MaquinaKatoFormDialogData>(MAT_DIALOG_DATA);

  readonly esEdicion = this.data.kato !== null;

  readonly form = this.fb.group({
    nombre: [this.data.kato?.nombre ?? '', Validators.required],
    orden: [this.data.kato?.orden ?? 0, [Validators.required, Validators.min(0)]]
  });

  guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();

    const request: MaquinaKatoRequest = {
      maquinaId: this.data.maquinaId,
      nombre: raw.nombre!,
      orden: raw.orden!
    };

    this.dialogRef.close(request);
  }

  cancelar(): void {
    this.dialogRef.close(null);
  }
}
