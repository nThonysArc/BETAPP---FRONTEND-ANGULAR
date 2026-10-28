export interface Producto {
  id: number;
  nombre: string;
  unidadMedida: string;
  /** Formato del reporte de avance por hora: ARANDANO (maquina/kato) o VID (modulo/personas). */
  plantillaReporte: 'ARANDANO' | 'VID';
  activo: boolean;
}
