/**
 * Dibujo del "Avance por hora de seleccion" de Vid en un <canvas> (espejo de ReporteVidRenderer.java),
 * para generar la imagen en el celular sin conexion. Mismas coordenadas ("unidades de plantilla"),
 * colores, rejilla y reglas de texto que el servidor.
 *
 * Orden de dibujo: primero los rellenos y al final las lineas de rejilla, para que ningun relleno
 * tape el marco de la celda anterior.
 */
import { Imagen, escalaSegura } from './reporte-canvas';
import {
  BloqueHoraVid, FilaModuloVid, ProcesadoDiaVid, ResultadoVid
} from './vid-calculo';

// ---- Paleta ----
const GUINDA = 'rgb(184,17,52)';
const GUINDA_OSCURO = 'rgb(172,16,49)';
const ROSA = 'rgb(247,233,236)';
const ROSA_FUERTE = 'rgb(236,200,208)';
const NEGRO = 'rgb(0,0,0)';
const GRILLA = 'rgb(30,30,30)';
const BLANCO = 'rgb(255,255,255)';
const GRUESO = 1.3;
const FINO = 0.5;

// ---- Geometria ----
const ANCHO = 840;
const DESPLAZAMIENTO = -60;
const LIENZO = 822;
const MIN_BLOQUE = 38.5;
const FUENTE_DATO = 7.4;
const FUENTE_OBS = 6.4;
const E = [131, 179.5, 249.5, 339, 412.5, 491.5, 571.5, 641, 840];
const C_HORA = 0, C_MODULO = 1, C_PERSONAS = 2, C_JABAS = 3, C_TOTAL = 4, C_ACUM = 5, C_REND = 6, C_OBS = 7;
const ALTO_ENCABEZADO = 30;
const ALTO_FILA = 33;
const LINEA_OBS = 10.8;

const FAMILIA = 'ReporteDejaVu';
let fuentesListas: Promise<void> | null = null;

export function cargarFuentesVid(base: string = document.baseURI): Promise<void> {
  if (!fuentesListas) {
    const cargar = async (archivo: string, peso: string) => {
      const f = new FontFace(FAMILIA, `url(${new URL('reporte/' + archivo, base).toString()})`, { weight: peso });
      document.fonts.add(await f.load());
    };
    fuentesListas = Promise.all([cargar('DejaVuSans.ttf', '400'), cargar('DejaVuSans-Bold.ttf', '700')]).then(() => undefined);
    fuentesListas.catch(() => (fuentesListas = null));
  }
  return fuentesListas;
}

export interface EntradaVid {
  titulo: string;
  fechaProceso: string; // 'YYYY-MM-DD'
  resultado: ResultadoVid;
  logo: Imagen | null;
  fotoIzquierda: Imagen | null;
  fotoDerecha: Imagen | null;
}

// ---- Formatos (igual que el servidor) ----
const miles = (v: number): string => Math.round(v).toLocaleString('en-US', { useGrouping: true, maximumFractionDigits: 0 });
const num = (v: number | null | undefined): string => miles(v ?? 0);
const plano = (v: number | null | undefined): string => String(Math.round(v ?? 0));
const dos = (n: number): string => String(n).padStart(2, '0');
const hora24 = (t: string): string => {
  const [h, m] = t.split(':');
  return `${dos(Number(h))}:${dos(Number(m ?? 0))}`;
};
const rangoHora = (a: string, b: string): string => `${hora24(a)}\nA\n${hora24(b)}`;
const fechaLarga = (f: string): string => {
  const [a, m, d] = f.split('-').map(Number);
  return `${dos(d)}/${dos(m)}/${a}`;
};
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const fechaCorta = (f: string): string => {
  const [, m, d] = f.split('-').map(Number);
  return `${dos(d)}-${MESES[m - 1]}`;
};
const fechaPunto = (f: string): string => {
  const [, m, d] = f.split('-').map(Number);
  return `${dos(d)}.${dos(m)}`;
};
const mayus = (s: string | null | undefined): string => (s ?? '').toLocaleUpperCase('es-PE');

