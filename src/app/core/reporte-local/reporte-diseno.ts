/**
 * Calculo del layout del reporte de Arandano (espejo de ReporteExcelRenderer.Diseno): alturas, bloques
 * por hora, grupos por maquina, totales y resumen. Todas las medidas estan en "pixeles del Excel
 * original" (886 de ancho). No dibuja: solo mide (usa un `Medidor` para ajustar el texto a su celda).
 */

import { CorteReporte, FilaReporte, MaquinaCorteReporte, ReporteDatos, todoAlmuerzo } from './reporte-datos';

// ---------- Geometria ----------
export const ANCHO = 886;
/** Bordes verticales de las 13 columnas de la tabla principal. */
export const C = [41, 92, 144, 218, 258, 318, 366, 417, 479, 541, 593, 655, 692, 885];
export const HORA = 0, FECHA = 1, VARIEDAD = 2, JABAS = 3, PESO_VIAJE = 4, PESO_MAQ = 5,
  TOTAL_HORA = 6, ACUM = 7, MAQUINA = 8, KATO = 9, EMPAC = 10, KG_EMP = 11, OBS = 12;
export const ALTO_ENCABEZADO = 21;
export const ALTO_FILA = 20;
export const ALTO_MIN_BLOQUE = 34;
export const ALTO_PAUSA = 38;
export const INTERLINEADO_OBS = 9.6;
export const ALTO_FILA_PIE = 14.2;
export const MIN_Y_TABLA = 146;

// ---------- Tipografia ----------
export const T_TITULO = 21.3, T_ETIQUETA = 12.2, T_FECHA = 11.2, T_ENCABEZADO = 10.7,
  T_CUERPO = 9.6, T_OBS = 8.0, T_PIE = 10.6, T_MINI = 9.2, T_HORA = 11.0, T_MP = 9.4;

export const ENCABEZADOS = [
  'HORA', 'FECHA DE\nCOSECHA', 'VARIEDAD', 'JABAS', 'PESO POR VIAJE', 'PESO POR\nMAQUINA',
  'TOTAL PESO\nPOR HORA', 'ACUM. X HORA', 'MAQUINA', 'KATO´S', 'EMPACADORES', 'KG/EMP', 'OBSERVACION'
];

/** Lo unico que el diseno necesita del lienzo: partir un texto en lineas que quepan en un ancho. */
export interface Medidor {
  ajustar(texto: string, negrita: boolean, tamano: number, anchoMax: number): string[];
}

export interface Grupo {
  maquinaId: number;
  filas: FilaReporte[];
  observacion: string | null;
  lineasObs: string[];
  alto: number;
  pesoMaquina: number;
  almuerzo: boolean;
}

export interface Bloque {
  corte: CorteReporte;
  numero: number;
  pausa: boolean;
  grupos: Grupo[];
  lineasObsGeneral: string[] | null;
  y: number;
  alto: number;
  acumulado: number;
}

export interface Tramo {
  supervisor: string;
  inicio: string;
  fin: string;
}

export interface ResumenMaquina {
  nombre: string;
  jabas: number;
  kilos: number;
  tramos: Tramo[];
  lineas: string[];
  alto: number;
}

// ---------- Utilidades de texto/numero (mismas reglas que el servidor) ----------
export const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export const nz = (v: number | null | undefined): number => v ?? 0;
export const vacio = (s: string | null | undefined): boolean => s == null || s.trim() === '';
export const mayus = (s: string | null | undefined): string => (s == null ? '' : s.toLocaleUpperCase('es-PE'));

/** Redondeo "mitad hacia arriba" (como BigDecimal.HALF_UP), sin los errores de coma flotante. */
export function redondearMitadArriba(n: number, decimales: number): number {
  // Se normaliza el ruido de coma flotante (74322.34999999999 -> 74322.35) para igualar a BigDecimal.
  const limpio = Number(n.toFixed(6));
  const signo = limpio < 0 ? -1 : 1;
  const r = Math.round(Number(Math.abs(limpio) + 'e' + decimales));
  return signo * Number(r + 'e-' + decimales);
}

