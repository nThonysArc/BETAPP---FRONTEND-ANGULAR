import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { IngresoMateriaPrimaComponent } from './ingreso-materia-prima.component';
import { IngresoMateriaPrimaService } from '../../../core/services/ingreso-materia-prima.service';
import { ProcesoDiarioService } from '../../../core/services/proceso-diario.service';
import { CampanaService } from '../../../core/services/campana.service';
import { VariedadService } from '../../../core/services/variedad.service';
import { ProductoService } from '../../../core/services/producto.service';

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
        { provide: ProductoService, useValue: { listar: () => of([{ id: 1, nombre: 'Arandano', plantillaReporte: 'ARANDANO' }]) } },
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
        { provide: ProductoService, useValue: { listar: () => of([{ id: 1, nombre: 'Arandano', plantillaReporte: 'ARANDANO' }]) } },
        { provide: VariedadService, useValue: { listarPorProducto: () => of([]) } }
      ]
    });
    const c = TestBed.createComponent(IngresoMateriaPrimaComponent).componentInstance;
    expect(c.totalJabas).toBe(400);
    expect(c.totalKilos).toBe(1100);
    expect(c.pesoPromedioGeneral).toBeCloseTo(2.75, 5);
  });
});

describe('IngresoMateriaPrimaComponent (proyeccion de Vid)', () => {
  const actualizarProyeccion = jasmine.createSpy('actualizarProyeccion')
    .and.callFake((_id: number, jabas: number | null) => of({ campanaId: 1, proyeccionJabas: jabas }));

  function crear(plantilla: 'ARANDANO' | 'VID') {
    actualizarProyeccion.calls.reset();
    TestBed.configureTestingModule({
      providers: [
        provideNoopAnimations(),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => '5' } } } },
        { provide: Router, useValue: { navigate: () => undefined } },
        { provide: IngresoMateriaPrimaService, useValue: { listar: () => of([]), actualizar: () => of({}) } },
        { provide: ProcesoDiarioService, useValue: { obtener: () => of({ campanaId: 1, proyeccionJabas: 4000 }), actualizarProyeccion } },
        { provide: CampanaService, useValue: { obtener: () => of({ productoId: 1 }) } },
        { provide: ProductoService, useValue: { listar: () => of([{ id: 1, nombre: 'Uva', plantillaReporte: plantilla }]) } },
        { provide: VariedadService, useValue: { listarPorProducto: () => of([]) } }
      ]
    });
    const fixture = TestBed.createComponent(IngresoMateriaPrimaComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('en Vid muestra la proyeccion ya guardada y permite cambiarla', () => {
    const f = crear('VID');
    const c = f.componentInstance;
    expect(c.esVid()).toBeTrue();
    expect(c.proyeccion.value).toBe(4000);
    expect(c.proyeccionCambio).toBeFalse();

    c.proyeccion.setValue(4500);
    expect(c.proyeccionCambio).toBeTrue();
    c.guardarProyeccion();
    expect(actualizarProyeccion).toHaveBeenCalledWith(5, 4500);
    expect(c.proyeccionGuardada()).toBe(4500);
    expect(c.proyeccionCambio).toBeFalse();
  });

  it('vaciar el campo borra la proyeccion (null)', () => {
    const c = crear('VID').componentInstance;
    c.proyeccion.setValue(null);
    c.guardarProyeccion();
    expect(actualizarProyeccion).toHaveBeenCalledWith(5, null);
  });

  it('en Arandano no aparece la proyeccion', () => {
    const f = crear('ARANDANO');
    expect(f.componentInstance.esVid()).toBeFalse();
    f.detectChanges();
    expect((f.nativeElement as HTMLElement).textContent).not.toContain('Proyección del día');
  });
});

