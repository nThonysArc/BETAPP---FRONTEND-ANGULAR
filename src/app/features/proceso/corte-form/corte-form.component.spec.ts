import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { CorteFormComponent } from './corte-form.component';

describe('CorteFormComponent - empacadores por kato', () => {
  function crear() {
    TestBed.configureTestingModule({
      imports: [CorteFormComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), provideNoopAnimations()]
    });
    return TestBed.createComponent(CorteFormComponent).componentInstance;
  }

  it('dos variedades en la misma kato comparten UNA cantidad de empacadores', () => {
    const c = crear();
    c.agregarDetalle(3, 11, 1, 300, 1500, 6, 0);
    c.agregarDetalle(3, 11, 2, 300, 1500, 0, 0);
    c.agregarDetalle(3, 12, 1, 600, 3000, 6, 0);

    expect(c.repiteKato(0)).toBeFalse();
    expect(c.repiteKato(1)).toBeTrue();
    expect(c.repiteKato(2)).toBeFalse();

    c.detalles.at(0).get('empacadores')?.setValue(5);
    expect(c.detalles.at(1).get('empacadores')?.value).toBe(5);
    // kg/empacador con el peso de TODA la kato: (1500 + 1500) / 5
    expect(c.detalles.at(0).get('kgPorEmpacador')?.value).toBe(600);
    expect(c.detalles.at(1).get('kgPorEmpacador')?.value).toBe(600);
    // la otra kato no se toca
    expect(c.detalles.at(2).get('empacadores')?.value).toBe(6);
  });

  it('al eliminar la primera fila de la kato, la siguiente pasa a pedir el equipo', () => {
    const c = crear();
    c.agregarDetalle(3, 11, 1, 300, 1500, 5, 0);
    c.agregarDetalle(3, 11, 2, 300, 1500, 0, 0);
    c.detalles.at(0).get('empacadores')?.setValue(5);
    c.eliminarDetalle(0);
    expect(c.repiteKato(0)).toBeFalse();
    expect(c.detalles.at(0).get('empacadores')?.value).toBe(5);
  });
});