const conArrastre = (r: ResultadoVid): boolean => r.porDia.length > 1;

const textoObs = (f: FilaModuloVid): string =>
  f.observacion && f.observacion.trim() !== '' ? f.observacion.trim() : f.almuerzo ? 'ALMUERZO' : '';

const lineaDestacada = (l: string): boolean => {
  const u = l.trimStart().toLocaleUpperCase('en-US');
  return u.startsWith('ALMUERZO DEL PERSONAL') || u.startsWith('FIN DE PROCESO');
};

// =====================================================================
// Pintor (equivale a las utilidades de dibujo del renderer Java)
// =====================================================================

class Pintor {
  constructor(private readonly g: CanvasRenderingContext2D) {
    g.textRendering = 'geometricPrecision';
    g.fontKerning = 'none';
    g.lineJoin = 'miter';
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
  }

  private fuente(negrita: boolean, tam: number): string {
    return `${negrita ? 'bold ' : ''}${tam * 10}px ${FAMILIA}`;
  }

  /** Metricas de la fuente: ancho de un texto, ascenso y alto de linea (a escala 1 = unidades de plantilla). */
  ancho(s: string, negrita: boolean, tam: number): number {
    this.g.font = this.fuente(negrita, tam);
    return this.g.measureText(s).width / 10;
  }

  ascenso(negrita: boolean, tam: number): number {
    this.g.font = this.fuente(negrita, tam);
    return this.g.measureText('Hg').fontBoundingBoxAscent / 10;
  }

  altoLinea(negrita: boolean, tam: number): number {
    this.g.font = this.fuente(negrita, tam);
    const m = this.g.measureText('Hg');
    return (m.fontBoundingBoxAscent + m.fontBoundingBoxDescent) / 10;
  }

  /** Parte el texto en lineas que quepan en `ancho`; respeta los saltos de linea escritos. */
  envolver(texto: string | null, negrita: boolean, tam: number, ancho: number): string[] {
    if (!texto) return [''];
    const out: string[] = [];
    for (const parrafo of texto.split('\n')) {
      let actual = '';
      for (const palabra of parrafo.split(/\s+/)) {
        const prueba = actual === '' ? palabra : actual + ' ' + palabra;
        if (this.ancho(prueba, negrita, tam) <= ancho || actual === '') actual = prueba;
        else {
          out.push(actual);
          actual = palabra;
        }
      }
      out.push(actual);
    }
    return out;
  }

  /** align: 0 izquierda, 1 centro, 2 derecha; centrado vertical. interlineado 0 = el natural de la fuente. */
  texto(s: string | null, x: number, y: number, w: number, h: number, align: number, negrita: boolean,
        tam: number, color: string, interlineado: number): void {
    if (!s) return;
    const lineas = this.envolver(s, negrita, tam, w);
    const asc = this.ascenso(negrita, tam);
    const paso = interlineado > 0 ? interlineado : this.altoLinea(negrita, tam);
    const alto = (lineas.length - 1) * paso + asc * 0.72;
    let base = y + (h - alto) / 2 + asc * 0.72;
    for (const l of lineas) {
      const aw = this.ancho(l, negrita, tam);
      const px = align === 1 ? x + (w - aw) / 2 : align === 2 ? x + w - aw : x;
      this.dibujar(l, negrita, tam, color, px, base);
      base += paso;
    }
  }

  private dibujar(s: string, negrita: boolean, tam: number, color: string, px: number, base: number): void {
    const g = this.g;
    g.save();
    g.translate(px, base);
    g.scale(0.1, 0.1);
    g.font = this.fuente(negrita, tam);
    g.fillStyle = color;
    g.textBaseline = 'alphabetic';
    g.textAlign = 'left';
    g.fillText(s, 0, 0);
    g.restore();
  }

  caja(x: number, y: number, w: number, h: number, fondo: string | null, borde: string | null, grosor: number): void {
    const g = this.g;
    if (fondo) {
      g.fillStyle = fondo;
      g.fillRect(x, y, w, h);
    }
    if (borde) {
      g.strokeStyle = borde;
      g.lineWidth = grosor;
      g.setLineDash([]);
      g.lineCap = 'square';
      g.strokeRect(x, y, w, h);
    }
  }

