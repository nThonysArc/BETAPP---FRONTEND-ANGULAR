export interface ProcesoDiario {
  id: number;
  campanaId: number;
  campanaNombre: string;
  fecha: string;  // ISO date
  estado: 'ABIERTO' | 'CERRADO';
}

export interface ProcesoDiarioRequest {
  campanaId: number;
  fecha: string;
}
