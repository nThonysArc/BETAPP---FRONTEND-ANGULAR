/**
 * Correo del avance: arma un archivo .eml (borrador) que Outlook abre listo para enviar, con el mismo
 * formato de siempre:  saludo + frase + IMAGEN del reporte incrustada + "Saludos".
 *
 * Funciones puras y sin Angular para poder probarlas aisladas.
 */

export interface DatosCorreo {
  asunto: string;
  para: string;
  cc: string;
  /** Primera linea del cuerpo: "Buenas Noches, Ing. Christian". */
  saludo: string;
  /** Segunda linea: "Se envía el avance del proceso ARANDANO fresco correspondiente al día 04.11.2026". */
  frase: string;
  /** Imagen PNG del reporte (bytes). */
  png: Uint8Array;
  /** Identificador propio de este correo (para encadenar el siguiente). */
  messageId: string;
  /** Message-ID de los correos anteriores del mismo hilo (el ultimo es al que responde). */
  anteriores: string[];
}

/** "Buenas noches" -> "Buenas Noches" (como se escribe en los correos de Produccion). */
export function saludoCorreo(saludoBase: string, destinatario: string): string {
  const titulo = saludoBase.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  const d = destinatario.trim();
  return d ? `${titulo}, ${d}` : titulo;
}

function sinTildes(t: string): string {
  return t.normalize('NFD').replace(/\p{M}/gu, '');
}

/** "Arándano fresco" -> "ARANDANO fresco" (primera palabra en mayusculas y sin tilde, como el correo actual). */
export function nombreProcesoCorreo(producto: string): string {
  const [primera, ...resto] = producto.trim().split(/\s+/);
  return [sinTildes(primera).toUpperCase(), ...resto].join(' ');
}

/** "2026-11-04" -> "04.11.2026". */
export function fechaConPuntos(iso: string): string {
  const [a, m, d] = iso.split('-');
  return `${d}.${m}.${a}`;
}

/** Asunto base: "AVANCE PROCESO ARANDANO 2026 -04.11.2026" (sin la palabra "fresco" ni tildes). */
export function asuntoBase(producto: string, anio: number | null, fechaIso: string): string {
  const nombre = sinTildes(producto).toUpperCase().replace(/\s+FRESCO\s*$/, '').trim();
  return `AVANCE PROCESO ${nombre}${anio ? ' ' + anio : ''} -${fechaConPuntos(fechaIso)}`;
}

/** Id unico del correo: <avance-<proceso>-<marca de tiempo>@betaapp.local>. */
export function nuevoMessageId(procesoId: number, ahora: number): string {
  return `<avance-${procesoId}-${ahora}@betaapp.local>`;
}

// ---------- MIME ----------

function base64(bytes: Uint8Array): string {
  let bin = '';
  const paso = 0x8000;
  for (let i = 0; i < bytes.length; i += paso) {
    bin += String.fromCharCode(...bytes.subarray(i, i + paso));
  }
  return btoa(bin);
}

function envolver76(b64: string): string {
  return b64.replace(/.{1,76}/g, '$&\r\n').trimEnd();
}

function utf8(texto: string): Uint8Array {
  return new TextEncoder().encode(texto);
}

/** Cabecera con caracteres no ASCII -> palabras codificadas RFC 2047 (partidas para no pasar de 75 caracteres). */
export function cabeceraCodificada(texto: string): string {
  if (/^[\x20-\x7e]*$/.test(texto)) return texto;
  const palabras: string[] = [];
  let actual = '';
  for (const ch of Array.from(texto)) {
    if (utf8(actual + ch).length > 30) {
      palabras.push(actual);
      actual = '';
    }
    actual += ch;
  }
  if (actual) palabras.push(actual);
  return palabras.map((p) => `=?UTF-8?B?${base64(utf8(p))}?=`).join('\r\n ');
}

/** Ancho y alto de un PNG leidos de su cabecera (IHDR). */
export function dimensionesPng(png: Uint8Array): { ancho: number; alto: number } | null {
  if (png.length < 24 || png[1] !== 0x50 || png[2] !== 0x4e || png[3] !== 0x47) return null;
  const v = new DataView(png.buffer, png.byteOffset, png.byteLength);
  return { ancho: v.getUint32(16), alto: v.getUint32(20) };
}

function escaparHtml(t: string): string {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Ancho con el que se muestra la imagen dentro del correo (la imagen real es mas grande y se ve nitida). */
export const ANCHO_IMAGEN_CORREO = 960;

/** Cuerpo HTML. Con `cid` la imagen va incrustada en el .eml; con `src` directo se puede copiar y pegar. */
export function htmlCorreo(d: Pick<DatosCorreo, 'saludo' | 'frase' | 'png'>, srcImagen: string): string {
  const dim = dimensionesPng(d.png);
  const ancho = dim ? Math.min(ANCHO_IMAGEN_CORREO, dim.ancho) : ANCHO_IMAGEN_CORREO;
  const alto = dim ? Math.round((ancho * dim.alto) / dim.ancho) : null;
  const medidas = `width="${ancho}"${alto ? ` height="${alto}"` : ''}`;
  return (
    `<html><body style="font-family:Calibri,Arial,sans-serif;font-size:11pt">` +
    `<p>${escaparHtml(d.saludo)}<br>${escaparHtml(d.frase)}</p>` +
    `<p><img src="${srcImagen}" ${medidas} alt="Avance de produccion" style="max-width:100%;height:auto"></p>` +
    `<p>Saludos</p></body></html>`
  );
}

function listaDirecciones(t: string): string {
  return t.split(/[;,\n]/).map((x) => x.trim()).filter(Boolean).join(', ');
}

/**
 * .eml completo. `X-Unsent: 1` hace que Outlook lo abra como BORRADOR editable (no como correo recibido).
 * Incluye In-Reply-To/References con los correos anteriores del hilo.
 */
export function construirEml(d: DatosCorreo): string {
  const limite = `----=_Avance_${d.messageId.replace(/\W/g, '')}`;
  const cid = 'avance-reporte@betaapp.local';
  const html = htmlCorreo(d, `cid:${cid}`);

  const cab: string[] = ['X-Unsent: 1', 'MIME-Version: 1.0'];
  const para = listaDirecciones(d.para);
  const cc = listaDirecciones(d.cc);
  if (para) cab.push(`To: ${para}`);
  if (cc) cab.push(`Cc: ${cc}`);
  cab.push(`Subject: ${cabeceraCodificada(d.asunto)}`);
  cab.push(`Message-ID: ${d.messageId}`);
  if (d.anteriores.length) {
    cab.push(`In-Reply-To: ${d.anteriores[d.anteriores.length - 1]}`);
    cab.push(`References: ${d.anteriores.join(' ')}`);
  }
  cab.push(`Content-Type: multipart/related; type="text/html"; boundary="${limite}"`);

  const cuerpo = [
    `--${limite}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    envolver76(base64(utf8(html))),
    `--${limite}`,
    'Content-Type: image/png; name="avance.png"',
    'Content-Transfer-Encoding: base64',
    `Content-ID: <${cid}>`,
    'Content-Disposition: inline; filename="avance.png"',
    '',
    envolver76(base64(d.png)),
    `--${limite}--`,
    ''
  ];
  return cab.join('\r\n') + '\r\n\r\n' + cuerpo.join('\r\n');
}
