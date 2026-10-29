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
 * Mensaje listo para enviar. `numeroHora` es la ultima hora de produccion registrada
 * (null si aun no hay ninguna: entonces se omite la linea de la hora).
 */
export function construirMensajeReporte(ahora: Date, numeroHora: number | null, producto = 'arándano fresco'): string {
  const base = `${saludoSegunHora(ahora)}, se adjunta avance por hora del proceso de ${producto}`;
  return numeroHora != null ? `${base}:\n${textoHora(numeroHora)}` : `${base}.`;
}
