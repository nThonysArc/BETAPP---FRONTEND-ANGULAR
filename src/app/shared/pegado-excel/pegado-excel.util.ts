/**
 * Lectura de datos copiados desde Excel / Google Sheets.
 *
 * Al copiar celdas, el portapapeles trae texto con TAB entre columnas y salto de linea entre filas.
 * Aqui se convierte ese texto en filas {variedad, jabas, kilos} sin depender de Angular (se prueba aislado).
 */

export interface VariedadRef {
  id: number;
  nombre: string;
}

export interface FilaPegada {
  /** Texto de variedad tal como vino (null si la fila solo traia numeros). */
  variedadTexto: string | null;
  /** Variedad reconocida del catalogo (null si no se reconocio o no vino). */
  variedadId: number | null;
  jabas: number;
  kilos: number;
}

/** Minusculas, sin tildes ni espacios sobrantes: "  Sekoya   Pop " -> "sekoya pop". */
export function normalizarTexto(t: string): string {
  return t
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Convierte una celda a numero aceptando los formatos de Excel en espanol e ingles:
 * "1,234.5", "1.234,5", "1 234", "1'234", "850", "12,5". Devuelve null si no es un numero.
 */
export function parsearNumero(celda: string): number | null {
  let t = celda.replace(/[\s ']/g, '');
  if (!t || !/^-?[\d.,]+$/.test(t) || !/\d/.test(t)) return null;

  const tienePunto = t.includes('.');
  const tieneComa = t.includes(',');
  if (tienePunto && tieneComa) {
    // El ultimo separador es el decimal; el otro es de miles.
    const decimal = t.lastIndexOf('.') > t.lastIndexOf(',') ? '.' : ',';
    const miles = decimal === '.' ? ',' : '.';
    t = t.split(miles).join('').replace(decimal, '.');
  } else if (tieneComa || tienePunto) {
    const sep = tieneComa ? ',' : '.';
    const partes = t.split(sep);
    const esMiles = partes.length > 2 || (partes.length === 2 && partes[1].length === 3 && partes[0].length >= 1 && partes[0] !== '0');
    t = esMiles ? partes.join('') : partes.join('.');
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function separarCeldas(linea: string): string[] {
  if (linea.includes('\t')) return linea.split('\t');
  if (linea.includes(';')) return linea.split(';');
  return linea.split(/\s{2,}/);
}

function buscarVariedad(texto: string, variedades: VariedadRef[]): number | null {
  const buscado = normalizarTexto(texto);
  if (!buscado) return null;
  const exacta = variedades.find((v) => normalizarTexto(v.nombre) === buscado);
  if (exacta) return exacta.id;
  // Tolerante: "VENTURA " / "Ventura (Gold)" -> solo si es un unico candidato.
  const parecidas = variedades.filter((v) => {
    const n = normalizarTexto(v.nombre);
    return n.length >= 3 && (buscado.includes(n) || n.includes(buscado));
  });
  return parecidas.length === 1 ? parecidas[0].id : null;
}

/** True si el texto parece venir de una tabla (varias celdas o varias filas) y no de un solo valor. */
export function pareceTabla(texto: string): boolean {
  const t = texto.replace(/\r/g, '').replace(/\n+$/, '');
  return t.includes('\t') || t.includes('\n');
}

/**
 * Cada linea con al menos un numero genera una fila: el texto es la variedad; el primer numero son las
 * jabas y el segundo los kilos (con soloJabas, Vid, solo las jabas y kilos = 0) (un tercero, p. ej. el promedio, se ignora). Encabezados y lineas vacias
 * se descartan. Si una variedad aparece varias veces se SUMA (el sistema guarda el acumulado por variedad).
 */
export function parsearPegado(texto: string, variedades: VariedadRef[], soloJabas = false): FilaPegada[] {
  const filas: FilaPegada[] = [];
  for (const linea of texto.replace(/\r/g, '').split('\n')) {
    if (!linea.trim()) continue;
    const celdas = separarCeldas(linea).map((c) => c.trim()).filter((c) => c !== '');
    const numeros: number[] = [];
    let variedadTexto: string | null = null;
    for (const c of celdas) {
      const n = parsearNumero(c);
      if (n !== null) numeros.push(n);
      else if (variedadTexto === null && /[\p{L}]/u.test(c) && !/\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/.test(c)) variedadTexto = c;
    }
    // Encabezado, titulo o fila incompleta. En Vid solo se digitan jabas (los kilos no se manejan).
    if (numeros.length < (soloJabas ? 1 : 2)) continue;
    filas.push({
      variedadTexto,
      variedadId: variedadTexto ? buscarVariedad(variedadTexto, variedades) : null,
      jabas: numeros[0],
      kilos: soloJabas ? 0 : numeros[1]
    });
  }

  // Misma variedad repetida -> se suman.
  const unicas: FilaPegada[] = [];
  for (const f of filas) {
    const previa = f.variedadId !== null ? unicas.find((u) => u.variedadId === f.variedadId) : undefined;
    if (previa) {
      previa.jabas += f.jabas;
      previa.kilos += f.kilos;
    } else {
      unicas.push({ ...f });
    }
  }
  return unicas;
}
