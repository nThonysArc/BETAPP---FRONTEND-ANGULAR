import { Directive, ElementRef, HostListener, inject, input } from '@angular/core';
import { NgControl } from '@angular/forms';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { CalculadoraSumasResultado, CalculadoraSumasSheet } from './calculadora-sumas.sheet';
import { evaluarExpresion } from './calculadora-sumas.util';

/**
 * Campo de cantidad que acepta operaciones (suma, resta, multiplicacion):
 *  - Celular: abre la calculadora en pantalla en vez del teclado del sistema.
 *  - PC (o "Teclado normal" en el celular): se puede escribir directo "+200+200+200", "1000-150" o
 *    "12*50"; al salir del campo o pulsar Enter se reemplaza por el resultado.
 * Los campos de texto (observaciones) no usan esta directiva.
 *
 * IMPORTANTE: el input NO debe ser type="number" (el navegador bloquearia el "+"); la directiva lo trata
 * como texto con teclado decimal.
 *
 * Uso: <input matInput appCalculadoraSumas="Jabas" formControlName="jabas" />
 */
@Directive({
  selector: 'input[appCalculadoraSumas]',
  standalone: true,
  host: { '[attr.inputmode]': 'tactil && !tecladoNativo ? "none" : "decimal"', autocomplete: 'off' }
})
export class CalculadoraSumasDirective {
  /** Nombre que se muestra en la calculadora. */
  readonly etiqueta = input('Cantidad', { alias: 'appCalculadoraSumas' });

  private readonly el = inject<ElementRef<HTMLInputElement>>(ElementRef);
  private readonly sheet = inject(MatBottomSheet);
  private readonly control = inject(NgControl, { optional: true, self: true });

  readonly tactil = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  tecladoNativo = false;
  private abierta = false;

  @HostListener('focus')
  @HostListener('click')
  abrir(): void {
    if (!this.tactil || this.tecladoNativo || this.abierta) return;
    this.abierta = true;
    const ref = this.sheet.open<CalculadoraSumasSheet, unknown, CalculadoraSumasResultado>(CalculadoraSumasSheet, {
      data: { etiqueta: this.etiqueta(), valorInicial: this.control?.value ?? this.el.nativeElement.value },
      restoreFocus: false
    });
    ref.afterDismissed().subscribe((res) => {
      this.abierta = false;
      if (res && 'total' in res) {
        this.control?.control?.setValue(res.total);
        this.control?.control?.markAsDirty();
        this.control?.control?.markAsTouched();
        this.el.nativeElement.blur();
      } else if (res && 'teclado' in res) {
        this.tecladoNativo = true;
        this.el.nativeElement.focus();
      } else {
        this.el.nativeElement.blur();
      }
    });
  }

  @HostListener('blur')
  alSalir(): void {
    this.tecladoNativo = false;
    this.resolver();
  }

  @HostListener('keydown.enter')
  alEnter(): void {
    this.resolver();
  }

  /** Reemplaza lo escrito ("200+200+200") por su resultado; si no es una operacion valida marca error. */
  private resolver(): void {
    const crudo = String(this.control?.value ?? this.el.nativeElement.value ?? '').trim();
    if (crudo === '') return;
    const total = evaluarExpresion(crudo);
    if (total === null) {
      this.control?.control?.setErrors({ expresion: true });
      return;
    }
    if (String(total) !== crudo) this.control?.control?.setValue(total);
    else this.control?.control?.setValue(total, { emitEvent: false });
  }
}
