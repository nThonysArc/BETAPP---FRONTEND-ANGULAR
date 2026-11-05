/**
 * Modelo plano del reporte de avance (espejo de ReporteDatos.java) y su construccion a partir de lo
 * que el dispositivo ya tiene (cortes, ingresos de MP, catalogos). Sin Angular: funciones puras para
 * probarlas aisladas y para que el resultado sea el mismo que calcula el servidor.
 */

import { Corte } from '../models/corte.model';
import { IngresoMateriaPrima } from '../models/ingreso-materia-prima.model';

export interface LoteReporte {
  fecha: string | null; // 'YYYY-MM-DD'
  jabas: number;
  kilos: number;
  variedad: string;
}

export interface FilaReporte {
  maquinaId: number;
  maquina: string;
  kato: string;
  variedad: string;
  jabas: number;
  peso: number;
  empacadores: number;
  kgPorEmpacador: number;
}

export interface MaquinaCorteReporte {
  maquinaId: number;
  supervisor: string | null;
  observacion: string | null;
  almuerzo: boolean;
}

export interface CorteReporte {
  inicio: string; // 'HH:mm' o 'HH:mm:ss'
  fin: string;
  fechaCosecha: string | null;
  observacionGeneral: string | null;
  jabasTotal: number;
  pesoTotal: number;
  filas: FilaReporte[];
  maquinas: MaquinaCorteReporte[];
}

export interface ReporteDatos {
  titulo: string;
  fechaProceso: string;
  ingresos: LoteReporte[];
  cortes: CorteReporte[];
}

/** Todas las maquinas del corte salieron a almorzar: es la barra "ALMUERZO DEL PERSONAL", no una hora de produccion. */
export function todoAlmuerzo(c: CorteReporte): boolean {
  return c.maquinas.length > 0 && c.maquinas.every((m) => m.almuerzo);
}

/** Datos del contexto que el reporte necesita ademas de cortes e ingresos. */
export interface ContextoReporte {
  fechaProceso: string;
  productoNombre: string;
  anio: number | null;
  /** Supervisor sugerido de cada maquina (id -> nombre), para las maquinas sin fila propia en el corte. */
  supervisorPorMaquina?: Map<number, string | null>;
}

/** "Arandano" -> "AVANCE DE PRODUCCIÓN CAMPAÑA ARANDANOS 2026" (misma regla que el servidor). */
export function tituloReporte(productoNombre: string, anio: number | null): string {
  let plural = productoNombre.toUpperCase();
  if (!plural.endsWith('S')) plural += 'S';
  return `AVANCE DE PRODUCCIÓN CAMPAÑA ${plural}${anio != null ? ' ' + anio : ''}`;
}

/**
 * Una Kato que en la misma hora trabajo varias variedades se muestra como UNA sola fila (variedades
 * unidas "A/B", jabas y peso sumados). Empacadores: el de la primera fila de la kato (es un solo equipo);
 * kg/empacador se recalcula con el peso total. Respeta el orden de aparicion.
 */
export function fusionarPorKato(filas: FilaReporte[]): FilaReporte[] {
  const grupos = new Map<string, FilaReporte[]>();
  for (const f of filas) {
    const k = `${f.maquinaId}|${f.kato}`;
    const g = grupos.get(k);
    if (g) g.push(f);
    else grupos.set(k, [f]);
  }
  const resultado: FilaReporte[] = [];
  for (const g of grupos.values()) {
    if (g.length === 1) {
      resultado.push(g[0]);
      continue;
    }
    let jabas = 0;
    let peso = 0;
    let empacadores = 0;
    const variedades = new Set<string>();
    for (const f of g) {
      jabas += f.jabas || 0;
      peso += f.peso || 0;
      if (empacadores === 0) empacadores = f.empacadores;
      variedades.add(f.variedad);
    }
    const kg = empacadores > 0 ? Math.round((peso / empacadores) * 100) / 100 : 0;
    const p = g[0];
    resultado.push({
      maquinaId: p.maquinaId, maquina: p.maquina, kato: p.kato,
      variedad: [...variedades].join('/'), jabas, peso, empacadores, kgPorEmpacador: kg
    });
  }
  return resultado;
}

function mapearCorte(corte: Corte, ctx: ContextoReporte): CorteReporte {
  // Orden de captura (el servidor ordena por "orden" y luego por id; aqui el indice original hace de desempate).
  const detalles = corte.detalles
    .map((d, i) => ({ d, i }))
    .sort((a, b) => (a.d.orden ?? 0) - (b.d.orden ?? 0) || a.i - b.i)
    .map((x) => x.d);

  const porVariedad: FilaReporte[] = detalles.map((d) => ({
    maquinaId: d.maquinaId,
    maquina: d.maquinaNombre ?? '',
    kato: d.katoNombre ?? '',
    variedad: d.variedadNombre ?? '',
    jabas: d.jabas,
    peso: d.pesoTotal,
    empacadores: d.empacadores ?? 0,
    kgPorEmpacador: d.kgPorEmpacador
  }));

  const porMaquina = new Map<number, MaquinaCorteReporte>();
  for (const s of corte.supervisores ?? []) {
    porMaquina.set(s.maquinaId, {
      maquinaId: s.maquinaId, supervisor: s.supervisorNombre, observacion: s.observacion, almuerzo: s.almuerzo
    });
  }
  for (const d of detalles) {
    if (!porMaquina.has(d.maquinaId)) {
      porMaquina.set(d.maquinaId, {
        maquinaId: d.maquinaId,
        supervisor: ctx.supervisorPorMaquina?.get(d.maquinaId) ?? null,
        observacion: null,
        almuerzo: false
      });
    }
  }

  return {
    inicio: corte.horaInicio,
    fin: corte.horaFin,
    fechaCosecha: corte.fechaCosecha ?? ctx.fechaProceso,
    observacionGeneral: corte.observacion,
    jabasTotal: corte.jabasTotalEfectivo,
    pesoTotal: corte.pesoTotalEfectivo,
    filas: fusionarPorKato(porVariedad),
    maquinas: [...porMaquina.values()]
  };
}

/** Arma los datos del reporte (Arandano) con lo guardado en el dispositivo. Los cortes se ordenan por numero. */
export function construirDatosReporte(
  ctx: ContextoReporte, ingresos: IngresoMateriaPrima[], cortes: Corte[]
): ReporteDatos {
  const ordenados = [...cortes].sort((a, b) => a.numeroCorte - b.numeroCorte);
  return {
    titulo: tituloReporte(ctx.productoNombre, ctx.anio),
    fechaProceso: ctx.fechaProceso,
    ingresos: ingresos.map((i) => ({ fecha: ctx.fechaProceso, jabas: i.jabas, kilos: i.kilos, variedad: i.variedadNombre })),
    cortes: ordenados.map((c) => mapearCorte(c, ctx))
  };
}