/** Equivalente a DecimalFormat("#,##0.0") en Locale.US. */
export function fmt(valor: number | null | undefined, decimales: number, miles = true): string {
  const v = redondearMitadArriba(nz(valor), decimales);
  return v.toLocaleString('en-US', {
    minimumFractionDigits: decimales, maximumFractionDigits: decimales, useGrouping: miles
  });
}

/** "9:40" (sin cero a la izquierda en la hora). Acepta 'HH:mm' y 'HH:mm:ss'. */
export function hora(t: string | null | undefined): string {
  if (!t) return '';
  const [h, m] = t.split(':');
  return `${Number(h)}:${(m ?? '00').padStart(2, '0')}`;
}

/** "7/10/2026". */
export function fechaLarga(f: string | null | undefined): string {
  if (!f) return '';
  const [a, m, d] = f.split('-').map(Number);
  return `${d}/${m}/${a}`;
}

/** "7-Oct". */
export function fechaCorta(f: string | null | undefined): string {
  if (!f) return '';
  const [, m, d] = f.split('-').map(Number);
  return `${d}-${MESES[m - 1]}`;
}

// ---------- Diseno ----------
export class Diseno {
  readonly bloques: Bloque[] = [];
  readonly resumen: ResumenMaquina[] = [];
  mpJabas = 0; mpKilos = 0;
  totJabas = 0; totKilos = 0;
  ultJabas = 0; ultKilos = 0;
  yMiniFilas = 0; ySubtotal = 0; yMp = 0; yTabla = 0; yPie = 0; yResumen = 0;
  yTotalResumen = 0; yFinTabla = 0; altoTotal = 0;

  constructor(readonly d: ReporteDatos, medidor: Medidor) {
    this.calcularTotales();
    this.calcularPosicionesSuperiores();
    this.calcularBloques(medidor);
    this.calcularResumen(medidor);
  }

  private calcularTotales(): void {
    for (const l of this.d.ingresos) {
      this.mpJabas += nz(l.jabas);
      this.mpKilos += nz(l.kilos);
    }
    let ultimo: CorteReporte | null = null;
    for (const c of this.d.cortes) {
      this.totJabas += nz(c.jabasTotal);
      this.totKilos += nz(c.pesoTotal);
      if (!todoAlmuerzo(c)) ultimo = c;
    }
    // "TOTAL" del pie = ultima hora de produccion (la barra de almuerzo no cuenta)
    if (ultimo) {
      this.ultJabas = nz(ultimo.jabasTotal);
      this.ultKilos = nz(ultimo.pesoTotal);
    }
  }

  private calcularPosicionesSuperiores(): void {
    const n = this.d.ingresos.length;
    this.yMiniFilas = 43 + 11 + 0.5;
    this.ySubtotal = this.yMiniFilas + 10.1 * n;
    this.yMp = this.ySubtotal + 10.5 + 7;
    const finStock = this.yMp + 26 + 10.5;
    this.yTabla = Math.max(MIN_Y_TABLA, finStock + 7.2);
  }

