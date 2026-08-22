import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatButtonModule } from '@angular/material/button';

import { Campana, CampanaRequest } from '../../../core/models/campana.model';
import { Producto } from '../../../core/models/producto.model';
import { toIsoDateString } from '../../../core/utils/date.util';

export interface CampanaFormDialogData {
  campana: Campana | null; // null = creando nueva, con valor = editando
  productos: Producto[];
}

@Component({
  selector: 'app-campana-form-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatButtonModule
  ],
  templateUrl: './campana-form-dialog.component.html',
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
export class CampanaFormDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly dialogRef = inject(MatDialogRef<CampanaFormDialogComponent>);
  readonly data = inject<CampanaFormDialogData>(MAT_DIALOG_DATA);

  readonly esEdicion = this.data.campana !== null;

  readonly form = this.fb.group({
    productoId: [this.data.campana?.productoId ?? null, Validators.required],
    nombre: [this.data.campana?.nombre ?? '', Validators.required],
    anio: [this.data.campana?.anio ?? new Date().getFullYear(), Validators.required],
    fechaInicio: [
      this.data.campana ? new Date(this.data.campana.fechaInicio) : null,
      Validators.required
    ],
    fechaFin: [this.data.campana?.fechaFin ? new Date(this.data.campana.fechaFin) : null]
  });

  guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();

    const request: CampanaRequest = {
      productoId: raw.productoId!,
      nombre: raw.nombre!,
      anio: raw.anio!,
      fechaInicio: toIsoDateString(raw.fechaInicio!),
      fechaFin: raw.fechaFin ? toIsoDateString(raw.fechaFin) : null
    };

    this.dialogRef.close(request);
  }

  cancelar(): void {
    this.dialogRef.close(null);
  }
}
