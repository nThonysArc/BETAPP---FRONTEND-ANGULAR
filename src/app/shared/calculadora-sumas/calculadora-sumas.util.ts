/**
 * Logica pura de la calculadora (suma, resta y multiplicacion, como en una celda de Excel:
 * "+200+200+200", "1000-150", "12*50+30"). Separada de la pantalla para probarla sin navegador.
 * Respeta la prioridad normal: la multiplicacion se resuelve antes que la suma y la resta.
 * No usa eval: el texto se valida y se calcula con un analizador propio.
 */

/** Teclas que acepta la calculadora. */
export type Tecla = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '.' | '+' | '-' | '*' | 'borrar';

const OPERADORES = ['+', '-', '*'];

function esOperador(c: string): boolean {
  return OPERADORES.includes(c);
}

/** Termino que se esta escribiendo (lo que va despues del ultimo operador). */
function terminoActual(expr: string): string {
  let i = expr.length;
  while (i > 0 && !esOperador(expr[i - 1])) i--;
  return expr.slice(i);
}

/** Aplica una tecla a la expresion y devuelve la nueva expresion. */
export function aplicarTecla(expr: string, tecla: Tecla): string {
  if (tecla === 'borrar') return expr.slice(0, -1);

  if (esOperador(tecla)) {
    // No se empieza con operador (el "+" inicial es implicito) y dos operadores seguidos se reemplazan.
    if (expr === '') return expr;
    if (esOperador(expr[expr.length - 1])) return `${expr.slice(0, -1)}${tecla}`;
    return `${expr}${tecla}`;
  }

  const termino = terminoActual(expr);
  if (tecla === '.') {
    if (termino.includes('.')) return expr;
    return termino === '' ? `${expr}0.` : `${expr}.`;
  }

  // Digito: "0" seguido de otro digito reemplaza al cero ("05" -> "5").
  if (termino === '0') return `${expr.slice(0, -1)}${tecla}`;
  return `${expr}${tecla}`;
}

/**
 * Calcula una expresion escrita por la persona (teclado de PC o calculadora). Acepta + - * y tambien
 * x, X y × para multiplicar, y coma como decimal. Devuelve null si el texto no es una operacion valida.
 * Texto vacio = 0. Un operador al final se ignora ("150+" = 150). Resultado redondeado a 2 decimales.
 */
export function evaluarExpresion(texto: string): number | null {
  let e = texto.replace(/\s+/g, '').replace(/,/g, '.').replace(/[xX×]/g, '*').replace(/[−–]/g, '-');
  e = e.replace(/[+\-*]+$/, '');
  if (e === '') return 0;
  if (!/^[0-9.+\-*]+$/.test(e)) return null;

  // Cada termino lleva su signo: "200+200-50*2" -> ["200", "+200", "-50*2"]
  let total = 0;
  for (const termino of e.split(/(?=[+-])/)) {
    const signo = termino.startsWith('-') ? -1 : 1;
    const cuerpo = termino.replace(/^[+-]/, '');
    const factores = cuerpo.split('*');
    let producto = 1;
    for (const f of factores) {
      if (f === '' || !/^(\d+\.?\d*|\.\d+)$/.test(f)) return null;
      producto *= Number(f);
    }
    total += signo * producto;
  }
  return Number.isFinite(total) ? Math.round(total * 100) / 100 : null;
}

/** Expresion con la que arranca la calculadora: el valor que ya tenia el campo (si es mayor a 0). */
export function expresionInicial(valor: unknown): string {
  const n = Number(valor);
  return Number.isFinite(n) && n > 0 ? String(n) : '';
}

/** Para mostrar: "200+200*2-5" -> "200 + 200 × 2 − 5". */
export function expresionLegible(expr: string): string {
  return expr.replace(/\*/g, ' × ').replace(/-/g, ' − ').replace(/\+/g, ' + ');
}
