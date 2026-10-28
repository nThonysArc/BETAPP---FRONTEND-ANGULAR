/**
 * Hallazgo de consistencia del avance por hora (Vid). Nunca bloquea el guardado:
 * avisa para que el supervisor revise el dato antes de compartir el reporte.
 */
export interface Advertencia {
  /** Numero de hora (1..n) o null si aplica a todo el dia. */
  hora: number | null;
  /** Modulo afectado o null si aplica a toda la hora / dia. */
  modulo: string | null;
  codigo: string;
  mensaje: string;
}
