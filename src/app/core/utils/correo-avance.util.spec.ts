import {
  asuntoBase, cabeceraCodificada, construirEml, dimensionesPng, fechaConPuntos,
  htmlCorreo, nombreProcesoCorreo, nuevoMessageId, saludoCorreo
} from './correo-avance.util';

// PNG minimo valido de 2x1 (solo importa la cabecera para las dimensiones).
const PNG = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52,
  0, 0, 0x07, 0xd0, 0, 0, 0x03, 0xe8, 8, 6, 0, 0, 0
]);

describe('correo-avance.util', () => {
  it('arma saludo y nombres como el correo actual', () => {
    expect(saludoCorreo('Buenas noches', 'Ing. Christian')).toBe('Buenas Noches, Ing. Christian');
    expect(saludoCorreo('Buenos días', '')).toBe('Buenos Días');
    expect(nombreProcesoCorreo('Arándano fresco')).toBe('ARANDANO fresco');
    expect(fechaConPuntos('2026-11-04')).toBe('04.11.2026');
  });

  it('asunto: sin tildes ni "fresco", con año y fecha (sin RE:, igual en todos los correos del dia)', () => {
    const base = asuntoBase('Arándano fresco', 2026, '2026-11-04');
    expect(base).toBe('AVANCE PROCESO ARANDANO 2026 -04.11.2026');
  });

  it('codifica cabeceras no ASCII y deja intactas las ASCII', () => {
    expect(cabeceraCodificada('AVANCE 2026')).toBe('AVANCE 2026');
    const c = cabeceraCodificada('Avance de producción número uno');
    expect(c).toContain('=?UTF-8?B?');
    expect(c.split('\r\n').every((l) => l.trim().length <= 75)).toBeTrue();
  });

  it('lee las dimensiones del PNG', () => {
    expect(dimensionesPng(PNG)).toEqual({ ancho: 2000, alto: 1000 });
    expect(dimensionesPng(new Uint8Array(4))).toBeNull();
  });

  it('html: saludo, frase, imagen escalada y "Saludos"', () => {
    const h = htmlCorreo({ saludo: 'Buenas Noches', frase: 'Se envía <avance>', png: PNG }, 'cid:x');
    expect(h).toContain('width="960" height="480"');
    expect(h).toContain('Se envía &lt;avance&gt;');
    expect(h).toContain('Saludos');
  });

  it('eml: borrador con imagen incrustada y encabezados del hilo', () => {
    const id = nuevoMessageId(7, 1000);
    const eml = construirEml({
      asunto: 'AVANCE PROCESO ARANDANO 2026 -04.11.2026', para: 'a@x.com; b@x.com', cc: 'c@x.com',
      saludo: 'Buenas Noches', frase: 'Frase', png: PNG, messageId: id, anteriores: ['<previo@betaapp.local>']
    });
    expect(eml).toContain('X-Unsent: 1');
    expect(eml).toContain('To: a@x.com, b@x.com');
    expect(eml).toContain('Cc: c@x.com');
    expect(eml).toContain('Subject: AVANCE PROCESO ARANDANO 2026 -04.11.2026');
    expect(eml).toContain('In-Reply-To: <previo@betaapp.local>');
    expect(eml).toContain('References: <previo@betaapp.local>');
    expect(eml).toContain('Content-ID: <avance-reporte@betaapp.local>');
    expect(eml).toContain(`Message-ID: ${id}`);
    expect(eml).toContain('multipart/related');
  });

  it('eml del primer correo no trae In-Reply-To', () => {
    const eml = construirEml({
      asunto: 'A', para: '', cc: '', saludo: 'S', frase: 'F', png: PNG, messageId: '<1@betaapp.local>', anteriores: []
    });
    expect(eml).not.toContain('In-Reply-To');
    expect(eml).not.toContain('To:');
  });
});
