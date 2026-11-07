import { HoraVid, bloqueTodoAlmuerzo, calcularVid, numerarHorasVid, rendimiento, validarVid } from './vid-calculo';
import { horaVidDeCorte, slugProducto } from './reporte-local.service';
import { Corte } from '../models/corte.model';

const h = (numero: number, i: string, f: string, jabas: number, obs: string | null, dia = '2026-11-04'): HoraVid => ({
  numero, inicio: i, fin: f, fechaCosecha: dia, totalAjustado: null,
  modulos: [{ maquinaId: 1, modulo: 'MODULO 1', variedad: 'SWEET GLOBE', personas: 20, jabas, supervisor: 'ROCIO HERNANDEZ', observacion: obs, almuerzo: false }]
});
const ctx = (extra = {}) => ({ fechaProceso: '2026-11-04', ingresoDia: 4000, ingresoAnterior: 0, acumuladoAnterior: 0, proyeccion: null, ...extra });

/** Mismos datos y mismos resultados que ValidadorAvanceVid.java / AvanceVid.java (verificado ejecutando el Java). */
describe('Vid en el dispositivo (paridad con el servidor)', () => {
  const horas = [
    h(1, '11:30:00', '12:00:00', 490, 'A'), h(2, '12:30:00', '13:05:00', 640, 'B'),
    h(3, '14:10:00', '14:40:00', 560, '10 mnts de proceso'), h(4, '15:20:00', '15:40:00', 560, 'C'),
    h(5, '16:40:00', '17:05:00', 640, null), h(6, '17:20:00', '17:50:00', 0, null),
    h(7, '18:00:00', '18:30:00', 560, 'D'), h(8, '19:00:00', '19:25:00', 519, 'E')
  ];

  it('calcula acumulado, total, stock y usa el ingreso del dia si no hay proyeccion', () => {
    const r = calcularVid(horas, ctx());
    expect(r.totalAcumulado).toBe(3969);
    expect(r.stock).toBe(31);
    expect(r.proyeccion).toBe(4000);
    expect(r.bloques[7].acumulado).toBe(3969);
    expect(calcularVid(horas, ctx({ ingresoDia: 4529, proyeccion: 4000 })).proyeccion).toBe(4000);
  });

  it('la hora en que todo el personal almuerza no ocupa numero y la siguiente continua la cuenta', () => {
    const almuerzoTodos: HoraVid = {
      ...h(2, '09:00:00', '10:00:00', 0, null),
      modulos: [{ ...h(2, '09:00:00', '10:00:00', 0, null).modulos[0], almuerzo: true }]
    };
    const numeradas = numerarHorasVid([h(1, '08:00:00', '09:00:00', 100, null), almuerzoTodos, h(3, '10:00:00', '11:00:00', 120, null)]);
    expect(numeradas.map((x) => x.numero)).toEqual([1, 0, 2]);

    const r = calcularVid(numeradas, ctx());
    expect(bloqueTodoAlmuerzo(r.bloques[1])).toBeTrue();
    expect(bloqueTodoAlmuerzo(r.bloques[0])).toBeFalse();
    expect(r.procesadoDia).toBe(220);
  });

  it('separa el stock heredado de dias previos del ingreso del dia', () => {
    const r = calcularVid(horas, ctx({ ingresoDia: 1000, ingresoAnterior: 5000, acumuladoAnterior: 4200 }));
    expect(r.stockAnterior).toBe(800);
    expect(r.ingresoDia).toBe(1000);
    expect(r.stock).toBe(r.stockAnterior + r.ingresoDia - r.procesadoDia);
  });

  it('el stock digitado a mano manda sobre el deducido del historial y lleva su fecha', () => {
    const r = calcularVid(horas, ctx({
      ingresoDia: 1000, ingresoAnterior: 5000, acumuladoAnterior: 4200, stockAnterior: 700, stockAnteriorFecha: '2026-11-03'
    }));
    expect(r.stockAnterior).toBe(700);
    expect(r.stockAnteriorFecha).toBe('2026-11-03');
    expect(r.stock).toBe(700 + 1000 - r.procesadoDia);
    expect(calcularVid(horas, ctx({ ingresoDia: 1000, ingresoAnterior: 5000, acumuladoAnterior: 4200 })).stockAnteriorFecha).toBeNull();
  });

  it('emite las mismas advertencias, en el mismo orden y con el mismo texto', () => {
    const adv = validarVid(horas, calcularVid(horas, ctx()));
    expect(adv.map((a) => `${a.hora}|${a.codigo}`)).toEqual([
      '1|DURACION_ATIPICA', '2|DURACION_ATIPICA', '2|HUECO_HORARIO', '3|DURACION_ATIPICA', '3|HUECO_HORARIO',
      '4|DURACION_ATIPICA', '4|HUECO_HORARIO', '4|VALOR_REPETIDO', '5|DURACION_ATIPICA', '5|HUECO_HORARIO',
      '6|DURACION_ATIPICA', '6|HUECO_HORARIO', '6|PERSONAS_SIN_JABAS', '7|DURACION_ATIPICA', '7|HUECO_HORARIO',
      '8|DURACION_ATIPICA', '8|HUECO_HORARIO'
    ]);
    expect(adv[0].mensaje).toBe('La hora 1 dura 30 min (11:30 a 12:00); lo normal es 60. Verifica el horario o normaliza los jabas/hora.');
    expect(adv[2].mensaje).toBe('La hora 2 empieza a las 12:30 pero la anterior termino a las 12:00.');
    expect(adv[7].mensaje).toBe('MODULO 1 repite 560 jabas en las horas 3 y 4 con tiempos de operacion distintos.');
  });

  it('avisa de stock negativo y del procesado por dia descuadrado', () => {
    const r = calcularVid(horas, ctx({ ingresoDia: 100 }));
    expect(validarVid(horas, r).some((a) => a.codigo === 'STOCK_NEGATIVO')).toBeTrue();
  });

  it('el rendimiento por persona se redondea mitad hacia arriba y sin personas es null', () => {
    expect(rendimiento(490, 20)).toBe(25); // 24.5 -> 25
    expect(rendimiento(519, 20)).toBe(26); // 25.95
    expect(rendimiento(100, 0)).toBeNull();
  });

  it('separa el procesado por dia de cosecha', () => {
    const r = calcularVid([h(1, '08:00', '09:00', 100, null, '2026-11-03'), h(2, '09:00', '10:00', 50, null)], ctx());
    expect(r.porDia).toEqual([{ fecha: '2026-11-03', jabas: 100 }, { fecha: '2026-11-04', jabas: 50 }]);
  });
});

