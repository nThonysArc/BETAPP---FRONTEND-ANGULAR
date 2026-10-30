import { Corte, CorteDetalle, CorteRequest } from '../models/corte.model';
import {
  RESOLUTOR_VACIO,
  aplicarEdicionLocal,
  construirCorteLocal,
  derivarPlantilla,
  masUnaHora,
  normalizarHora
} from './datos-locales';

const detalle = (maquinaId: number, jabas: number, peso: number): CorteDetalle => ({
  clienteUuid: null, maquinaId, maquinaNombre: `M${maquinaId}`, maquinaKatoId: 5, katoNombre: 'K1',
  variedadId: 9, variedadNombre: 'Biloxi', jabas, pesoTotal: peso, empacadores: 4, kgPorEmpacador: 10, orden: 0
});

const request = (over: Partial<CorteRequest> = {}): CorteRequest => ({
  clienteUuid: 'uuid-1', horaInicio: '08:00', horaFin: '09:00', detalles: [detalle(1, 10, 100.5), detalle(2, 5, 50.25)],
  supervisores: [{ maquinaId: 1, maquinaNombre: 'M1', supervisorId: 7, supervisorNombre: 'Ana', observacion: 'ok', almuerzo: false }],
  ...over
});

describe('datos-locales', () => {
  it('normaliza y suma horas como el servidor (HH:mm:ss, vuelta de medianoche)', () => {
    expect(normalizarHora('8:05')).toBe('08:05:00');
    expect(masUnaHora('08:00')).toBe('09:00:00');
    expect(masUnaHora('23:30:00')).toBe('00:30:00');
  });

  it('sin cortes, la plantilla es el corte 1 de 07:00 a 08:00', () => {
    const p = derivarPlantilla(3, []);
    expect(p.numeroCorteSugerido).toBe(1);
    expect(p.horaInicio).toBe('07:00:00');
    expect(p.horaFin).toBe('08:00:00');
    expect(p.detalles.length).toBe(0);
  });

  it('calcula totales y numero igual que el servidor y marca el corte como pendiente', () => {
    const c = construirCorteLocal(3, -1, 1, request(), [], RESOLUTOR_VACIO);
    expect(c.jabasTotalCalculado).toBe(15);
    expect(c.pesoTotalCalculado).toBe(150.75);
    expect(c.jabasTotalEfectivo).toBe(15);
    expect(c.pendienteSync).toBeTrue();
    expect(c.id).toBe(-1);
    expect(c.numeroCorte).toBe(1);
    expect(c.supervisores.length).toBe(2); // uno por maquina del detalle
  });

  it('el total ajustado manda sobre el calculado', () => {
    const c = construirCorteLocal(3, -1, 1, request({ pesoTotalAjustado: 999 }), [], RESOLUTOR_VACIO);
    expect(c.pesoTotalCalculado).toBe(150.75);
    expect(c.pesoTotalEfectivo).toBe(999);
  });

  it('la plantilla siguiente repite maquinas en cero, hereda supervisor y NO hereda observacion ni almuerzo', () => {
    const c = construirCorteLocal(3, -1, 4, request({
      supervisores: [{ maquinaId: 1, maquinaNombre: 'M1', supervisorId: 7, supervisorNombre: 'Ana', observacion: 'se paro', almuerzo: true }]
    }), [], RESOLUTOR_VACIO);
    const p = derivarPlantilla(3, [c]);
    expect(p.numeroCorteSugerido).toBe(5);
    expect(p.horaInicio).toBe('09:00:00');
    expect(p.horaFin).toBe('10:00:00');
    expect(p.detalles.every((d) => d.jabas === 0 && d.pesoTotal === 0 && d.kgPorEmpacador === 0)).toBeTrue();
    const s1 = p.supervisores.find((s) => s.maquinaId === 1)!;
    expect(s1.supervisorId).toBe(7);
    expect(s1.observacion).toBeNull();
    expect(s1.almuerzo).toBeFalse();
  });

  it('la plantilla usa el corte de mayor numero aunque la lista llegue desordenada', () => {
    const a = construirCorteLocal(3, -1, 2, request({ horaFin: '10:00' }), [], RESOLUTOR_VACIO);
    const b = construirCorteLocal(3, -2, 1, request({ horaFin: '09:00' }), [], RESOLUTOR_VACIO);
    expect(derivarPlantilla(3, [a, b]).numeroCorteSugerido).toBe(3);
  });

  it('editar conserva id, numero y uuid, y recalcula totales', () => {
    const c: Corte = construirCorteLocal(3, 41, 2, request(), [], RESOLUTOR_VACIO);
    const e = aplicarEdicionLocal(c, request({ detalles: [detalle(1, 20, 200)], clienteUuid: 'otro' }), RESOLUTOR_VACIO, true);
    expect(e.id).toBe(41);
    expect(e.numeroCorte).toBe(2);
    expect(e.clienteUuid).toBe('uuid-1');
    expect(e.jabasTotalCalculado).toBe(20);
  });
});
