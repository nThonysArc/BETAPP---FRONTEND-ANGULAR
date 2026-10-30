import { Corte, CorteDetalle, CortePlantilla, CorteRequest, CorteSupervisor } from '../models/corte.model';
import { IngresoMateriaPrima, IngresoMateriaPrimaRequest } from '../models/ingreso-materia-prima.model';

/**
 * Logica PURA (sin Angular ni IndexedDB) que reproduce en el dispositivo lo que el servidor
 * calcularia: totales de un corte, numero de corte siguiente y plantilla del siguiente corte.
 *
 * Por que aislarla: es la parte donde un error corrompe datos en silencio; al ser funciones puras
 * se prueban con tests unitarios sin navegador ni red. Replica CorteService.crear /
 * obtenerPlantillaSiguiente / calcularTotales del backend. El servidor sigue siendo la fuente de
 * verdad: al sincronizar, su respuesta reemplaza estos valores provisionales.
 */

/** Resuelve nombres a partir de ids, usando los catalogos que el dispositivo ya descargo. */
export interface ResolutorNombres {
  maquina(id: number | null | undefined): string | null;
  variedad(id: number | null | undefined): string | null;
  kato(id: number | null | undefined): string | null;
  usuario(id: number | null | undefined): string | null;
}

export const RESOLUTOR_VACIO: ResolutorNombres = {
  maquina: () => null,
  variedad: () => null,
  kato: () => null,
  usuario: () => null
};

const redondear = (n: number): number => Math.round(n * 100) / 100;
const dos = (n: number): string => String(n).padStart(2, '0');

/** "08:00" o "08:00:00" -> "08:00:00" (formato que devuelve el servidor). */
export function normalizarHora(hora: string): string {
  const [h = '0', m = '0', s = '0'] = hora.split(':');
  return `${dos(+h)}:${dos(+m)}:${dos(+s)}`;
}

export function masUnaHora(hora: string): string {
  const [h, m, s] = normalizarHora(hora).split(':').map(Number);
  return `${dos((h + 1) % 24)}:${dos(m)}:${dos(s)}`;
}

export function ordenarPorNumero(cortes: Corte[]): Corte[] {
  return [...cortes].sort((a, b) => a.numeroCorte - b.numeroCorte);
}

/** Plantilla del siguiente corte a partir de los cortes que el dispositivo conoce (incluye pendientes). */
export function derivarPlantilla(procesoId: number, cortes: Corte[]): CortePlantilla {
  if (cortes.length === 0) {
    return {
      procesoDiarioId: procesoId,
      numeroCorteSugerido: 1,
      horaInicio: '07:00:00',
      horaFin: '08:00:00',
      fechaCosecha: null,
      detalles: [],
      supervisores: []
    };
  }

  const ultimo = ordenarPorNumero(cortes)[cortes.length - 1];

  // Igual que el servidor: se repiten maquina/kato/variedad/empacadores, con produccion en cero.
  const detalles: CorteDetalle[] = ultimo.detalles.map((d) => ({
    ...d,
    clienteUuid: null,
    jabas: 0,
    pesoTotal: 0,
    kgPorEmpacador: 0
  }));

  // El supervisor se arrastra; la observacion y el almuerzo son de ESA hora y nunca se heredan.
  const supervisores: CorteSupervisor[] = ultimo.supervisores.map((s) => ({
    ...s,
    observacion: null,
    almuerzo: false
  }));

  return {
    procesoDiarioId: procesoId,
    numeroCorteSugerido: ultimo.numeroCorte + 1,
    horaInicio: normalizarHora(ultimo.horaFin),
    horaFin: masUnaHora(ultimo.horaFin),
    fechaCosecha: ultimo.fechaCosecha,
    detalles,
    supervisores
  };
}

function detallesLocales(request: CorteRequest, nombres: ResolutorNombres): CorteDetalle[] {
  return request.detalles.map((d, i) => ({
    ...d,
    clienteUuid: d.clienteUuid ?? crypto.randomUUID(),
    maquinaNombre: d.maquinaNombre ?? nombres.maquina(d.maquinaId),
    katoNombre: d.katoNombre ?? nombres.kato(d.maquinaKatoId),
    variedadNombre: d.variedadNombre ?? nombres.variedad(d.variedadId),
    orden: d.orden ?? i
  }));
}

