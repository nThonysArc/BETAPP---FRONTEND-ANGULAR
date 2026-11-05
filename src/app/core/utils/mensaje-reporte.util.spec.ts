import { construirMensajeReporte, esProcesoVid, nombreProcesoParaMensaje, procesoPorDefecto } from './mensaje-reporte.util';

describe('mensaje del reporte', () => {
  const tarde = new Date(2026, 0, 1, 15, 0);
  const manana = new Date(2026, 0, 1, 9, 0);
  const noche = new Date(2026, 0, 1, 21, 0);

  it('mismo formato para cualquier cultivo', () => {
    expect(construirMensajeReporte(tarde, 1, 'arándano fresco'))
      .toBe('Buenas tardes, se envía avance por hora de proceso de arándano fresco:\n1ra hora');
    expect(construirMensajeReporte(manana, 2, 'arándano congelado'))
      .toBe('Buenos días, se envía avance por hora de proceso de arándano congelado:\n2da hora');
    expect(construirMensajeReporte(tarde, 1, 'selección de EVF'))
      .toBe('Buenas tardes, se envía avance por hora de proceso de selección de EVF:\n1ra hora');
  });

  it('Vid siempre dice "Selección Vid", sin importar como se llame el producto', () => {
    expect(construirMensajeReporte(manana, 1, 'uva', true))
      .toBe('Buenos días, se envía avance por hora de Selección Vid:\n1ra hora');
    expect(construirMensajeReporte(noche, 3, 'uva', true))
      .toBe('Buenas noches, se envía avance por hora de Selección Vid:\n3ra hora');
    expect(construirMensajeReporte(tarde, null, 'uva', true))
      .toBe('Buenas tardes, se envía avance por hora de Selección Vid.');
  });

  it('reconoce Vid por la plantilla o, si no se sabe, por el nombre del producto', () => {
    expect(esProcesoVid('VID', 'Uva')).toBeTrue();
    expect(esProcesoVid('ARANDANO', 'Uva')).toBeFalse();
    expect(esProcesoVid(undefined, 'Uva')).toBeTrue();
    expect(esProcesoVid(undefined, 'Arándano fresco')).toBeFalse();
    expect(esProcesoVid(undefined, null)).toBeFalse();
  });

  it('sin hora registrada cierra con punto', () => {
    expect(construirMensajeReporte(tarde, null, 'arándano fresco'))
      .toBe('Buenas tardes, se envía avance por hora de proceso de arándano fresco.');
  });

  it('nombre del producto: baja la primera letra salvo siglas', () => {
    expect(nombreProcesoParaMensaje('Arándano fresco')).toBe('arándano fresco');
    expect(nombreProcesoParaMensaje('Selección Vid')).toBe('selección Vid');
    expect(nombreProcesoParaMensaje('EVF')).toBe('EVF');
    expect(nombreProcesoParaMensaje('selección de EVF')).toBe('selección de EVF');
  });

  it('respaldo por plantilla', () => {
    expect(procesoPorDefecto('VID')).toBe('selección Vid');
    expect(procesoPorDefecto('ARANDANO')).toBe('arándano fresco');
    expect(procesoPorDefecto(undefined)).toBe('arándano fresco');
  });
});