  linea(x1: number, y1: number, x2: number, y2: number, color: string, grosor: number, punteada: boolean): void {
    if (grosor <= 0) return;
    const g = this.g;
    g.strokeStyle = color;
    g.lineWidth = grosor;
    if (punteada) {
      g.lineCap = 'butt';
      g.setLineDash([1, 1]);
    } else {
      g.lineCap = 'square';
      g.setLineDash([]);
    }
    g.beginPath();
    g.moveTo(x1, y1);
    g.lineTo(x2, y2);
    g.stroke();
    g.setLineDash([]);
  }

  imagen(img: Imagen | null, x: number, y: number, w: number, h: number): void {
    if (!img) return;
    const k = Math.min(w / img.ancho, h / img.alto);
    const iw = img.ancho * k;
    const ih = img.alto * k;
    this.g.drawImage(img.fuente, Math.round(x + (w - iw) / 2), Math.round(y + (h - ih) / 2), Math.round(iw), Math.round(ih));
  }
}

// =====================================================================
// Dibujo (devuelve el alto total usado)
// =====================================================================

function pintar(g: CanvasRenderingContext2D, p: Pintor, e: EntradaVid): number {
  const r = e.resultado;
  cabecera(p, e);
  g.save();
  g.translate(DESPLAZAMIENTO, 0);
  const finIndicadores = indicadores(p, r);
  const yTabla = Math.max(166, finIndicadores + 28);
  const finTabla = tabla(p, r, yTabla);
  const finPie = pie(p, r, finTabla);
  const finResumen = resumenSupervisores(p, r, finTabla + 106);
  g.restore();
  return Math.max(finResumen, finPie) + 24;
}

function cabecera(p: Pintor, e: EntradaVid): void {
  p.imagen(e.logo, 26, 8, 102, 48);
  p.imagen(e.fotoIzquierda, 140, 8, 60, 52);
  p.imagen(e.fotoDerecha, 668, 6, 62, 52);
  p.texto(e.titulo, 0, 22, 862, 30, 1, true, 15.1, NEGRO, 0);
  p.texto('FECHA PROCESO:', 32, 76, 100, 15, 0, true, 8.5, NEGRO, 0);
  p.caja(122, 77, 72, 13.5, BLANCO, NEGRO, 0.8);
  p.texto(fechaLarga(e.fechaProceso), 122, 77, 72, 13.5, 1, true, 8.3, NEGRO, 0);
}

function indicadores(p: Pintor, r: ResultadoVid): number {
  let y = 77;
  y = renglonIndicador(p, y, 'PROYECCION', plano(r.proyeccion));
  // El stock de dias previos va aparte del ingreso del dia: son fruta distinta.
  // Solo si de verdad quedo fruta: con 0 (o sin dato) la fila no aparece.
  if (r.stockAnterior > 0) {
    const etiqueta = r.stockAnteriorFecha ? `STOCK ANTERIOR ${fechaCorta(r.stockAnteriorFecha)}` : 'STOCK ANTERIOR';
    y = renglonIndicador(p, y, etiqueta, plano(r.stockAnterior));
  }
  y = renglonIndicador(p, y, 'INGRESO HASTA EL MOMENTO', plano(r.ingresoDia));
  if (conArrastre(r)) {
    const dias = [...r.porDia].sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));
    for (const d of dias) if (d.jabas !== 0) y = renglonIndicador(p, y, fechaCorta(d.fecha), plano(d.jabas));
  }
  y = renglonIndicador(p, y + 5, 'PROCESADO', num(r.procesadoDia));
  y = renglonIndicador(p, y + 5, 'STOCK TOTAL', plano(r.stock));
  return y;
}

