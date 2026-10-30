/** Estado de la conexion que ve la persona: semaforo. */
export type NivelSenal = 'buena' | 'debil' | 'sin-red';

/** Subconjunto de navigator.connection (solo Chrome/Android la expone; en iPhone es undefined). */
export interface InfoConexion {
  effectiveType?: string;
  rtt?: number;
  downlink?: number;
  saveData?: boolean;
}

/**
 * Semaforo de senal. Funcion pura para poder probarla sin celular:
 *  - rojo: el navegador esta sin red o la ultima peticion fallo por conexion;
 *  - amarillo: hay red pero es lenta (2G/3G, latencia alta, ancho de banda bajo, ahorro de datos);
 *  - verde: todo lo demas (incluye navegadores que no informan la calidad).
 */
export function calidadSenal(enLinea: boolean, conexion?: InfoConexion | null): NivelSenal {
  if (!enLinea) return 'sin-red';
  if (!conexion) return 'buena';
  const lenta = ['slow-2g', '2g', '3g'].includes(conexion.effectiveType ?? '');
  const latenciaAlta = (conexion.rtt ?? 0) >= 1000;
  const anchoBajo = conexion.downlink !== undefined && conexion.downlink > 0 && conexion.downlink < 0.5;
  return lenta || latenciaAlta || anchoBajo || conexion.saveData === true ? 'debil' : 'buena';
}
