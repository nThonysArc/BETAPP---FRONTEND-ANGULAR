export interface MaquinaKato {
  id: number;
  maquinaId: number;
  nombre: string;
  orden: number;
  activo: boolean;
}

export interface MaquinaKatoRequest {
  maquinaId: number;
  nombre: string;
  orden?: number;
}
