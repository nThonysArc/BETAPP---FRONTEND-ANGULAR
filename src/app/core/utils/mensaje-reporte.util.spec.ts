import { construirMensajeReporte } from './mensaje-reporte.util';

describe('mensaje del reporte', () => {
  const tarde = new Date(2026, 0, 1, 15, 0);

  it('arandano conserva su texto con saludo y dos puntos', () => {
    expect(construirMensajeReporte(tarde, 3, 'ARANDANO'))
      .toBe('Buenas tardes, se adjunta avance por hora del proceso de arándano fresco:\n3ra hora');
  });

  it('vid usa su texto propio, sin saludo', () => {
    expect(construirMensajeReporte(tarde, 1, 'VID'))
      .toBe('Se envía avance por hora del proceso de selección Vid\n1ra hora');
  });

  it('sin plantilla conocida usa arandano', () => {
    expect(construirMensajeReporte(tarde, null, undefined)).toContain('arándano fresco');
  });
});
