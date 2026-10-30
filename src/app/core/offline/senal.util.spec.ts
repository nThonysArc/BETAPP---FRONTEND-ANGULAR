import { calidadSenal } from './senal.util';

describe('calidadSenal', () => {
  it('rojo sin red', () => expect(calidadSenal(false, { effectiveType: '4g' })).toBe('sin-red'));
  it('verde con red y sin datos de calidad (iPhone)', () => expect(calidadSenal(true)).toBe('buena'));
  it('verde con 4g', () => expect(calidadSenal(true, { effectiveType: '4g', rtt: 80, downlink: 10 })).toBe('buena'));
  it('amarillo con 3g', () => expect(calidadSenal(true, { effectiveType: '3g' })).toBe('debil'));
  it('amarillo con latencia alta', () => expect(calidadSenal(true, { effectiveType: '4g', rtt: 1500 })).toBe('debil'));
  it('amarillo con ancho de banda bajo', () => expect(calidadSenal(true, { downlink: 0.2 })).toBe('debil'));
  it('amarillo con ahorro de datos', () => expect(calidadSenal(true, { saveData: true })).toBe('debil'));
});
