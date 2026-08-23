import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

export interface ConfirmDialogData {
  titulo: string;
  mensaje: string;
  textoConfirmar?: string;
  textoCancelar?: string;
  /** 'warn' pinta el boton de confirmar en rojo, para acciones destructivas. */
  color?: 'primary' | 'warn';
}

/**
 * Reemplaza los confirm() nativos del navegador (feos, inconsistentes entre
 * navegadores, no se pueden estilizar) por un dialogo de Material.
 * Uso: dialog.open(ConfirmDialogComponent, { data }).afterClosed()
 *      devuelve true si el usuario confirmo, false/undefined si cancelo.
 */
@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>{{ data.titulo }}</h2>
    <mat-dialog-content>{{ data.mensaje }}</mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="dialogRef.close(false)">
        {{ data.textoCancelar ?? 'Cancelar' }}
      </button>
      <button mat-flat-button [color]="data.color ?? 'primary'" (click)="dialogRef.close(true)">
        {{ data.textoConfirmar ?? 'Confirmar' }}
      </button>
    </mat-dialog-actions>
  `
})
export class ConfirmDialogComponent {
  readonly dialogRef = inject(MatDialogRef<ConfirmDialogComponent>);
  readonly data = inject<ConfirmDialogData>(MAT_DIALOG_DATA);
}
