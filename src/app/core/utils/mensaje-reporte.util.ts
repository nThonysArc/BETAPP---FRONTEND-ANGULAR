/**
 * Texto del mensaje que acompana la imagen del reporte al compartirla (WhatsApp, correo).
 * Funciones puras (reciben la hora como parametro) para poder probarlas sin reloj real.
 */

/** "Buenos dias" hasta las 11:59, "Buenas tardes" de 12:00 a 18:59, "Buenas noches" desde las 19:00. */
export function saludoSegunHora(fecha: Date): string {
  const h = fecha.getHours();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

const ORDINALES: Record<number, string> = {
  1: '1ra', 2: '2da', 3: '3ra', 4: '4ta', 5: '5ta', 6: '6ta', 7: '7ma', 8: '8va', 9: '9na', 10: '10ma'
};

/** "1ra hora", "2da hora"... Pasada la 10ma se usa "hora 11" para no inventar abreviaturas dudosas. */
export function textoHora(numero: number): string {
  const ord = ORDINALES[numero];
  return ord ? `${ord} hora` : `hora ${numero}`;
}

/**
 * Nombre del proceso tal como se dice en el mensaje, a partir del nombre del producto en el sistema
 * ("Arándano fresco" -> "arándano fresco"). Solo baja la primera letra si la segunda ya es minuscula,
 * para no romper siglas como "EVF".
 */
export function nombreProcesoParaMensaje(nombre: string): string {
  const n = nombre.trim();
  if (n.length > 1 && n[1] === n[1].toLowerCase() && n[1] !== n[1].toUpperCase()) {
    return n[0].toLowerCase() + n.slice(1);
  }
  return n;
}

/** Texto de respaldo cuando no se pudo averiguar el producto (p. ej. sin conexion). */
export function procesoPorDefecto(plantilla: 'ARANDANO' | 'VID' | null | undefined): string {
  return plantilla === 'VID' ? 'selección Vid' : 'arándano fresco';
}

/**
 * Mensaje listo para enviar, mismo formato para todo cultivo/proceso:
 *   "Buenas tardes, se envía avance por hora de proceso de <proceso>:\n1ra hora"
 * `numeroHora` es la ultima hora registrada (null si aun no hay: se omite esa linea).
 */
export function construirMensajeReporte(ahora: Date, numeroHora: number | null, proceso: string): string {
  const base = `${saludoSegunHora(ahora)}, se envía avance por hora de proceso de ${proceso}`;
  return numeroHora != null ? `${base}:\n${textoHora(numeroHora)}` : `${base}.`;
}