describe('IngresoMateriaPrimaComponent (Vid: stock anterior y sin kilos)', () => {
  const actualizar = jasmine.createSpy('actualizar').and.callFake((_id: number, req: unknown) => of(req));
  const actualizarStockAnterior = jasmine.createSpy('actualizarStockAnterior')
    .and.callFake((_id: number, jabas: number | null, fecha: string | null) =>
      of({ campanaId: 1, fecha: '2026-11-04', stockAnteriorJabas: jabas, stockAnteriorFecha: fecha }));

  function crear(plantilla: 'ARANDANO' | 'VID', proceso: object = {}) {
    actualizar.calls.reset();
    actualizarStockAnterior.calls.reset();
    TestBed.configureTestingModule({
      providers: [
        provideNoopAnimations(),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => '5' } } } },
        { provide: Router, useValue: { navigate: () => undefined } },
        { provide: IngresoMateriaPrimaService, useValue: { listar: () => of([]), actualizar } },
        { provide: ProcesoDiarioService, useValue: { obtener: () => of({ campanaId: 1, fecha: '2026-11-04', ...proceso }), actualizarStockAnterior } },
        { provide: CampanaService, useValue: { obtener: () => of({ productoId: 1 }) } },
        { provide: ProductoService, useValue: { listar: () => of([{ id: 1, nombre: 'Uva', plantillaReporte: plantilla }]) } },
        { provide: VariedadService, useValue: { listarPorProducto: () => of([{ id: 1, nombre: 'Sweet Globe' }]) } }
      ]
    });
    const fixture = TestBed.createComponent(IngresoMateriaPrimaComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('la fecha del stock anterior es por defecto el dia previo del proceso', () => {
    const c = crear('VID').componentInstance;
    expect(c.stockAnteriorFecha.value).toBe('2026-11-03');
    expect(c.stockAnterior.value).toBeNull();
    expect(c.stockAnteriorCambio).toBeFalse();
  });

  it('guarda el stock anterior con la fecha elegida', () => {
    const c = crear('VID').componentInstance;
    c.stockAnterior.setValue(800);
    c.stockAnteriorFecha.setValue('2026-11-02');
    expect(c.stockAnteriorCambio).toBeTrue();
    c.guardarStockAnterior();
    expect(actualizarStockAnterior).toHaveBeenCalledWith(5, 800, '2026-11-02');
    expect(c.stockAnteriorGuardado()).toEqual({ jabas: 800, fecha: '2026-11-02' });
    expect(c.stockAnteriorCambio).toBeFalse();
  });

  it('muestra el stock ya guardado y permite quitarlo', () => {
    const c = crear('VID', { stockAnteriorJabas: 500, stockAnteriorFecha: '2026-11-03' }).componentInstance;
    expect(c.stockAnterior.value).toBe(500);
    c.quitarStockAnterior();
    expect(actualizarStockAnterior).toHaveBeenCalledWith(5, null, null);
    expect(c.stockAnteriorGuardado()).toBeNull();
  });

  it('rechaza una fecha que no es anterior a la del proceso', () => {
    const c = crear('VID').componentInstance;
    c.stockAnterior.setValue(100);
    c.stockAnteriorFecha.setValue('2026-11-04');
    c.guardarStockAnterior();
    expect(actualizarStockAnterior).not.toHaveBeenCalled();
  });

  it('en Vid no se piden kilos: se guarda solo con jabas y se envian 0 kilos', () => {
    const f = crear('VID');
    const c = f.componentInstance;
    expect(c.columnas).not.toContain('kilos');
    expect((f.nativeElement as HTMLElement).textContent).not.toContain('Kilos acumulados');
    c.form.patchValue({ variedadId: 1, jabas: 1200 });
    expect(c.form.valid).toBeTrue();
    c.guardar();
    expect(actualizar).toHaveBeenCalledWith(5, { variedadId: 1, jabas: 1200, kilos: 0 });
  });

  it('en Vid se puede pegar solo variedad y jabas', () => {
    const c = crear('VID').componentInstance;
    c.procesarPegado('Sweet Globe\t1,200');
    expect(c.form.getRawValue()).toEqual({ variedadId: 1, jabas: 1200, kilos: 0 });
  });

  it('en Arandano siguen los kilos y no aparece el stock anterior', () => {
    const f = crear('ARANDANO');
    const c = f.componentInstance;
    expect(c.columnas).toContain('kilos');
    expect((f.nativeElement as HTMLElement).textContent).toContain('Kilos acumulados');
    expect((f.nativeElement as HTMLElement).textContent).not.toContain('Stock anterior');
    c.form.patchValue({ variedadId: 1, jabas: 10 });
    expect(c.form.valid).toBeFalse();
  });
});
