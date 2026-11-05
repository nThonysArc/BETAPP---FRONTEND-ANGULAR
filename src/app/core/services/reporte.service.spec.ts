import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ReporteService } from './reporte.service';

describe('ReporteService.descargarExcel', () => {
  it('pide el xlsx como blob al endpoint del proceso', () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const servicio = TestBed.inject(ReporteService);
    const http = TestBed.inject(HttpTestingController);

    let recibido: Blob | null | undefined;
    servicio.descargarExcel(7).subscribe((r) => (recibido = r.body));

    const req = http.expectOne((r) => r.url.endsWith('/procesos/7/reporte-excel'));
    expect(req.request.method).toBe('GET');
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob(['x']));
    expect(recibido).toBeTruthy();
    http.verify();
  });

  it('lee el nombre del archivo de Content-Disposition', () => {
    expect(ReporteService.nombreDeArchivo('attachment; filename="AVANCE POR HORA PROCESO ARANDANO FRESCO 2026-11-05.xlsx"'))
      .toBe('AVANCE POR HORA PROCESO ARANDANO FRESCO 2026-11-05.xlsx');
    expect(ReporteService.nombreDeArchivo("attachment; filename*=UTF-8''A%20B.xlsx")).toBe('A B.xlsx');
    expect(ReporteService.nombreDeArchivo(null)).toBeNull();
  });
});