function renglonIndicador(p: Pintor, y: number, etiqueta: string, valor: string): number {
  const h = 13.5;
  p.caja(491.5, y, 149.5, h, GUINDA, GRILLA, FINO);
  p.texto(etiqueta, 491.5, y, 149.5, h, 1, true, 7.9, BLANCO, 0);
  p.caja(641, y, 90.5, h, BLANCO, GRILLA, FINO);
  p.texto(valor, 641, y, 90.5, h, 1, true, 7.7, NEGRO, 0);
  p.caja(731.5, y, 108.5, h, BLANCO, GRILLA, FINO);
  p.texto('JABAS', 731.5, y, 108.5, h, 1, true, 7.7, NEGRO, 0);
  return y + h;
}

function tabla(p: Pintor, r: ResultadoVid, y0: number): number {
  const x0 = E[0];
  p.caja(x0, y0, ANCHO - x0, ALTO_ENCABEZADO, GUINDA, null, 0);
  const enc = ['HORA', 'MODULO', 'PERSONAS', 'JABAS / HORA', 'TOTAL JABAS\nPOR HORA', 'ACUMULADO', 'REND/\nPERSONA', 'OBSERVACIONES'];
  for (let c = 0; c < enc.length; c++) {
    p.texto(enc[c], E[c], y0, E[c + 1] - E[c], ALTO_ENCABEZADO, 1, true, 7.65, BLANCO, 11);
  }

  let y = y0 + ALTO_ENCABEZADO;
  const cortes: number[] = [];
  let yUltimo = y;
  for (const b of r.bloques) {
    yUltimo = y;
    y = bloque(p, b, y);
    cortes.push(y);
  }

  // La rejilla va DESPUES de todos los rellenos.
  for (let c = 1; c < E.length - 1; c++) p.linea(E[c], y0, E[c], y, GRILLA, FINO, false);
  p.linea(x0, y0, ANCHO, y0, GRILLA, FINO, false);
  p.linea(ANCHO, y0, ANCHO, y, GRILLA, FINO, false);
  p.linea(x0, y0 + ALTO_ENCABEZADO, ANCHO, y0 + ALTO_ENCABEZADO, GRILLA, FINO, false);
  for (let i = 0; i < cortes.length - 1; i++) p.linea(x0, cortes[i], ANCHO, cortes[i], GRILLA, FINO, false);
  p.linea(x0, y0, x0, yUltimo, GRILLA, FINO, false);
  p.linea(x0, yUltimo, x0, y, NEGRO, GRUESO, false);
  p.linea(x0, y, ANCHO, y, NEGRO, cortes.length === 0 ? FINO : 0.9, false);
  return y;
}

function lineasObs(p: Pintor, f: FilaModuloVid): number {
  return p.envolver(textoObs(f), false, FUENTE_OBS, E[C_OBS + 1] - E[C_OBS] - 8).length;
}

function observacion(p: Pintor, s: string, x: number, y: number, w: number, h: number): void {
  if (!s) return;
  const lineas = p.envolver(s, false, FUENTE_OBS, w);
  const arriba = y + (h - lineas.length * LINEA_OBS) / 2;
  lineas.forEach((l, i) => p.texto(l, x, arriba + i * LINEA_OBS, w + 8, LINEA_OBS, 1, lineaDestacada(l), FUENTE_OBS, NEGRO, 0));
}

