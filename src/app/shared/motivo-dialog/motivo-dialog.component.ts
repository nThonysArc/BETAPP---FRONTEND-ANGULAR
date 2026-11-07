import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

export interface MotivoDialogData {
  titulo: string;
  mensaje: string;
  textoConfirmar?: string;
  color?: 'primary' | 'warn';
}

/**
 * Confirmacion que ademas exige escribir un motivo (acciones destructivas que quedan auditadas).
 * Devuelve el motivo (sin espacios sobrantes) al confirmar, o undefined si se cancela.
 */
@Component({
  selector: 'app-motivo-dialog',
  standalone: true,
  imports: [FormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule],
  template: `
    <h2 mat-dialog-title>{{ data.titulo }}</h2>
    <mat-dialog-content>
      <p>{{ data.mensaje }}</p>
      <mat-form-field appearance="outline" class="motivo">
        <mat-label>Motivo</mat-label>
        <textarea matInput rows="3" maxlength="300" [ngModel]="motivo()" (ngModelChange)="motivo.set($event)"
                  placeholder="Ej.: corte registrado por error"></textarea>
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="dialogRef.close()">Cancelar</button>
      <button mat-flat-button [color]="data.color ?? 'primary'" [disabled]="!motivo().trim()"
              (click)="dialogRef.close(motivo().trim())">
        {{ data.textoConfirmar ?? 'Confirmar' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: ['.motivo { width: 100%; }']
})
export class MotivoDialogComponent {
  readonly dialogRef = inject(MatDialogRef<MotivoDialogComponent, string>);
  readonly data = inject<MotivoDialogData>(MAT_DIALOG_DATA);
  readonly motivo = signal('');
}
