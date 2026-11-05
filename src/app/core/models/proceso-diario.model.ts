export interface ProcesoDiario {
  id: number;
  campanaId: number;
  campanaNombre: string;
  fecha: string;  // ISO date
  estado: 'ABIERTO' | 'CERRADO';
  totalCortes: number;
  /** Jabas que se proyecta procesar en el dia (solo Vid). null = no registrada. */
  proyeccionJabas?: number | null;
  /** Stock digitado que quedo de un dia previo (Vid). null = el reporte lo deduce del historial. */
  stockAnteriorJabas?: number | null;
  /** Dia al que corresponde ese stock (ISO). */
  stockAnteriorFecha?: string | null;
}

export interface ProcesoDiarioRequest {
  campanaId: number;
  fecha: string;
}
