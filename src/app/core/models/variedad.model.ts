export interface Variedad {
  id: number;
  productoId: number;
  nombre: string;
  orden: number;
  activo: boolean;
}

export interface VariedadRequest {
  productoId: number;
  nombre: string;
  orden?: number;
}
