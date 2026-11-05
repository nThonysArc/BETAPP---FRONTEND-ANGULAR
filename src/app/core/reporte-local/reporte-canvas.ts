/**
 * Dibujo del reporte de avance de Arandano en un <canvas> (espejo de ReporteExcelRenderer.java), para poder
 * generar la imagen EN EL CELULAR sin conexion. Mismas medidas, colores y reglas de texto que el servidor:
 * la imagen debe verse igual salga de donde salga.
 *
 * El texto del Excel original esta comprimido horizontalmente (~0.75), por eso se dibuja con esa condensacion
 * (factor K). Se escribe a 10x y se reduce con una transformacion: evita que el "hinting" de tamanos
 * chicos recorte los espacios (igual que hace el servidor).
 */

import { LoteReporte, ReporteDatos } from './reporte-datos';
import {
  ALTO_ENCABEZADO, ALTO_FILA_PIE, ALTO_MIN_BLOQUE, ANCHO, C, ACUM, Diseno, ENCABEZADOS, FECHA, HORA,
  INTERLINEADO_OBS, JABAS, KATO, KG_EMP, MAQUINA, Medidor, OBS, PESO_MAQ, PESO_VIAJE, TOTAL_HORA, VARIEDAD,
  T_CUERPO, T_ENCABEZADO, T_ETIQUETA, T_FECHA, T_HORA, T_MINI, T_MP, T_OBS, T_PIE, T_TITULO,
  fechaCorta, fechaLarga, fmt, hora, mayus, nz
} from './reporte-diseno';

// ---------- Colores medidos sobre el Excel original ----------
const MORADO = 'rgb(112,48,160)';
const MORADO_LINEA = 'rgb(84,34,120)';
const LILA = 'rgb(251,233,249)';
const LILA_SUBTOTAL = 'rgb(238,193,241)';
const GRIS_STOCK = 'rgb(237,237,237)';
const LINEA = 'rgb(52,52,52)';
const LINEA_SUAVE = 'rgb(191,191,191)';
const TEXTO = 'rgb(18,18,18)';
const TEXTO_TENUE = 'rgb(70,70,70)';
const BLANCO = 'rgb(255,255,255)';

/** Condensacion horizontal del Excel original respecto a la fuente natural. */
const K = 0.751;
const ALTURA_MAYUSCULA = 0.644;
const IZQ = 0, CENTRO = 1, DER = 2;

/** Tope de pixeles de la imagen: evita agotar la memoria del celular en reportes muy largos. */
const MAX_PIXELES = 16_000_000;
const ESCALA_MINIMA = 1.5;

export function escalaSegura(ancho: number, alto: number, escala: number): number {
  const maxPorTope = Math.sqrt(MAX_PIXELES / (ancho * alto));
  return Math.max(ESCALA_MINIMA, Math.min(escala, maxPorTope));
}

export interface Imagen {
  fuente: CanvasImageSource;
  ancho: number;
  alto: number;
}

export interface RecursosReporte {
  logo: Imagen | null;
  foto: Imagen | null;
}

const FAMILIA = 'ReporteCarlito';
let fuentesListas: Promise<void> | null = null;

/** Carga Carlito (equivalente metrico de Calibri) una sola vez; viene en la app, no necesita red. */
export function cargarFuentes(base: string = document.baseURI): Promise<void> {
  if (!fuentesListas) {
    const cargar = async (archivo: string, peso: string) => {
      const f = new FontFace(FAMILIA, `url(${new URL('reporte/' + archivo, base).toString()})`, { weight: peso });
      document.fonts.add(await f.load());
    };
    fuentesListas = Promise.all([cargar('Carlito-Regular.ttf', '400'), cargar('Carlito-Bold.ttf', '700')]).then(() => undefined);
    fuentesListas.catch(() => (fuentesListas = null));
  }
  return fuentesListas;
}

export async function cargarImagen(url: string): Promise<Imagen | null> {
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const bmp = await createImageBitmap(await resp.blob());
    return { fuente: bmp, ancho: bmp.width, alto: bmp.height };
  } catch {
    return null;
  }
}

// =====================================================================
// Pintor
// =====================================================================

