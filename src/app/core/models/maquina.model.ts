export interface Maquina {
  id: number;
  campanaId: number;
  nombre: string;
  supervisorId: number | null;
  supervisorNombre: string | null;
  orden: number;
  activo: boolean;
}

export interface MaquinaRequest {
  campanaId: number;
  nombre: string;
  supervisorId?: number | null;
  orden?: number;
}
