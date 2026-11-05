import { normalizarTexto, parsearNumero, parsearPegado, pareceTabla, VariedadRef } from './pegado-excel.util';

const VARS: VariedadRef[] = [
  { id: 1, nombre: 'Ventura' },
  { id: 2, nombre: 'Sekoya Pop' },
  { id: 3, nombre: 'Biloxi' }
];

describe('pegado-excel.util', () => {
  it('normaliza tildes, mayusculas y espacios', () => {
    expect(normalizarTexto('  ÁRANDANO   Fresco ')).toBe('arandano fresco');
  });

  it('parsea numeros en formato ingles, espanol y con espacios', () => {
    expect(parsearNumero('1,234.5')).toBe(1234.5);
    expect(parsearNumero('1.234,5')).toBe(1234.5);
    expect(parsearNumero('12,5')).toBe(12.5);
    expect(parsearNumero('1,234')).toBe(1234);
    expect(parsearNumero('1.234')).toBe(1234);
    expect(parsearNumero('0.125')).toBe(0.125);
    expect(parsearNumero('1 234')).toBe(1234);
    expect(parsearNumero('850')).toBe(850);
    expect(parsearNumero('abc')).toBeNull();
    expect(parsearNumero('05/11/2026')).toBeNull();
    expect(parsearNumero('')).toBeNull();
  });

  it('detecta si el texto viene de una tabla', () => {
    expect(pareceTabla('500')).toBe(false);
    expect(pareceTabla('500\n')).toBe(false);
    expect(pareceTabla('500\t4000')).toBe(true);
    expect(pareceTabla('500\n600')).toBe(true);
  });

  it('soloJabas (Vid): acepta filas con un solo numero y deja los kilos en 0', () => {
    const vars = [{ id: 1, nombre: 'Sweet Globe' }];
    expect(parsearPegado('Sweet Globe\t1200', vars)).toEqual([]);
    expect(parsearPegado('Sweet Globe\t1200', vars, true)).toEqual([
      { variedadTexto: 'Sweet Globe', variedadId: 1, jabas: 1200, kilos: 0 }
    ]);
  });

  it('lee una fila Variedad / Jabas / Kilos', () => {
    const r = parsearPegado('VENTURA\t1,200\t9,840.5', VARS);
    expect(r).toEqual([{ variedadTexto: 'VENTURA', variedadId: 1, jabas: 1200, kilos: 9840.5 }]);
  });

  it('lee solo numeros (jabas y kilos) sin variedad', () => {
    const r = parsearPegado('1200\t9840', VARS);
    expect(r).toEqual([{ variedadTexto: null, variedadId: null, jabas: 1200, kilos: 9840 }]);
  });

  it('descarta encabezados, ignora fecha y tercer numero, y reconoce variedades con tildes/mayusculas', () => {
    const txt = 'FECHA\tVARIEDAD\tJABAS\tKILOS\tPROM\r\n05/11/2026\tsekoya pop\t300\t2400\t8\r\n05/11/2026\tBILOXI\t100\t800\t8\r\n';
    const r = parsearPegado(txt, VARS);
    expect(r.length).toBe(2);
    expect(r[0]).toEqual({ variedadTexto: 'sekoya pop', variedadId: 2, jabas: 300, kilos: 2400 });
    expect(r[1].variedadId).toBe(3);
  });

  it('suma la misma variedad repetida', () => {
    const r = parsearPegado('Ventura\t100\t800\nVentura\t50\t400', VARS);
    expect(r).toEqual([{ variedadTexto: 'Ventura', variedadId: 1, jabas: 150, kilos: 1200 }]);
  });

  it('deja variedadId en null si no la reconoce', () => {
    const r = parsearPegado('Desconocida\t10\t80', VARS);
    expect(r[0].variedadId).toBeNull();
    expect(r[0].variedadTexto).toBe('Desconocida');
  });
});
