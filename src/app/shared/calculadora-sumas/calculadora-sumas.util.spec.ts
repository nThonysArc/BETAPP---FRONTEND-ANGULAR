import { Tecla, aplicarTecla, evaluarExpresion, expresionInicial, expresionLegible } from './calculadora-sumas.util';

function teclear(...teclas: string[]): string {
  return teclas.reduce((expr, t) => aplicarTecla(expr, t as Tecla), '');
}

describe('calculadora', () => {
  it('suma como en una celda de Excel: +200+200+200', () => {
    const expr = teclear('2', '0', '0', '+', '2', '0', '0', '+', '2', '0', '0');
    expect(expr).toBe('200+200+200');
    expect(evaluarExpresion(expr)).toBe(600);
  });

  it('resta y multiplicacion con prioridad normal', () => {
    expect(evaluarExpresion('1000-150')).toBe(850);
    expect(evaluarExpresion('12*50')).toBe(600);
    expect(evaluarExpresion('100+12*50-30')).toBe(670);
    expect(evaluarExpresion('2*3*4')).toBe(24);
  });

  it('acepta x, X, × y coma decimal (teclado de PC)', () => {
    expect(evaluarExpresion('12x50')).toBe(600);
    expect(evaluarExpresion('12 × 50')).toBe(600);
    expect(evaluarExpresion('1,5+1,5')).toBe(3);
  });

  it('un "+" inicial se acepta y un operador al final se ignora', () => {
    expect(evaluarExpresion('+200+200+200')).toBe(600);
    expect(evaluarExpresion('150+')).toBe(150);
    expect(evaluarExpresion('')).toBe(0);
  });

  it('texto invalido devuelve null', () => {
    expect(evaluarExpresion('12a')).toBeNull();
    expect(evaluarExpresion('5**2')).toBeNull();
    expect(evaluarExpresion('5+*2')).toBeNull();
    expect(evaluarExpresion('1.2.3')).toBeNull();
    expect(evaluarExpresion('alert(1)')).toBeNull();
  });

  it('un resultado negativo se devuelve tal cual (el formulario lo marca como error)', () => {
    expect(evaluarExpresion('5-10')).toBe(-5);
  });

  it('en el teclado, dos operadores seguidos se reemplazan y no se empieza con operador', () => {
    expect(teclear('+', '5')).toBe('5');
    expect(teclear('-', '5')).toBe('5');
    expect(teclear('5', '+', '-', '3')).toBe('5-3');
    expect(teclear('5', '*', '+', '3')).toBe('5+3');
  });

  it('decimales: un solo punto por numero y "0." si empieza con punto', () => {
    expect(teclear('1', '.', '5', '.', '2')).toBe('1.52');
    expect(teclear('.', '5')).toBe('0.5');
    expect(teclear('2', '*', '.', '5')).toBe('2*0.5');
    expect(evaluarExpresion('0.1+0.2')).toBe(0.3);
  });

  it('el cero inicial no se acumula', () => {
    expect(teclear('0', '5')).toBe('5');
    expect(teclear('1', '0', '+', '0', '7')).toBe('10+7');
  });

  it('borrar quita el ultimo caracter', () => {
    expect(teclear('2', '0', '+', 'borrar')).toBe('20');
    expect(teclear('borrar')).toBe('');
  });

  it('arranca con el valor que ya tenia el campo', () => {
    expect(expresionInicial(600)).toBe('600');
    expect(expresionInicial(0)).toBe('');
    expect(expresionInicial(null)).toBe('');
    expect(aplicarTecla(expresionInicial(600), '+')).toBe('600+');
  });

  it('formato legible', () => {
    expect(expresionLegible('200+200*2-5')).toBe('200 + 200 × 2 − 5');
  });
});