class Pintor implements Medidor {
  constructor(private readonly g: CanvasRenderingContext2D) {
    g.textRendering = 'geometricPrecision';
    g.fontKerning = 'none';
    g.lineJoin = 'miter';
    g.lineCap = 'square';
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
  }

  private fuente(negrita: boolean, tam: number): string {
    return `${negrita ? 'bold ' : ''}${tam * 10}px ${FAMILIA}`;
  }

  /** Excel redondea el avance de cada glifo a pixeles enteros y el espacio queda mas ancho que el nominal. */
  private anchoEspacio(tam: number): number {
    return 0.32 * tam;
  }

  private anchoNatural(s: string, negrita: boolean, tam: number): number {
    this.g.font = this.fuente(negrita, tam);
    let total = 0;
    const palabras = s.split(' ');
    for (let i = 0; i < palabras.length; i++) {
      total += this.g.measureText(palabras[i]).width / 10;
      if (i < palabras.length - 1) total += this.anchoEspacio(tam);
    }
    return total;
  }

  ancho(s: string, negrita: boolean, tam: number): number {
    return this.anchoNatural(s, negrita, tam) * K;
  }

  /** Texto de una linea, centrado vertical en la celda; se condensa mas si no cabe. */
  texto(s: string | null, negrita: boolean, tam: number, color: string, x: number, y: number, w: number, h: number, alineacion: number): void {
    if (!s) return;
    const natural = this.ancho(s, negrita, tam);
    const disponible = w - 4;
    const factor = natural > disponible && disponible > 0 ? disponible / natural : 1;
    const tw = natural * factor;
    const px = alineacion === CENTRO ? x + (w - tw) / 2 : alineacion === DER ? x + w - tw - 2 : x + 2;
    const base = y + h / 2 + (ALTURA_MAYUSCULA * tam) / 2;
    this.dibujar(s, negrita, tam, color, px, base, K * factor);
  }

  /** Varias lineas centradas horizontal y verticalmente dentro de la celda. */
  lineas(ls: string[], negrita: boolean, tam: number, color: string, x: number, y: number, w: number, h: number, interlineado: number): void {
    if (ls.length === 0) return;
    const alturaBloque = interlineado * (ls.length - 1) + ALTURA_MAYUSCULA * tam;
    const top = y + (h - alturaBloque) / 2;
    ls.forEach((s, i) => {
      if (!s) return;
      const natural = this.ancho(s, negrita, tam);
      const disponible = w - 4;
      const factor = natural > disponible && disponible > 0 ? disponible / natural : 1;
      const px = x + (w - natural * factor) / 2;
      const base = top + ALTURA_MAYUSCULA * tam + i * interlineado;
      this.dibujar(s, negrita, tam, color, px, base, K * factor);
    });
  }

  /** Parte el texto en lineas que caben en el ancho dado (respeta los saltos de linea escritos). */
  ajustar(texto: string, negrita: boolean, tam: number, anchoMax: number): string[] {
    const resultado: string[] = [];
    for (const parrafo of texto.split(/\r\n|\r|\n/)) {
      let actual = '';
      for (const palabra of parrafo.trim().split(/\s+/)) {
        if (!palabra) continue;
        const candidato = actual === '' ? palabra : actual + ' ' + palabra;
        if (actual === '' || this.ancho(candidato, negrita, tam) <= anchoMax) {
          actual = candidato;
        } else {
          resultado.push(actual);
          actual = palabra;
        }
      }
      resultado.push(actual);
    }
    return resultado;
  }

  private dibujar(s: string, negrita: boolean, tam: number, color: string, px: number, base: number, kx: number): void {
    const g = this.g;
    g.save();
    g.translate(px, base);
    g.scale(kx / 10, 0.1);
    g.font = this.fuente(negrita, tam);
    g.fillStyle = color;
    g.textBaseline = 'alphabetic';
    g.textAlign = 'left';
    let x = 0;
    const palabras = s.split(' ');
    for (let i = 0; i < palabras.length; i++) {
      g.fillText(palabras[i], x * 10, 0);
      x += g.measureText(palabras[i]).width / 10 + this.anchoEspacio(tam);
    }
    g.restore();
  }

  rellenar(x: number, y: number, w: number, h: number, c: string): void {
    this.g.fillStyle = c;
    this.g.fillRect(x, y, w, h);
  }

