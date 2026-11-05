/**
 * Calculo del "Avance por hora de seleccion" de Vid en el dispositivo (espejo de AvanceVid.java y
 * ValidadorAvanceVid.java). Funciones puras, sin Angular: la aritmetica del reporte vive aqui y en el
 * servidor con las mismas reglas, y se verifica contra el servidor con la prueba de paridad.
 */
import { Advertencia } from '../models/advertencia.model';

export interface ModuloHora {
  maquinaId: number | null;
  modulo: string;
  variedad: string;
  personas: number;
  jabas: number;
  supervisor: string | null;
  observacion: string | null;
  almuerzo: boolean;
}

export interface HoraVid {
  numero: number;
  inicio: string; // 'HH:mm' o 'HH:mm:ss'
  fin: string;
  fechaCosecha: string | null; // 'YYYY-MM-DD'
  totalAjustado: number | null;
  modulos: ModuloHora[];
}

export interface ContextoVid {
  fechaProceso: string;
  ingresoDia: number;
  ingresoAnterior: number;
  acumuladoAnterior: number;
  /** Jabas proyectadas del dia (digitadas con la MP); null = se usa el ingreso del dia. */
  proyeccion: number | null;
  /** Stock digitado a mano que quedo de un dia previo; null = se deduce del historial. */
  stockAnterior?: number | null;
  stockAnteriorFecha?: string | null;
}

export interface FilaModuloVid {
  modulo: string;
  personas: number;
  jabas: number;
  rendimiento: number | null;
  observacion: string | null;
  almuerzo: boolean;
}

export interface BloqueHoraVid {
  numero: number;
  inicio: string;
  fin: string;
  totalHora: number;
  acumulado: number;
  filas: FilaModuloVid[];
}

export interface ProcesadoDiaVid {
  fecha: string;
  jabas: number;
}

export interface ResumenSupervisorVid {
  supervisor: string;
  modulo: string;
  variedades: string;
  jabas: number;
}

export interface ResultadoVid {
  bloques: BloqueHoraVid[];
  proyeccion: number;
  /** Jabas que ingresaron HOY (separado del stock heredado). */
  ingresoDia: number;
  /** Stock que quedo de dias previos de la campana (ingresado - procesado). */
  stockAnterior: number;
  /** Dia del stock anterior digitado (solo si fue digitado); null si se dedujo del historial. */
  stockAnteriorFecha: string | null;
  procesadoDia: number;
  acumuladoAnterior: number;
  totalAcumulado: number;
  stock: number;
  porDia: ProcesadoDiaVid[];
  supervisores: ResumenSupervisorVid[];
  totalSupervisores: number;
}

export const SIN_SUPERVISOR = 'SIN SUPERVISOR';

const nz = (n: number | null | undefined): number => (n == null || Number.isNaN(n) ? 0 : n);
const blanco = (s: string | null | undefined): boolean => !s || s.trim() === '';