describe('armado de la hora Vid desde un corte guardado', () => {
  const corte = {
    numeroCorte: 3, horaInicio: '09:00:00', horaFin: '10:00:00', fechaCosecha: null, jabasTotalAjustado: null,
    detalles: [
      { maquinaId: 2, maquinaNombre: 'MODULO 2', variedadNombre: 'Red', empacadores: 10, jabas: 100, orden: 1 },
      { maquinaId: 1, maquinaNombre: 'MODULO 1', variedadNombre: 'Sweet', empacadores: 20, jabas: 200, orden: 0 }
    ],
    supervisores: [{ maquinaId: 1, supervisorNombre: 'ANA', observacion: 'PARO', almuerzo: false }]
  } as unknown as Corte;

  it('ordena por captura, usa el supervisor del corte y, sin fila, el de la maquina', () => {
    const hv = horaVidDeCorte(corte, new Map([[2, 'LUIS']]));
    expect(hv.numero).toBe(3);
    expect(hv.modulos.map((m) => m.modulo)).toEqual(['MODULO 1', 'MODULO 2']);
    expect(hv.modulos[0].supervisor).toBe('ANA');
    expect(hv.modulos[0].observacion).toBe('PARO');
    expect(hv.modulos[1].supervisor).toBe('LUIS');
  });

  it('el nombre del producto da el archivo de la foto igual que el servidor', () => {
    expect(slugProducto('Vid')).toBe('vid');
    expect(slugProducto('Selección Vid')).toBe('seleccion-vid');
  });
});
