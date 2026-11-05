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

  it('agrupa las filas por maquina y las filas nuevas quedan pegadas a su maquina', () => {
    const c = crear();
    c.agregarDetalle(3, 11, 1, 100, 500, 5, 0);
    c.agregarDetalle(4, 21, 1, 200, 1000, 6, 0);
    expect(c.grupos().map((g) => g.maquinaId)).toEqual([3, 4]);

    // Una kato mas para la maquina 3: se inserta tras sus filas, no al final del arreglo.
    c.agregarFilaEnGrupo(c.grupos()[0]);
    expect(c.grupos()[0].indices).toEqual([0, 1]);
    expect(c.grupos()[1].indices).toEqual([2]);
    expect(c.detalles.at(1).get('maquinaId')?.value).toBe(3);
    expect(c.detalles.at(2).get('maquinaId')?.value).toBe(4);
  });

  it('tarjeta nueva sin maquina: al elegirla se une a la tarjeta existente de esa maquina', () => {
    const c = crear();
    c.agregarDetalle(3, 11, 1, 100, 500, 5, 0);
    c.agregarMaquina();
    expect(c.grupos().length).toBe(2);
    expect(c.grupos()[1].maquinaId).toBeNull();
    c.asignarMaquinaAGrupo(c.grupos()[1], 3);
    expect(c.grupos().length).toBe(1);
    expect(c.grupos()[0].indices).toEqual([0, 1]);
  });

  it('totales por tarjeta y limpieza al eliminar', () => {
    const c = crear();
    c.agregarDetalle(3, 11, 1, 100, 500, 5, 0);
    c.agregarDetalle(3, 12, 1, 50, 250.5, 4, 0);
    expect(c.totalGrupo(c.grupos()[0])).toEqual({ jabas: 150, peso: 750.5 });
    c.eliminarDetalle(1);
    expect(c.totalGrupo(c.grupos()[0]).jabas).toBe(100);
    c.eliminarDetalle(0);
    expect(c.grupos().length).toBe(0);
  });
});
