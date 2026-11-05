import { calcularAvanceVivo } from './avance-vivo-local';
import { CorteReporte, ReporteDatos } from './reporte-datos';

const fila = (maquinaId: number, kato: string, jabas: number, peso: number) => ({
  maquinaId, maquina: `MAQUINA 0${maquinaId}`, kato, variedad: 'MAGICA', jabas, peso, empacadores: 5, kgPorEmpacador: peso / 5
});
const corte = (inicio: string, fin: string, filas: ReturnType<typeof fila>[], sup: string, almuerzo = false): CorteReporte => ({
  inicio, fin, fechaCosecha: '2026-11-04', observacionGeneral: null,
  jabasTotal: filas.reduce((a, f) => a + f.jabas, 0), pesoTotal: filas.reduce((a, f) => a + f.peso, 0),
  filas, maquinas: [{ maquinaId: 1, supervisor: sup, observacion: null, almuerzo }]
});

describe('calcularAvanceVivo', () => {
  const datos: ReporteDatos = {
    titulo: 'T', fechaProceso: '2026-11-04',
    ingresos: [{ fecha: '2026-11-04', jabas: 1000, kilos: 5000, variedad: 'MAGICA' }],
    cortes: [
      corte('07:00:00', '08:00:00', [fila(1, 'KATO 1', 100, 500)], 'ANA'),
      corte('08:00:00', '09:00:00', [], 'ANA', true),
      corte('09:00:00', '10:00:00', [fila(1, 'KATO 1', 200, 1000.55)], 'LUIS')
    ]
  };
  const a = calcularAvanceVivo(datos);

  it('numera solo horas de produccion y marca la pausa', () => {
    expect(a.horas.map((h) => h.numero)).toEqual([1, null, 2]);
    expect(a.horas[1].pausa).toBeTrue();
  });
  it('acumula kilos y calcula el pie', () => {
    expect(a.horas[2].acumuladoKilos).toBeCloseTo(1500.55, 2);
    expect(a.pie.ultimaHoraKilos).toBeCloseTo(1000.55, 2);
    expect(a.pie.previoKilos).toBe(500);
    expect(a.pie.stockKilos).toBeCloseTo(3499.45, 2);
    expect(a.pie.stockJabas).toBe(700);
  });
  it('resume por maquina con tramos de supervisor', () => {
    expect(a.resumen.length).toBe(1);
    expect(a.resumen[0].tramos.map((t) => t.supervisor)).toEqual(['ANA', 'LUIS']);
    expect(a.totalJabas).toBe(300);
  });
});
