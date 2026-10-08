import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';

import { SupervisorRequest, UsuarioResumen } from '../../../core/models/usuario.model';

export interface SupervisorFormDialogData {
  supervisor: UsuarioResumen | null;
}

@Component({
  selector: 'app-supervisor-form-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule],
  templateUrl: './supervisor-form-dialog.component.html',
  styles: [`
    .form-grid {
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-width: 320px;
      padding-top: 8px;
    }
    .nota {
      color: var(--ink-muted);
      font-size: 0.85rem;
      margin: 8px 0 4px;
    }
  `]
})
export class SupervisorFormDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly dialogRef = inject(MatDialogRef<SupervisorFormDialogComponent>);
  readonly data = inject<SupervisorFormDialogData>(MAT_DIALOG_DATA);

  readonly esEdicion = this.data.supervisor !== null;

  readonly form = this.fb.group({
    nombreCompleto: [this.data.supervisor?.nombreCompleto ?? '', [Validators.required, Validators.maxLength(150)]],
    email: ['', [Validators.email, Validators.maxLength(150)]],
    password: ['', [Validators.minLength(8), Validators.maxLength(100)]]
  });

  /** Email y contrasena van juntos: o se llenan ambos (acceso al sistema) o ninguno. */
  get accesoIncompleto(): boolean {
    if (this.esEdicion) return false;
    const { email, password } = this.form.getRawValue();
    return !!email?.trim() !== !!password?.trim();
  }

  guardar(): void {
    if (this.form.invalid || this.accesoIncompleto) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();

    const request: SupervisorRequest = {
      nombreCompleto: raw.nombreCompleto!.trim(),
      email: this.esEdicion ? null : raw.email?.trim() || null,
      password: this.esEdicion ? null : raw.password?.trim() || null
    };

    this.dialogRef.close(request);
  }

  cancelar(): void {
    this.dialogRef.close(null);
  }
}