  bordeRect(x: number, y: number, w: number, h: number, c: string, grosor: number): void {
    this.lineaH(x, x + w, y, c, grosor);
    this.lineaH(x, x + w, y + h, c, grosor);
    this.lineaV(x, y, y + h, c, grosor);
    this.lineaV(x + w, y, y + h, c, grosor);
  }

  lineaH(x0: number, x1: number, y: number, c: string, grosor: number): void {
    this.linea(x0, y, x1, y, c, grosor);
  }

  lineaV(x: number, y0: number, y1: number, c: string, grosor: number): void {
    this.linea(x, y0, x, y1, c, grosor);
  }

  private linea(x0: number, y0: number, x1: number, y1: number, c: string, grosor: number): void {
    const g = this.g;
    g.strokeStyle = c;
    g.lineWidth = grosor;
    g.beginPath();
    g.moveTo(x0, y0);
    g.lineTo(x1, y1);
    g.stroke();
  }

  /** Imagen ajustada dentro del recuadro, sin deformarla. Si falta, el reporte sale igual. */
  imagen(img: Imagen | null, x: number, y: number, w: number, h: number): void {
    if (!img) return;
    const esc = Math.min(w / img.ancho, h / img.alto);
    const iw = img.ancho * esc;
    const ih = img.alto * esc;
    this.g.drawImage(img.fuente, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
  }
}

// =====================================================================
// Dibujo del reporte
// =====================================================================

function dibujarEncabezadoSuperior(d: Diseno, p: Pintor, r: RecursosReporte): void {
  p.imagen(r.logo, 42, 18, 95, 49);
  p.imagen(r.foto, 788, 21, 86, 55);

  p.texto(mayus(d.d.titulo), true, T_TITULO, TEXTO, 140.5, 17, 620, 21, CENTRO);

  p.texto('FECHA PROCESO:', true, T_ETIQUETA, TEXTO, 58, 72, 100, 14, IZQ);
  p.texto(fechaLarga(d.d.fechaProceso), true, T_FECHA, TEXTO, 161, 72, 60, 14, IZQ);

  p.texto('TOTAL A PROCESAR:', true, T_ETIQUETA, TEXTO, 328, 52, 110, 14, IZQ);

  const x0 = 480, x1 = 541.5, x2 = 592.5, x3 = 692.5;
  p.rellenar(x0, 43, x3 - x0, 11, MORADO);
  p.lineaV(x1, 43, 54, MORADO_LINEA, 0.6);
  p.lineaV(x2, 43, 54, MORADO_LINEA, 0.6);
  p.texto('JABAS', true, T_MINI, BLANCO, x0, 43, x1 - x0, 11, CENTRO);
  p.texto('KILOS', true, T_MINI, BLANCO, x1, 43, x2 - x1, 11, CENTRO);
  p.texto('VARIEDAD', true, T_MINI, BLANCO, x2, 43, x3 - x2, 11, CENTRO);

  let y = d.yMiniFilas;
  d.d.ingresos.forEach((l: LoteReporte) => {
    p.rellenar(x0, y, x3 - x0, 10.1, BLANCO);
    p.bordeRect(x0, y, x1 - x0, 10.1, LINEA_SUAVE, 0.6);
    p.bordeRect(x1, y, x2 - x1, 10.1, LINEA_SUAVE, 0.6);
    p.bordeRect(x2, y, x3 - x2, 10.1, LINEA_SUAVE, 0.6);
    p.texto(fmt(l.jabas, 0), true, T_MINI, TEXTO, x0, y, x1 - x0, 10.1, CENTRO);
    p.texto(fmt(l.kilos, 1), true, T_MINI, TEXTO, x1, y, x2 - x1, 10.1, CENTRO);
    p.texto(mayus(l.variedad), true, T_MINI, TEXTO, x2, y, x3 - x2, 10.1, CENTRO);
    p.texto(fechaCorta(l.fecha), false, 10.4, TEXTO, 440, y, 37, 10.1, DER);
    y += 10.1;
  });
  p.rellenar(x0, d.ySubtotal, x2 - x0, 10.5, LILA_SUBTOTAL);
  p.bordeRect(x0, d.ySubtotal, x1 - x0, 10.5, LINEA_SUAVE, 0.6);
  p.bordeRect(x1, d.ySubtotal, x2 - x1, 10.5, LINEA_SUAVE, 0.6);
  p.texto(fmt(d.mpJabas, 0), true, T_MINI, TEXTO, x0, d.ySubtotal, x1 - x0, 10.5, CENTRO);
  p.texto(fmt(d.mpKilos, 1), true, T_MINI, TEXTO, x1, d.ySubtotal, x2 - x1, 10.5, CENTRO);

  // TOTAL M.P / PROCESADO / STOCK
  const h = 10.5;
  const yA = d.yMp, yB = d.yMp + 13, yC = d.yMp + 26;

  p.texto('TOTAL M.P', true, T_MP, TEXTO, 420, yA, 57, h, DER);
  p.rellenar(x0, yA, x2 - x0, h, MORADO);
  p.lineaV(x1, yA, yA + h, MORADO_LINEA, 0.6);
  p.texto(fmt(d.mpJabas, 0), true, T_MINI, BLANCO, x0, yA, x1 - x0, h, CENTRO);
  p.texto(fmt(d.mpKilos, 2), true, T_MINI, BLANCO, x1, yA, x2 - x1, h, CENTRO);

  p.texto('PROCESADO', true, T_MP, TEXTO, 420, yB, 57, h, DER);
  p.rellenar(x0, yB, x2 - x0, h, BLANCO);
  p.bordeRect(x0, yB, x1 - x0, h, LINEA_SUAVE, 0.6);
  p.bordeRect(x1, yB, x2 - x1, h, LINEA_SUAVE, 0.6);
  p.texto(fmt(d.totJabas, 0), false, T_MINI, TEXTO_TENUE, x0, yB, x1 - x0, h, CENTRO);
  p.texto(fmt(d.totKilos, 1), false, T_MINI, TEXTO_TENUE, x1, yB, x2 - x1, h, CENTRO);

  p.texto('STOCK', true, T_MP, TEXTO, 420, yC, 57, h, DER);
  p.rellenar(x0, yC, x2 - x0, h, GRIS_STOCK);
  p.bordeRect(x0, yC, x1 - x0, h, LINEA_SUAVE, 0.6);
  p.bordeRect(x1, yC, x2 - x1, h, LINEA_SUAVE, 0.6);
  p.texto(fmt(d.mpJabas - d.totJabas, 0), true, T_MINI, TEXTO, x0, yC, x1 - x0, h, CENTRO);
  p.texto(fmt(d.mpKilos - d.totKilos, 1), true, T_MINI, TEXTO, x1, yC, x2 - x1, h, CENTRO);
}

function dibujarTablaPrincipal(d: Diseno, p: Pintor): void {
  const yTabla = d.yTabla;

  // Encabezado morado
  p.rellenar(C[0], yTabla, C[13] - C[0], ALTO_ENCABEZADO, MORADO);
  ENCABEZADOS.forEach((enc, i) => {
    if (i > 0) p.lineaV(C[i], yTabla, yTabla + ALTO_ENCABEZADO, MORADO_LINEA, 0.6);
    p.lineas(enc.split('\n'), true, T_ENCABEZADO, BLANCO, C[i], yTabla, C[i + 1] - C[i], ALTO_ENCABEZADO, 9.4);
  });

  if (d.bloques.length === 0) {
    p.rellenar(C[0], yTabla + ALTO_ENCABEZADO, C[13] - C[0], ALTO_MIN_BLOQUE, LILA);
    p.bordeRect(C[0], yTabla + ALTO_ENCABEZADO, C[13] - C[0], ALTO_MIN_BLOQUE, LINEA, 0.8);
    p.texto('SIN CORTES REGISTRADOS', false, T_CUERPO, TEXTO, C[0], yTabla + ALTO_ENCABEZADO, C[13] - C[0], ALTO_MIN_BLOQUE, CENTRO);
    return;
  }

  for (const b of d.bloques) {
    const y0 = b.y, y1 = b.y + b.alto;
    p.rellenar(C[0], y0, C[13] - C[0], b.alto, LILA);

    if (b.pausa) {
      p.texto('ALMUERZO DEL PERSONAL', true, T_CUERPO, TEXTO, C[0], y0, C[13] - C[0], b.alto, CENTRO);
      p.lineaV(C[0], y0, y1, LINEA, 0.8);
      p.lineaV(C[13], y0, y1, LINEA, 0.8);
      p.lineaH(C[0], C[13], y0, LINEA, 0.8);
      p.lineaH(C[0], C[13], y1, LINEA, 0.8);
      continue;
    }

    // Numero de corte, fuera de la tabla
    p.texto(String(b.numero), true, T_CUERPO, TEXTO, 17, y0, 20, b.alto, CENTRO);

    // Celdas combinadas por hora
    const c = b.corte;
    p.lineas([hora(c.inicio), 'A', hora(c.fin)], true, T_HORA, TEXTO, C[HORA], y0, C[HORA + 1] - C[HORA], b.alto, 11.5);
    p.texto(fechaCorta(c.fechaCosecha), false, T_CUERPO, TEXTO, C[FECHA], y0, C[FECHA + 1] - C[FECHA], b.alto, CENTRO);
    p.texto(fmt(c.pesoTotal, 1), false, T_CUERPO, TEXTO, C[TOTAL_HORA], y0, C[TOTAL_HORA + 1] - C[TOTAL_HORA], b.alto, CENTRO);
    p.texto(fmt(b.acumulado, 1), false, T_CUERPO, TEXTO, C[ACUM], y0, C[ACUM + 1] - C[ACUM], b.alto, CENTRO);

    if (b.lineasObsGeneral) {
      p.lineas(b.lineasObsGeneral, false, T_OBS, TEXTO, C[OBS], y0, C[OBS + 1] - C[OBS], b.alto, INTERLINEADO_OBS);
    }

    // Grupos por maquina
    const almuerzos: { y: number; g: (typeof b.grupos)[number] }[] = [];
    let y = y0;
    b.grupos.forEach((g, gi) => {
      const rowH = g.alto / g.filas.length;

      // Separador entre maquinas (no en HORA/FECHA/TOTAL/ACUM). Con observacion GENERAL la columna
      // OBSERVACION es una sola celda para toda la hora: el separador no la cruza.
      if (gi > 0) {
        p.lineaH(C[VARIEDAD], C[TOTAL_HORA], y, LINEA, 0.8);
        p.lineaH(C[MAQUINA], b.lineasObsGeneral ? C[OBS] : C[13], y, LINEA, 0.8);
      }

      // VARIEDAD combinada por tramos consecutivos iguales
      let inicioTramo = 0;
      for (let i = 1; i <= g.filas.length; i++) {
        const corta = i === g.filas.length || g.filas[i].variedad !== g.filas[inicioTramo].variedad;
        if (corta) {
          const ty = y + inicioTramo * rowH;
          const th = (i - inicioTramo) * rowH;
          p.texto(mayus(g.filas[inicioTramo].variedad), false, T_CUERPO, TEXTO, C[VARIEDAD], ty, C[VARIEDAD + 1] - C[VARIEDAD], th, CENTRO);
          if (inicioTramo > 0) p.lineaH(C[VARIEDAD], C[JABAS], ty, LINEA, 0.8);
          inicioTramo = i;
        }
      }

      // PESO POR MAQUINA y OBSERVACION combinadas por maquina
      p.texto(fmt(g.pesoMaquina, 1), false, T_CUERPO, TEXTO, C[PESO_MAQ], y, C[PESO_MAQ + 1] - C[PESO_MAQ], g.alto, CENTRO);
      if (g.lineasObs.length > 0) {
        p.lineas(g.lineasObs, false, T_OBS, TEXTO, C[OBS], y, C[OBS + 1] - C[OBS], g.alto, INTERLINEADO_OBS);
      }

      // Maquina en almuerzo: JABAS y PESO POR VIAJE se combinan en un solo texto
      if (g.almuerzo) almuerzos.push({ y, g });

      // Filas
      g.filas.forEach((f, i) => {
        const ry = y + i * rowH;
        if (i > 0) {
          if (!g.almuerzo) p.lineaH(C[JABAS], C[PESO_MAQ], ry, LINEA, 0.8);
          p.lineaH(C[MAQUINA], C[OBS], ry, LINEA, 0.8);
        }
        if (!g.almuerzo) {
          p.texto(fmt(f.jabas, 0), false, T_CUERPO, TEXTO, C[JABAS], ry, C[JABAS + 1] - C[JABAS], rowH, CENTRO);
          p.texto(fmt(f.peso, 1, false), false, T_CUERPO, TEXTO, C[PESO_VIAJE], ry, C[PESO_VIAJE + 1] - C[PESO_VIAJE], rowH, CENTRO);
        }
        p.texto(mayus(f.maquina), false, T_CUERPO, TEXTO, C[MAQUINA], ry, C[MAQUINA + 1] - C[MAQUINA], rowH, CENTRO);
        p.texto(mayus(f.kato), false, T_CUERPO, TEXTO, C[KATO], ry, C[KATO + 1] - C[KATO], rowH, CENTRO);
        p.texto(String(f.empacadores), false, T_CUERPO, TEXTO, C[10], ry, C[10 + 1] - C[10], rowH, CENTRO);
        p.texto(fmt(f.kgPorEmpacador, 0) + ' Kg', false, T_CUERPO, TEXTO, C[KG_EMP], ry, C[KG_EMP + 1] - C[KG_EMP], rowH, CENTRO);
      });
      y += g.alto;
    });

    // Lineas verticales de todas las columnas y horizontales del bloque
    for (const x of C) p.lineaV(x, y0, y1, LINEA, 0.8);
    p.lineaH(C[0], C[13], y0, LINEA, 0.8);
    p.lineaH(C[0], C[13], y1, LINEA, 0.8);

    // Maquina en almuerzo: JABAS y PESO POR VIAJE son una sola celda combinada: se borra la linea
    // vertical que las separa y se escribe el texto encima.
    for (const a of almuerzos) {
      p.rellenar(C[PESO_VIAJE] - 0.7, a.y + 0.6, 1.4, a.g.alto - 1.2, LILA);
      p.lineas(['ALMUERZO DE PERSONAL', mayus(a.g.filas[0].maquina)], false, T_CUERPO, TEXTO,
        C[JABAS], a.y, C[PESO_MAQ] - C[JABAS], a.g.alto, 10.5);
    }
  }
}

function dibujarPie(d: Diseno, p: Pintor): void {
  const acumuladoPrevio = d.totJabas - d.ultJabas;
  const kilosPrevio = d.totKilos - d.ultKilos;

  const etiquetas = ['TOTAL', 'ACUMULADO', 'TOTAL ACUMULADO', 'STOCK'];
  const jabas = [fmt(d.ultJabas, 0), fmt(acumuladoPrevio, 0), fmt(d.totJabas, 0), fmt(d.mpJabas - d.totJabas, 0)];
  const kilos = [fmt(d.ultKilos, 0), fmt(kilosPrevio, 0), fmt(d.totKilos, 1), fmt(d.mpKilos - d.totKilos, 2)];

  for (let i = 0; i < 4; i++) {
    const y = d.yPie + i * ALTO_FILA_PIE;
    p.rellenar(C[FECHA], y, C[PESO_MAQ] - C[FECHA], ALTO_FILA_PIE, MORADO);
    p.lineaV(C[JABAS], y, y + ALTO_FILA_PIE, MORADO_LINEA, 0.6);
    p.lineaV(C[PESO_VIAJE], y, y + ALTO_FILA_PIE, MORADO_LINEA, 0.6);
    if (i > 0) p.lineaH(C[FECHA], C[PESO_MAQ], y, MORADO_LINEA, 0.6);
    p.texto(etiquetas[i], true, T_PIE, BLANCO, C[FECHA], y, C[JABAS] - C[FECHA], ALTO_FILA_PIE, CENTRO);
    p.texto(jabas[i], true, T_PIE, BLANCO, C[JABAS], y, C[PESO_VIAJE] - C[JABAS], ALTO_FILA_PIE, CENTRO);
    p.texto(kilos[i], true, T_PIE, BLANCO, C[PESO_VIAJE], y, C[PESO_MAQ] - C[PESO_VIAJE], ALTO_FILA_PIE, CENTRO);
  }
}

function dibujarResumen(d: Diseno, p: Pintor): void {
  const xJ = C[FECHA], xK = C[VARIEDAD], xS = C[JABAS], xF = C[PESO_MAQ];
  let y = d.yResumen;

  // Encabezado lila
  p.rellenar(xJ, y, xF - xJ, 20, LILA);
  p.bordeRect(xJ, y, xK - xJ, 20, LINEA_SUAVE, 0.7);
  p.bordeRect(xK, y, xS - xK, 20, LINEA_SUAVE, 0.7);
  p.bordeRect(xS, y, xF - xS, 20, LINEA_SUAVE, 0.7);
  p.texto('JABAS', true, T_PIE, TEXTO, xJ, y, xK - xJ, 20, CENTRO);
  p.texto('KILOS', true, T_PIE, TEXTO, xK, y, xS - xK, 20, CENTRO);
  p.texto('SUPERVISOR', true, T_PIE, TEXTO, xS, y, xF - xS, 20, CENTRO);
  y += 20;

  for (const r of d.resumen) {
    p.rellenar(C[0], y, C[FECHA] - C[0], r.alto, MORADO);
    p.lineaH(C[0], C[FECHA], y, MORADO_LINEA, 0.6);
    p.texto(r.nombre, true, T_PIE, BLANCO, C[0], y, C[FECHA] - C[0], r.alto, CENTRO);

    p.rellenar(xJ, y, xF - xJ, r.alto, BLANCO);
    p.bordeRect(xJ, y, xK - xJ, r.alto, LINEA_SUAVE, 0.7);
    p.bordeRect(xK, y, xS - xK, r.alto, LINEA_SUAVE, 0.7);
    p.bordeRect(xS, y, xF - xS, r.alto, LINEA_SUAVE, 0.7);
    p.texto(fmt(r.jabas, 1), true, T_PIE, TEXTO, xJ, y, xK - xJ, r.alto, CENTRO);
    p.texto(fmt(r.kilos, 1), true, T_PIE, TEXTO, xK, y, xS - xK, r.alto, CENTRO);
    if (r.lineas.length > 0) p.lineas(r.lineas, true, T_PIE, TEXTO, xS, y, xF - xS, r.alto, 10.6);
    y += r.alto;
  }

  // Total general (solo jabas y kilos)
  let tj = 0, tk = 0;
  for (const r of d.resumen) {
    tj += r.jabas;
    tk += r.kilos;
  }
  p.rellenar(xJ, y, xS - xJ, 19.7, LILA);
  p.bordeRect(xJ, y, xK - xJ, 19.7, LINEA_SUAVE, 0.7);
  p.bordeRect(xK, y, xS - xK, 19.7, LINEA_SUAVE, 0.7);
  p.texto(fmt(tj, 0), true, T_PIE, TEXTO, xJ, y, xK - xJ, 19.7, CENTRO);
  p.texto(fmt(tk, 1), true, T_PIE, TEXTO, xK, y, xS - xK, 19.7, CENTRO);
}

// =====================================================================
// API
// =====================================================================

function crearLienzo(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** Dibuja el reporte y devuelve el PNG. `escala` = pixeles por unidad de diseno (3 = igual que el servidor). */
export async function renderizarReportePng(datos: ReporteDatos, recursos: RecursosReporte, escala = 3): Promise<Blob> {
  await cargarFuentes();

  const medida = crearLienzo(1, 1).getContext('2d')!;
  const diseno = new Diseno(datos, new Pintor(medida));

  escala = escalaSegura(ANCHO, diseno.altoTotal, escala);
  const pw = Math.round(ANCHO * escala);
  const ph = Math.ceil(diseno.altoTotal * escala);
  const lienzo = crearLienzo(pw, ph);
  const g = lienzo.getContext('2d')!;
  g.fillStyle = BLANCO;
  g.fillRect(0, 0, pw, ph);
  g.scale(escala, escala);

  const p = new Pintor(g);
  dibujarEncabezadoSuperior(diseno, p, recursos);
  dibujarTablaPrincipal(diseno, p);
  dibujarPie(diseno, p);
  dibujarResumen(diseno, p);

  return new Promise<Blob>((ok, error) =>
    lienzo.toBlob((b) => (b ? ok(b) : error(new Error('No se pudo generar la imagen del reporte'))), 'image/png'));
}

/** Para pruebas y para la exportacion a Excel: el diseno sin dibujar. */
export async function disenarReporte(datos: ReporteDatos): Promise<Diseno> {
  await cargarFuentes();
  return new Diseno(datos, new Pintor(crearLienzo(1, 1).getContext('2d')!));
}