function bloque(p: Pintor, b: BloqueHoraVid, y: number): number {
  const filas = b.filas;
  const alturas = new Array<number>(Math.max(1, filas.length)).fill(0);
  let total = 0;
  for (let i = 0; i < alturas.length; i++) {
    const lineas = i < filas.length ? lineasObs(p, filas[i]) : 1;
    alturas[i] = lineas <= 1 ? ALTO_FILA : Math.max(ALTO_FILA, lineas * LINEA_OBS + 20);
    total += alturas[i];
  }
  if (total < MIN_BLOQUE) {
    const k = MIN_BLOQUE / total;
    for (let i = 0; i < alturas.length; i++) alturas[i] *= k;
    total = MIN_BLOQUE;
  }

  p.caja(E[0], y, ANCHO - E[0], total, ROSA, null, 0);
  p.texto(String(b.numero), 0, y, 2 * 106, alturas[0], 1, true, 8.6, NEGRO, 0);
  p.texto(rangoHora(b.inicio, b.fin), E[C_HORA], y, E[C_MODULO] - E[C_HORA], total, 1, true, 7.2, NEGRO, 12);
  p.texto(num(b.totalHora), E[C_TOTAL], y, E[C_ACUM] - E[C_TOTAL], total, 1, false, FUENTE_DATO, NEGRO, 0);
  p.texto(num(b.acumulado), E[C_ACUM], y, E[C_REND] - E[C_ACUM], total, 1, false, FUENTE_DATO, NEGRO, 0);

  let yy = y;
  for (let i = 0; i < filas.length; i++) {
    const f = filas[i];
    const h = alturas[i];
    p.texto(f.modulo, E[C_MODULO], yy, E[C_PERSONAS] - E[C_MODULO], h, 1, false, FUENTE_DATO, NEGRO, 0);
    p.texto(String(f.personas), E[C_PERSONAS], yy, E[C_JABAS] - E[C_PERSONAS], h, 1, false, FUENTE_DATO, NEGRO, 0);
    p.texto(plano(f.jabas), E[C_JABAS], yy, E[C_TOTAL] - E[C_JABAS], h, 1, false, FUENTE_DATO, NEGRO, 0);
    p.texto(f.rendimiento == null ? '0' : String(f.rendimiento), E[C_REND], yy, E[C_OBS] - E[C_REND], h, 1, false, FUENTE_DATO, NEGRO, 0);
    observacion(p, textoObs(f), E[C_OBS] + 4, yy, E[C_OBS + 1] - E[C_OBS] - 8, h);
    if (i < filas.length - 1) {
      const yb = yy + h;
      p.linea(E[C_MODULO], yb, E[C_TOTAL], yb, GRILLA, FINO, true);
      p.linea(E[C_REND], yb, ANCHO, yb, GRILLA, FINO, false);
    }
    yy += h;
  }
  return y + total;
}

function pie(p: Pintor, r: ResultadoVid, yTabla: number): number {
  const bq = r.bloques;
  const ultimaHora = bq.length === 0 ? 0 : bq[bq.length - 1].totalHora;
  const acumuladoPrevio = bq.length < 2 ? 0 : bq[bq.length - 2].acumulado;
  const filas: [string, string][] = [
    ['TOTAL', num(ultimaHora)],
    ['ACUMULADO ANTERIOR', num(acumuladoPrevio)],
    ['TOTAL ACUMULADO', num(r.procesadoDia)],
    ['STOCK', num(r.stock)]
  ];
  let y = yTabla;
  for (const f of filas) {
    p.caja(E[C_MODULO], y, E[C_TOTAL] - E[C_MODULO], 13, GUINDA_OSCURO, null, 0);
    p.texto(f[0], E[C_MODULO], y, E[C_JABAS] - E[C_MODULO], 13, 1, true, 7.8, BLANCO, 0);
    p.texto(f[1], E[C_JABAS], y, E[C_TOTAL] - E[C_JABAS], 13, 1, true, 7.8, BLANCO, 0);
    p.linea(E[C_MODULO], y, E[C_TOTAL], y, GRILLA, FINO, false);
    y += 13;
  }
  p.linea(E[C_MODULO], y, E[C_TOTAL], y, GRILLA, FINO, false);
  p.linea(E[C_JABAS], yTabla, E[C_JABAS], y, GRILLA, FINO, false);
  p.caja(E[C_MODULO], yTabla, E[C_TOTAL] - E[C_MODULO], y - yTabla, null, GRILLA, FINO);

  if (!conArrastre(r)) return y;

  const x = E[C_REND];
  const yBarra = yTabla + 73.5;
  p.caja(x, yBarra, 160, 12.5, GUINDA, GRILLA, FINO);
  p.texto('PROCESADO', x + 8, yBarra, 150, 12.5, 0, true, 7.9, BLANCO, 0);

  let yy = yTabla + 106;
  for (const d of r.porDia as ProcesadoDiaVid[]) {
    p.caja(x, yy, 69.5, 24.5, GUINDA, GRILLA, FINO);
    p.texto('PROCESADO\n' + fechaPunto(d.fecha), x, yy, 69.5, 24.5, 1, true, 6.2, BLANCO, 11.5);
    p.caja(E[C_OBS], yy, 90.5, 24.5, BLANCO, GRILLA, FINO);
    p.texto(num(d.jabas), E[C_OBS] + 2, yy + 5, 54, 18, 0, false, 7.7, NEGRO, 0);
    p.texto('JABAS', E[C_OBS] + 36, yy + 5, 52, 18, 2, false, 7.7, NEGRO, 0);
    yy += 24.5;
  }
  p.caja(E[C_OBS], yy, 90.5, 21, GUINDA, GRILLA, FINO);
  p.texto(num(r.procesadoDia), E[C_OBS] + 2, yy, 54, 21, 0, true, 7.9, BLANCO, 0);
  p.texto('JABAS', E[C_OBS] + 36, yy, 52, 21, 2, false, 7.9, BLANCO, 0);
  return Math.max(y, yy + 21);
}

