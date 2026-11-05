import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { CalculadoraSumasDirective } from './calculadora-sumas.directive';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, CalculadoraSumasDirective],
  template: `<input appCalculadoraSumas="Jabas" [formControl]="ctl" />`
})
class HostComponent {
  ctl = new FormControl<number | string | null>(null, [Validators.required, Validators.min(0)]);
}

describe('CalculadoraSumasDirective (PC: se escribe la operacion directo)', () => {
  function crear() {
    TestBed.configureTestingModule({ imports: [HostComponent], providers: [provideNoopAnimations()] });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    const escribir = (texto: string) => {
      input.value = texto;
      input.dispatchEvent(new Event('input'));
    };
    return { fixture, input, ctl: fixture.componentInstance.ctl, escribir };
  }

  it('+200+200+200 al salir del campo queda en 600', () => {
    const { fixture, input, ctl, escribir } = crear();
    escribir('+200+200+200');
    input.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    expect(ctl.value).toBe(600);
    expect(input.value).toBe('600');
  });

  it('resta y multiplicacion', () => {
    const { input, ctl, escribir } = crear();
    escribir('12*50-100');
    input.dispatchEvent(new Event('blur'));
    expect(ctl.value).toBe(500);
  });

  it('Enter tambien calcula', () => {
    const { input, ctl, escribir } = crear();
    escribir('100+50');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(ctl.value).toBe(150);
  });

  it('un numero simple queda como numero', () => {
    const { input, ctl, escribir } = crear();
    escribir('250');
    input.dispatchEvent(new Event('blur'));
    expect(ctl.value).toBe(250);
  });

  it('texto invalido marca error y no se pierde', () => {
    const { input, ctl, escribir } = crear();
    escribir('12a');
    input.dispatchEvent(new Event('blur'));
    expect(ctl.hasError('expresion')).toBeTrue();
    expect(input.value).toBe('12a');
  });

  it('resultado negativo queda como error de minimo', () => {
    const { input, ctl, escribir } = crear();
    escribir('5-10');
    input.dispatchEvent(new Event('blur'));
    expect(ctl.value).toBe(-5);
    expect(ctl.hasError('min')).toBeTrue();
  });

  it('el campo vacio no se toca', () => {
    const { input, ctl } = crear();
    input.dispatchEvent(new Event('blur'));
    expect(ctl.value).toBeNull();
  });
});
