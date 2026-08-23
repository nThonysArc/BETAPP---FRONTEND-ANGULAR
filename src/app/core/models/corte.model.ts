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

export interface CortePlantilla {
  procesoDiarioId: number;
  numeroCorteSugerido: number;
  horaInicio: string;
  horaFin: string;
  fechaCosecha: string | null;
  detalles: CorteDetalle[];
}

export interface CorteRequest {
  clienteUuid: string;
  horaInicio: string;
  horaFin: string;
  fechaCosecha?: string | null;
  observacion?: string | null;
  detalles: CorteDetalle[];
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
}