function resumenSupervisores(p: Pintor, r: ResultadoVid, y0: number): number {
  const h = 22;
  let y = y0;
  for (const s of r.supervisores) {
    p.caja(80, y, 99.5, h, ROSA, null, 0);
    p.texto(s.supervisor, 80, y, 99.5, h, 1, true, 6.6, NEGRO, 0);
    p.caja(E[C_MODULO], y, 70, h, ROSA, null, 0);
    p.texto(s.modulo, E[C_MODULO], y, 70, h, 1, false, FUENTE_DATO, NEGRO, 0);
    p.caja(E[C_PERSONAS], y, 89.5, h, ROSA_FUERTE, GRILLA, FINO);
    p.texto(mayus(s.variedades), E[C_PERSONAS], y, 89.5, h, 1, true, 6.6, NEGRO, 0);
    p.caja(E[C_JABAS], y, 73.5, h, ROSA, GRILLA, FINO);
    p.texto(plano(s.jabas), E[C_JABAS], y, 73.5, h, 1, false, FUENTE_DATO, NEGRO, 0);
    p.caja(E[C_TOTAL], y, 79, h, ROSA, GRILLA, FINO);
    p.texto('JABAS', E[C_TOTAL], y, 79, h, 1, true, 6.6, NEGRO, 0);
    p.caja(E[C_MODULO], y, 70, h, null, NEGRO, 1.0);
    y += h;
  }
  const yt = y + 24;
  p.caja(E[C_PERSONAS], yt, 89.5, 12, ROSA, GRILLA, FINO);
  p.caja(E[C_JABAS], yt, 73.5, 12, ROSA, GRILLA, FINO);
  p.caja(E[C_TOTAL], yt, 79, 12, ROSA, GRILLA, FINO);
  p.texto('TOTAL', E[C_PERSONAS], yt, 89.5, 12, 1, true, 6.6, NEGRO, 0);
  p.texto(plano(r.totalSupervisores), E[C_JABAS], yt, 73.5, 12, 1, false, 6.8, NEGRO, 0);
  p.texto('JABAS', E[C_TOTAL], yt, 79, 12, 1, true, 6.6, NEGRO, 0);
  return yt + 12;
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

/** Dibuja el reporte Vid y devuelve el PNG. `escala` = pixeles por unidad (3 = igual que el servidor). */
export async function renderizarReporteVidPng(e: EntradaVid, escala = 3): Promise<Blob> {
  await cargarFuentesVid();
  const gm = crearLienzo(1, 1).getContext('2d')!;
  const alto = pintar(gm, new Pintor(gm), e);

  escala = escalaSegura(LIENZO, alto, escala);
  const pw = Math.round(LIENZO * escala);
  const ph = Math.ceil(alto * escala);
  const lienzo = crearLienzo(pw, ph);
  const g = lienzo.getContext('2d')!;
  g.fillStyle = BLANCO;
  g.fillRect(0, 0, pw, ph);
  g.scale(escala, escala);
  pintar(g, new Pintor(g), e);

  return new Promise<Blob>((ok, error) =>
    lienzo.toBlob((b) => (b ? ok(b) : error(new Error('No se pudo generar la imagen del reporte'))), 'image/png'));
}
