export interface Campana {
  id: number;
  productoId: number;
  productoNombre: string;
  nombre: string;
  anio: number;
  fechaInicio: string;   // ISO date (YYYY-MM-DD)
  fechaFin: string | null;
  activa: boolean;
}

export interface CampanaRequest {
  productoId: number;
  nombre: string;
  anio: number;
  fechaInicio: string;
  fechaFin?: string | null;
}
