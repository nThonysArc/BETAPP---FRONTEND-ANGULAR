/** Escritura que quedo pendiente de enviar al servidor porque no habia conexion. */
export interface EscrituraPendiente {
  /** Numero de secuencia asignado por IndexedDB: define el orden de envio (FIFO). */
  seq?: number;
  metodo: 'POST' | 'PUT';
  /** URL completa tal como se enviaria. */
  url: string;
  cuerpo: unknown;
  /** Proceso diario al que pertenece (para saber que pantallas deben leer datos locales). */
  procesoId: number | null;
  tipo: 'CORTE_CREAR' | 'CORTE_EDITAR' | 'MATERIA_PRIMA' | 'PROCESO_CERRAR' | 'PROCESO_REABRIR';
  /** Para CORTE_CREAR: id temporal (negativo) con el que la pantalla ve el corte mientras no se envia. */
  idTemporal?: number;
  /** Texto corto para mostrar al usuario (ej. "Corte 3"). */
  etiqueta: string;
  creadoEn: string;
  /** Si el servidor la rechazo con un error de negocio (4xx), el mensaje; la cola se detiene hasta resolverlo. */
  error?: string;
}

export interface EntradaCache {
  key: string;
  url: string;
  cuerpo: unknown;
  guardadoEn: string;
}