  private calcularBloques(m: Medidor): void {
    const anchoObs = C[13] - C[OBS] - 10;
    let y = this.yTabla + ALTO_ENCABEZADO;
    let acumulado = 0;
    let numero = 0;

    for (const corte of this.d.cortes) {
      const b: Bloque = {
        corte, numero: 0, pausa: false, grupos: [], lineasObsGeneral: null, y, alto: 0, acumulado: 0
      };

      if (todoAlmuerzo(corte)) {
        b.pausa = true;
        b.alto = ALTO_PAUSA;
        b.acumulado = acumulado;
        this.bloques.push(b);
        y += b.alto;
        continue;
      }
      b.numero = ++numero;

      const info = new Map<number, MaquinaCorteReporte>();
      for (const mq of corte.maquinas) info.set(mq.maquinaId, mq);

      const porMaquina = new Map<number, Grupo>();
      for (const f of corte.filas) {
        let g = porMaquina.get(f.maquinaId);
        if (!g) {
          g = { maquinaId: f.maquinaId, filas: [], observacion: null, lineasObs: [], alto: 0, pesoMaquina: 0, almuerzo: false };
          porMaquina.set(f.maquinaId, g);
        }
        g.filas.push(f);
        g.pesoMaquina += nz(f.peso);
      }

      let hayObsMaquina = false;
      for (const g of porMaquina.values()) {
        const mq = info.get(g.maquinaId);
        g.observacion = mq ? mq.observacion : null;
        g.almuerzo = !!mq && mq.almuerzo;
        if (!vacio(g.observacion)) hayObsMaquina = true;
      }

      for (const g of porMaquina.values()) {
        g.lineasObs = vacio(g.observacion) ? [] : m.ajustar(mayus(g.observacion), false, T_OBS, anchoObs);
        g.alto = Math.max(g.filas.length * ALTO_FILA, g.lineasObs.length === 0 ? 0 : g.lineasObs.length * INTERLINEADO_OBS + 8);
        if (g.almuerzo) g.alto = Math.max(g.alto, 28); // cabe "ALMUERZO DE PERSONAL / MAQUINA N"
        b.grupos.push(g);
      }

      let alto = 0;
      for (const g of b.grupos) alto += g.alto;

      // Sin observaciones por maquina: la observacion general ocupa toda la hora
      let minimo = ALTO_MIN_BLOQUE;
      if (!hayObsMaquina && !vacio(corte.observacionGeneral)) {
        b.lineasObsGeneral = m.ajustar(mayus(corte.observacionGeneral), false, T_OBS, anchoObs);
        minimo = Math.max(minimo, b.lineasObsGeneral.length * INTERLINEADO_OBS + 8);
      }
      if (alto < minimo) {
        if (b.grupos.length === 0) {
          alto = minimo;
        } else {
          b.grupos[b.grupos.length - 1].alto += minimo - alto;
          alto = minimo;
        }
      }

      b.alto = alto;
      acumulado += nz(corte.pesoTotal);
      b.acumulado = acumulado;
      this.bloques.push(b);
      y += alto;
    }

    if (this.bloques.length === 0) y += ALTO_MIN_BLOQUE;
    this.yFinTabla = y;
    this.yPie = y;
  }

  private calcularResumen(m: Medidor): void {
    const porMaquina = new Map<number, ResumenMaquina>();

    for (const b of this.bloques) {
      const info = new Map<number, MaquinaCorteReporte>();
      for (const mq of b.corte.maquinas) info.set(mq.maquinaId, mq);

      for (const g of b.grupos) {
        let r = porMaquina.get(g.maquinaId);
        if (!r) {
          r = { nombre: '', jabas: 0, kilos: 0, tramos: [], lineas: [], alto: 0 };
          porMaquina.set(g.maquinaId, r);
        }
        r.nombre = mayus(g.filas[0].maquina);
        for (const f of g.filas) {
          r.jabas += nz(f.jabas);
          r.kilos += nz(f.peso);
        }
        const mq = info.get(g.maquinaId);
        const sup = mq && !vacio(mq.supervisor) ? mayus(mq.supervisor) : '-';
        const ultimo = r.tramos.length ? r.tramos[r.tramos.length - 1] : null;
        if (ultimo && ultimo.supervisor === sup) {
          ultimo.fin = b.corte.fin;
        } else {
          r.tramos.push({ supervisor: sup, inicio: b.corte.inicio, fin: b.corte.fin });
        }
      }
    }

    const anchoSup = C[PESO_VIAJE + 1] - C[JABAS] - 6;
    for (const r of porMaquina.values()) {
      if (r.tramos.length === 1) {
        const sup = r.tramos[0].supervisor;
        r.lineas = sup === '-' ? [] : m.ajustar(sup, true, T_PIE, anchoSup);
      } else {
        const lineas: string[] = [];
        for (const t of r.tramos) {
          lineas.push(...m.ajustar(`${t.supervisor} (${hora(t.inicio)}-${hora(t.fin)})`, true, T_PIE, anchoSup));
        }
        r.lineas = lineas;
      }
      r.alto = Math.max(20, r.lineas.length * 10.6 + 8);
      this.resumen.push(r);
    }

    this.yResumen = this.yPie + 4 * ALTO_FILA_PIE + 21;
    let fin = this.yResumen + 20;
    for (const r of this.resumen) fin += r.alto;
    this.yTotalResumen = fin;
    this.altoTotal = Math.ceil(fin + 19.7 + 7);
  }
}