/** 'HH:mm[:ss]' -> minutos desde medianoche. */
export function minutosDe(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

export function minutosHora(h: HoraVid): number {
  return minutosDe(h.fin) - minutosDe(h.inicio);
}

export function totalCalculado(h: HoraVid): number {
  return h.modulos.reduce((a, m) => a + nz(m.jabas), 0);
}

export function totalHora(h: HoraVid): number {
  return h.totalAjustado != null ? h.totalAjustado : totalCalculado(h);
}

export function todoAlmuerzoVid(h: HoraVid): boolean {
  return h.modulos.length > 0 && h.modulos.every((m) => m.almuerzo);
}

/** Rend/persona SIEMPRE se calcula (jabas / personas); redondeo mitad hacia arriba como BigDecimal.HALF_UP. */
export function rendimiento(jabas: number, personas: number): number | null {
  if (personas <= 0) return null;
  return Math.floor(Math.abs(jabas) / personas + 0.5) * Math.sign(jabas || 1);
}

export function calcularVid(horas: HoraVid[], ctx: ContextoVid): ResultadoVid {
  const bloques: BloqueHoraVid[] = [];
  let acumulado = 0;
  for (const h of horas) {
    acumulado += totalHora(h);
    bloques.push({
      numero: h.numero,
      inicio: h.inicio,
      fin: h.fin,
      totalHora: totalHora(h),
      acumulado,
      filas: h.modulos.map((m) => ({
        modulo: m.modulo, personas: m.personas, jabas: nz(m.jabas),
        rendimiento: rendimiento(nz(m.jabas), m.personas), observacion: m.observacion, almuerzo: m.almuerzo
      }))
    });
  }
  const procesado = acumulado;

  // Procesado por dia de cosecha (ordenado por fecha, como TreeMap).
  const dias = new Map<string, number>();
  for (const h of horas) {
    const dia = h.fechaCosecha ?? ctx.fechaProceso;
    dias.set(dia, (dias.get(dia) ?? 0) + totalCalculado(h));
  }
  const porDia = [...dias.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([fecha, jabas]) => ({ fecha, jabas }));

  // Resumen por supervisor + modulo (todos los modulos que aparecen).
  const jabasSup = new Map<string, number>();
  const variedadesSup = new Map<string, Set<string>>();
  const nombres = new Map<string, [string, string]>();
  for (const h of horas) {
    for (const m of h.modulos) {
      const sup = blanco(m.supervisor) ? SIN_SUPERVISOR : m.supervisor!.trim();
      const clave = `${sup}\u0000${m.modulo}`;
      if (!nombres.has(clave)) nombres.set(clave, [sup, m.modulo]);
      jabasSup.set(clave, (jabasSup.get(clave) ?? 0) + nz(m.jabas));
      let vars = variedadesSup.get(clave);
      if (!vars) variedadesSup.set(clave, (vars = new Set()));
      if (!blanco(m.variedad) && nz(m.jabas) > 0) vars.add(m.variedad.trim());
    }
  }
  const supervisores: ResumenSupervisorVid[] = [];
  let totalSup = 0;
  for (const [clave, jabas] of jabasSup) {
    const [sup, modulo] = nombres.get(clave)!;
    supervisores.push({ supervisor: sup, modulo, variedades: [...variedadesSup.get(clave)!].join('/'), jabas });
    totalSup += jabas;
  }

  const totalAcumulado = ctx.acumuladoAnterior + procesado;
  // El stock digitado a mano manda; si no hay, se deduce del historial (ingresado - procesado en dias previos).
  const stockAnterior = ctx.stockAnterior != null ? ctx.stockAnterior : ctx.ingresoAnterior - ctx.acumuladoAnterior;
  const stock = stockAnterior + ctx.ingresoDia - procesado;
  return {
    bloques,
    proyeccion: ctx.proyeccion != null ? ctx.proyeccion : ctx.ingresoDia,
    ingresoDia: ctx.ingresoDia,
    stockAnterior,
    stockAnteriorFecha: ctx.stockAnterior != null ? ctx.stockAnteriorFecha ?? null : null,
    procesadoDia: procesado,
    acumuladoAnterior: ctx.acumuladoAnterior,
    totalAcumulado,
    stock,
    porDia,
    supervisores,
    totalSupervisores: totalSup
  };
}

// ---------------------------------------------------------------------------------------------
// Advertencias (ValidadorAvanceVid)
// ---------------------------------------------------------------------------------------------

const MIN_NORMAL = 55;
const MAX_NORMAL = 65;
const TOLERANCIA_MINUTOS = 5;
const MINUTOS = /\d+\s*(mnts?|mins?|minutos?)(?![\p{L}\p{N}_])/iu;

const hm = (t: string): string => {
  const [h, m] = t.split(':');
  return `${Number(h)}:${(m ?? '00').padStart(2, '0')}`;
};
const declaraMinutos = (obs: string | null): boolean => obs != null && MINUTOS.test(obs);

export function validarVid(horas: HoraVid[], r: ResultadoVid): Advertencia[] {
  const out: Advertencia[] = [];
  let previa: HoraVid | null = null;
  let modAnterior = new Map<number, ModuloHora>();

  for (const h of horas) {
    const min = minutosHora(h);
    if (!todoAlmuerzoVid(h) && (min < MIN_NORMAL || min > MAX_NORMAL)) {
      out.push({
        hora: h.numero, modulo: null, codigo: 'DURACION_ATIPICA',
        mensaje: `La hora ${h.numero} dura ${min} min (${hm(h.inicio)} a ${hm(h.fin)}); lo normal es 60. Verifica el horario o normaliza los jabas/hora.`
      });
    }
    if (previa && minutosDe(previa.fin) !== minutosDe(h.inicio)) {
      out.push({
        hora: h.numero, modulo: null, codigo: 'HUECO_HORARIO',
        mensaje: `La hora ${h.numero} empieza a las ${hm(h.inicio)} pero la anterior termino a las ${hm(previa.fin)}.`
      });
    }
    if (h.totalAjustado != null && h.totalAjustado !== totalCalculado(h)) {
      out.push({
        hora: h.numero, modulo: null, codigo: 'TOTAL_AJUSTADO',
        mensaje: `El total de la hora ${h.numero} fue ajustado a mano (${h.totalAjustado}) y no coincide con la suma de los modulos (${totalCalculado(h)}).`
      });
    }

    for (const m of h.modulos) {
      const sinObs = blanco(m.observacion);
      if (!m.almuerzo) {
        if (nz(m.jabas) > 0 && m.personas <= 0) {
          out.push({
            hora: h.numero, modulo: m.modulo, codigo: 'MODULO_SIN_PERSONAS',
            mensaje: `${m.modulo} registra jabas pero 0 personas en la hora ${h.numero}.`
          });
        }
        if (m.personas > 0 && nz(m.jabas) === 0 && sinObs) {
          out.push({
            hora: h.numero, modulo: m.modulo, codigo: 'PERSONAS_SIN_JABAS',
            mensaje: `${m.modulo} tiene ${m.personas} personas pero 0 jabas en la hora ${h.numero} y sin observacion (¿paro por falta de MP?).`
          });
        }
      }
      const ant = m.maquinaId == null ? undefined : modAnterior.get(m.maquinaId);
      if (ant && previa && nz(m.jabas) > 0 && nz(m.jabas) === nz(ant.jabas)) {
        const dif = Math.abs(minutosHora(h) - minutosHora(previa));
        const parcial = declaraMinutos(m.observacion) || declaraMinutos(ant.observacion);
        if (dif > TOLERANCIA_MINUTOS || parcial) {
          out.push({
            hora: h.numero, modulo: m.modulo, codigo: 'VALOR_REPETIDO',
            mensaje: `${m.modulo} repite ${nz(m.jabas)} jabas en las horas ${previa.numero} y ${h.numero} con tiempos de operacion distintos.`
          });
        }
      }
    }

    modAnterior = new Map();
    for (const m of h.modulos) if (m.maquinaId != null) modAnterior.set(m.maquinaId, m);
    previa = h;
  }

  const totalPorDia = r.porDia.reduce((a, d) => a + d.jabas, 0);
  if (totalPorDia !== r.procesadoDia) {
    out.push({
      hora: null, modulo: null, codigo: 'DIA_DESCUADRADO',
      mensaje: `El procesado por dia suma ${totalPorDia} pero el total por horas es ${r.procesadoDia}.`
    });
  }
  if (r.totalSupervisores !== r.procesadoDia) {
    out.push({
      hora: null, modulo: null, codigo: 'SUPERVISOR_DESCUADRADO',
      mensaje: `El resumen por supervisor suma ${r.totalSupervisores} pero el total por horas es ${r.procesadoDia}.`
    });
  }
  if (r.stock < 0) {
    out.push({
      hora: null, modulo: null, codigo: 'STOCK_NEGATIVO',
      mensaje: `Se proceso mas de lo ingresado: el stock queda en ${r.stock} jabas. Revisa los ingresos de materia prima.`
    });
  }
  return out;
}
