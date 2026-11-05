import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { IngresoMateriaPrimaComponent } from './ingreso-materia-prima.component';
import { IngresoMateriaPrimaService } from '../../../core/services/ingreso-materia-prima.service';
import { ProcesoDiarioService } from '../../../core/services/proceso-diario.service';
import { CampanaService } from '../../../core/services/campana.service';
import { VariedadService } from '../../../core/services/variedad.service';

describe('IngresoMateriaPrimaComponent (pegar desde Excel)', () => {
  const actualizar = jasmine.createSpy('actualizar').and.callFake((_id: number, req: unknown) => of(req));

  function crear() {
    actualizar.calls.reset();
    TestBed.configureTestingModule({
      imports: [IngresoMateriaPrimaComponent],
      providers: [
        provideNoopAnimations(),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => '5' } } } },
        { provide: Router, useValue: { navigate: () => undefined } },
        { provide: IngresoMateriaPrimaService, useValue: { listar: () => of([]), actualizar } },
        { provide: ProcesoDiarioService, useValue: { obtener: () => of({ campanaId: 1 }) } },
        { provide: CampanaService, useValue: { obtener: () => of({ productoId: 1 }) } },
        { provide: VariedadService, useValue: { listarPorProducto: () => of([{ id: 1, nombre: 'Ventura' }, { id: 2, nombre: 'Biloxi' }]) } }
      ]
    });
    return TestBed.createComponent(IngresoMateriaPrimaComponent).componentInstance;
  }

  it('una sola fila llena el formulario', () => {
    const c = crear();
    c.procesarPegado('Ventura\t1,200\t9,840');
    expect(c.form.getRawValue()).toEqual({ variedadId: 1, jabas: 1200, kilos: 9840 });
    expect(c.pegado().length).toBe(0);
  });

  it('varias filas quedan en vista previa y se guardan todas', () => {
    const c = crear();
    c.procesarPegado('Ventura\t100\t800\nBiloxi\t50\t400');
    expect(c.pegado().length).toBe(2);
    expect(c.pegadoListo).toBeTrue();
    c.guardarPegado();
    expect(actualizar).toHaveBeenCalledTimes(2);
    expect(actualizar.calls.argsFor(1)[1]).toEqual({ variedadId: 2, jabas: 50, kilos: 400 });
  });

  it('una variedad no reconocida bloquea el guardado hasta elegirla', () => {
    const c = crear();
    c.procesarPegado('Rara\t100\t800\nBiloxi\t50\t400');
    expect(c.pegadoListo).toBeFalse();
    c.asignarVariedadPegada(0, 1);
    expect(c.pegadoListo).toBeTrue();
  });

  it('intercambia jabas y kilos', () => {
    const c = crear();
    c.procesarPegado('Ventura\t800\t100\nBiloxi\t400\t50');
    c.intercambiarPegado();
    expect(c.pegado()[0].jabas).toBe(100);
  });
});

describe('IngresoMateriaPrimaComponent (totales)', () => {
  it('calcula totales y promedio ponderado general', () => {
    TestBed.configureTestingModule({
      imports: [IngresoMateriaPrimaComponent],
      providers: [
        provideNoopAnimations(),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => '5' } } } },
        { provide: Router, useValue: { navigate: () => undefined } },
        { provide: IngresoMateriaPrimaService, useValue: { listar: () => of([
          { variedadId: 1, variedadNombre: 'A', jabas: 100, kilos: 200 },
          { variedadId: 2, variedadNombre: 'B', jabas: 300, kilos: 900 }]), actualizar: () => of({}) } },
        { provide: ProcesoDiarioService, useValue: { obtener: () => of({ campanaId: 1 }) } },
        { provide: CampanaService, useValue: { obtener: () => of({ productoId: 1 }) } },
        { provide: VariedadService, useValue: { listarPorProducto: () => of([]) } }
      ]
    });
    const c = TestBed.createComponent(IngresoMateriaPrimaComponent).componentInstance;
    expect(c.totalJabas).toBe(400);
    expect(c.totalKilos).toBe(1100);
    expect(c.pesoPromedioGeneral).toBeCloseTo(2.75, 5);
  });
});
