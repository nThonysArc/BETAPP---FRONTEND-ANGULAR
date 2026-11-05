import { Component, computed, inject, signal } from '@angular/core';
import { MAT_BOTTOM_SHEET_DATA, MatBottomSheetModule, MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Tecla, aplicarTecla, evaluarExpresion, expresionInicial, expresionLegible } from './calculadora-sumas.util';

export interface CalculadoraSumasData {
  etiqueta: string;
  valorInicial: unknown;
}

/** Resultado: el total, o "teclado" si la persona prefiere el teclado normal del celular. */
export type CalculadoraSumasResultado = { total: number } | { teclado: true };

/**
 * Teclado numerico propio para el celular: digitos, "+" y borrar. Se escribe como en Excel
 * (200 + 200 + 200) y el total se ve en vivo. Asi no hay que salir del sistema a usar la calculadora.
 */
@Component({
  selector: 'app-calculadora-sumas',
  standalone: true,
  imports: [MatBottomSheetModule, MatButtonModule, MatIconModule],
  template: `
    <div class="calc">
      <div class="pantalla" aria-live="polite">
        <span class="etiqueta">{{ data.etiqueta }}</span>
        <span class="expresion">{{ legible() || '0' }}</span>
        <strong class="total">= {{ total() }}</strong>
      </div>

      <div class="teclas">
        @for (t of fila1; track t) { <button type="button" (click)="tocar(t)">{{ t }}</button> }
        <button type="button" class="borrar" (click)="tocar('borrar')" aria-label="Borrar">⌫</button>
        @for (t of fila2; track t) { <button type="button" (click)="tocar(t)">{{ t }}</button> }
        <button type="button" class="op" (click)="tocar('*')" aria-label="Multiplicar">×</button>
        @for (t of fila3; track t) { <button type="button" (click)="tocar(t)">{{ t }}</button> }
        <button type="button" class="op" (click)="tocar('-')" aria-label="Restar">−</button>
        <button type="button" class="limpiar" (click)="limpiar()">C</button>
        <button type="button" (click)="tocar('0')">0</button>
        <button type="button" (click)="tocar('.')">.</button>
        <button type="button" class="op mas" (click)="tocar('+')" aria-label="Sumar">+</button>
      </div>

      <div class="acciones">
        <button mat-button type="button" (click)="usarTeclado()">
          <mat-icon>keyboard</mat-icon> Teclado normal
        </button>
        <button mat-flat-button color="primary" type="button" (click)="aplicar()">Aplicar {{ total() }}</button>
      </div>
    </div>
  `,
  styles: [`
    .calc { display: flex; flex-direction: column; gap: 12px; padding-bottom: env(safe-area-inset-bottom, 0px); }
    .pantalla { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; padding: 8px 4px; }
    .etiqueta { align-self: flex-start; font-size: 13px; opacity: .7; }
    .expresion { font-size: 22px; word-break: break-all; text-align: right; min-height: 30px; }
    .total { font-size: 34px; line-height: 1.1; }
    .teclas { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
    .teclas button {
      min-height: 56px; border: 0; border-radius: 12px; font-size: 24px; cursor: pointer;
      background: rgba(127,127,127,.18); color: inherit; touch-action: manipulation;
    }
    .teclas button:active { background: rgba(127,127,127,.38); }
    .teclas .op { background: #1d6a38; color: #fff; font-size: 30px; }
    .teclas .borrar, .teclas .limpiar { background: rgba(163,38,42,.18); }
    .acciones { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
    .acciones [mat-flat-button] { min-height: 48px; font-size: 18px; flex: 1; max-width: 220px; }
  `]
})
export class CalculadoraSumasSheet {
  readonly data = inject<CalculadoraSumasData>(MAT_BOTTOM_SHEET_DATA);
  private readonly ref = inject<MatBottomSheetRef<CalculadoraSumasSheet, CalculadoraSumasResultado>>(MatBottomSheetRef);

  readonly fila1: Tecla[] = ['7', '8', '9'];
  readonly fila2: Tecla[] = ['4', '5', '6'];
  readonly fila3: Tecla[] = ['1', '2', '3'];

  private readonly expresion = signal(expresionInicial(this.data.valorInicial));
  readonly legible = computed(() => expresionLegible(this.expresion()));
  readonly total = computed(() => evaluarExpresion(this.expresion()) ?? 0);

  tocar(tecla: Tecla): void {
    this.expresion.update((e) => aplicarTecla(e, tecla));
  }

  limpiar(): void {
    this.expresion.set('');
  }

  aplicar(): void {
    this.ref.dismiss({ total: this.total() });
  }

  usarTeclado(): void {
    this.ref.dismiss({ teclado: true });
  }
}
