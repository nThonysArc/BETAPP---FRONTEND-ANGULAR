import { TestBed } from '@angular/core/testing';
import { MAT_BOTTOM_SHEET_DATA, MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { CalculadoraSumasSheet } from './calculadora-sumas.sheet';

describe('CalculadoraSumasSheet', () => {
  function crear(valorInicial: unknown) {
    const dismiss = jasmine.createSpy('dismiss');
    TestBed.configureTestingModule({
      imports: [CalculadoraSumasSheet],
      providers: [
        provideNoopAnimations(),
        { provide: MAT_BOTTOM_SHEET_DATA, useValue: { etiqueta: 'Jabas', valorInicial } },
        { provide: MatBottomSheetRef, useValue: { dismiss } }
      ]
    });
    const fixture = TestBed.createComponent(CalculadoraSumasSheet);
    fixture.detectChanges();
    return { fixture, dismiss, comp: fixture.componentInstance };
  }

  it('suma +200+200+200 y devuelve 600 al aplicar', () => {
    const { comp, dismiss } = crear(0);
    for (const t of ['2', '0', '0', '+', '2', '0', '0', '+', '2', '0', '0'] as const) comp.tocar(t);
    expect(comp.total()).toBe(600);
    comp.aplicar();
    expect(dismiss).toHaveBeenCalledWith({ total: 600 });
  });

  it('continua desde el valor que ya tenia el campo', () => {
    const { comp } = crear(600);
    comp.tocar('+'); comp.tocar('5'); comp.tocar('0');
    expect(comp.total()).toBe(650);
  });

  it('permite volver al teclado normal', () => {
    const { comp, dismiss } = crear(0);
    comp.usarTeclado();
    expect(dismiss).toHaveBeenCalledWith({ teclado: true });
  });

  it('muestra la expresion y el total en pantalla', () => {
    const { fixture, comp } = crear(0);
    comp.tocar('1'); comp.tocar('+'); comp.tocar('2');
    fixture.detectChanges();
    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain('1 + 2');
    expect(texto).toContain('= 3');
  });
});