function supervisoresLocales(
  request: CorteRequest,
  detalles: CorteDetalle[],
  previo: CorteSupervisor[],
  nombres: ResolutorNombres
): CorteSupervisor[] {
  const enviados = new Map((request.supervisores ?? []).map((s) => [s.maquinaId, s]));
  const anteriores = new Map(previo.map((s) => [s.maquinaId, s]));
  const vistas = new Set<number>();
  const resultado: CorteSupervisor[] = [];

  for (const d of detalles) {
    if (vistas.has(d.maquinaId)) continue;
    vistas.add(d.maquinaId);
    const s = enviados.get(d.maquinaId) ?? anteriores.get(d.maquinaId);
    const supervisorId = s?.supervisorId ?? null;
    resultado.push({
      maquinaId: d.maquinaId,
      maquinaNombre: d.maquinaNombre,
      supervisorId,
      supervisorNombre: s?.supervisorNombre ?? nombres.usuario(supervisorId),
      observacion: s?.observacion ?? null,
      almuerzo: s?.almuerzo ?? false
    });
  }
  return resultado;
}

function aplicarTotales(corte: Corte, request: CorteRequest): void {
  const jabas = redondear(corte.detalles.reduce((a, d) => a + (+d.jabas || 0), 0));
  const peso = redondear(corte.detalles.reduce((a, d) => a + (+d.pesoTotal || 0), 0));
  corte.jabasTotalCalculado = jabas;
  corte.pesoTotalCalculado = peso;
  corte.jabasTotalAjustado = request.jabasTotalAjustado ?? null;
  corte.pesoTotalAjustado = request.pesoTotalAjustado ?? null;
  corte.jabasTotalEfectivo = corte.jabasTotalAjustado ?? jabas;
  corte.pesoTotalEfectivo = corte.pesoTotalAjustado ?? peso;
  corte.requiereRevision = false;
}

/** Corte provisional para mostrar en pantalla mientras no se envia. */
export function construirCorteLocal(
  procesoId: number,
  idTemporal: number,
  numeroCorte: number,
  request: CorteRequest,
  previos: CorteSupervisor[],
  nombres: ResolutorNombres
): Corte {
  const detalles = detallesLocales(request, nombres);
  const corte: Corte = {
    id: idTemporal,
    procesoDiarioId: procesoId,
    numeroCorte,
    horaInicio: normalizarHora(request.horaInicio),
    horaFin: normalizarHora(request.horaFin),
    fechaCosecha: request.fechaCosecha ?? null,
    observacion: request.observacion ?? null,
    jabasTotalCalculado: 0,
    jabasTotalAjustado: null,
    jabasTotalEfectivo: 0,
    pesoTotalCalculado: 0,
    pesoTotalAjustado: null,
    pesoTotalEfectivo: 0,
    requiereRevision: false,
    clienteUuid: request.clienteUuid,
    detalles,
    supervisores: supervisoresLocales(request, detalles, previos, nombres),
    pendienteSync: true
  };
  aplicarTotales(corte, request);
  return corte;
}

/** Aplica una edicion sobre un corte conocido (conserva id, numero y clienteUuid). */
export function aplicarEdicionLocal(
  existente: Corte,
  request: CorteRequest,
  nombres: ResolutorNombres,
  pendienteSync: boolean
): Corte {
  const detalles = detallesLocales(request, nombres);
  const corte: Corte = {
    ...existente,
    horaInicio: normalizarHora(request.horaInicio),
    horaFin: normalizarHora(request.horaFin),
    fechaCosecha: request.fechaCosecha ?? null,
    observacion: request.observacion ?? null,
    detalles,
    supervisores: supervisoresLocales(request, detalles, existente.supervisores, nombres),
    pendienteSync
  };
  aplicarTotales(corte, request);
  return corte;
}

/** Ingreso de materia prima provisional (el servidor recalcula el peso promedio al sincronizar). */
export function construirIngresoLocal(
  existente: IngresoMateriaPrima | undefined,
  request: IngresoMateriaPrimaRequest,
  nombres: ResolutorNombres
): IngresoMateriaPrima {
  return {
    id: existente?.id ?? -request.variedadId,
    variedadId: request.variedadId,
    variedadNombre: existente?.variedadNombre ?? nombres.variedad(request.variedadId) ?? `Variedad ${request.variedadId}`,
    jabas: request.jabas,
    kilos: request.kilos,
    pesoPromedioPorJaba: request.jabas > 0 ? redondear(request.kilos / request.jabas) : null,
    actualizadoEn: new Date().toISOString()
  };
}
