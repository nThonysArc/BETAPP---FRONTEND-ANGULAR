export interface VariedadDetalle {
  clienteUuid: string | null;
  variedad: string;
  jabas: number;
  pesoPorViaje: number;
  orden: number;
}

export interface MaquinaKato {
  clienteUuid: string | null;
  maquinaId: number;
  maquinaNombre: string | null;
  katoNombre: string;
  empacadores: number;
  kgPorEmpacador: number;
  orden: number;
}

export interface CortePlantilla {
  procesoDiarioId: number;
  numeroCorteSugerido: number;
  horaInicio: string;   // HH:mm:ss
  horaFin: string;
  fechaCosecha: string | null;
  variedades: VariedadDetalle[];
  maquinasKato: MaquinaKato[];
}

export interface CorteRequest {
  clienteUuid: string;
  horaInicio: string;
  horaFin: string;
  fechaCosecha?: string | null;
  observacion?: string | null;
  variedades: VariedadDetalle[];
  maquinasKato: MaquinaKato[];
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
  estado: 'BORRADOR' | 'CONSOLIDADO';
  consolidadoEn: string | null;
  requiereRevision: boolean;
  clienteUuid: string;
  variedades: VariedadDetalle[];
  maquinasKato: MaquinaKato[];
}
