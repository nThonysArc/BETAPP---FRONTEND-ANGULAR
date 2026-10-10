export interface CorteDetalle {
  clienteUuid: string | null;
  maquinaId: number;
  maquinaNombre: string | null;
  maquinaKatoId: number;
  katoNombre: string | null;
  variedadId: number;
  variedadNombre: string | null;
  jabas: number;
  pesoTotal: number;
  empacadores: number;
  kgPorEmpacador: number;
  orden: number;
}

/** Supervisor de una maquina durante un corte (uno por maquina y por hora). */
export interface CorteSupervisor {
  maquinaId: number;
  maquinaNombre: string | null;
  supervisorId: number | null;
  supervisorNombre: string | null;
  /** Observacion de esta maquina en esta hora (sale en la columna OBSERVACION del reporte). */
  observacion: string | null;
  /** La maquina salio a almorzar en esta hora (su produccion queda en 0). */
  almuerzo: boolean;
}

export interface CortePlantilla {
  procesoDiarioId: number;
  numeroCorteSugerido: number;
  horaInicio: string;
  horaFin: string;
  fechaCosecha: string | null;
  detalles: CorteDetalle[];
  supervisores: CorteSupervisor[];
}

export interface CorteRequest {
  clienteUuid: string;
  horaInicio: string;
  horaFin: string;
  fechaCosecha?: string | null;
  observacion?: string | null;
  detalles: CorteDetalle[];
  supervisores?: CorteSupervisor[];
  jabasTotalAjustado?: number | null;
  pesoTotalAjustado?: number | null;
  motivoAjuste?: string | null;
}

export interface Corte {
  id: number;
  procesoDiarioId: number;
  numeroCorte: number;
  horaInicio: string;
  horaFin: string;
  fechaCosecha: string | null;
  observacion: string | null;
  jabasTotalCalculado: number;
  jabasTotalAjustado: number | null;
  jabasTotalEfectivo: number;
  pesoTotalCalculado: number;
  pesoTotalAjustado: number | null;
  pesoTotalEfectivo: number;
  requiereRevision: boolean;
  clienteUuid: string;
  detalles: CorteDetalle[];
  supervisores: CorteSupervisor[];
}
