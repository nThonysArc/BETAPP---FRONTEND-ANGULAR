import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpResponse } from '@angular/common/http';
import { Observable, catchError, map, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { ReporteLocalService } from '../reporte-local/reporte-local.service';
import { environment } from '../../../environments/environment';
import { Advertencia } from '../models/advertencia.model';
import { AvanceVersion, AvanceVivoResponse } from '../models/avance-vivo.model';

@Injectable({ providedIn: 'root' })
export class ReporteService {
  private readonly http = inject(HttpClient);
  private readonly local = inject(ReporteLocalService);

  /**
   * Sin red (o servidor caido) se dibuja/calcula en el dispositivo con lo guardado; con red manda el servidor.
   * Por que: el asistente no debe quedarse sin reporte por falta de internet. Errores "reales" del servidor
   * (403, 404, 409...) NO se tapan: se propagan para que la pantalla los explique.
   */
  private static sinServicio(e: unknown): boolean {
    return e instanceof HttpErrorResponse && (e.status === 0 || e.status === 502 || e.status === 503 || e.status === 504);
  }

  private conRespaldo<T>(remoto: Observable<T>, local: () => Observable<T>): Observable<T> {
    return remoto.pipe(
      catchError((e) => (ReporteService.sinServicio(e) ? local() : throwError(() => e)))
    );
  }

  /** Advertencias de consistencia del dia (lista vacia si el producto no usa la plantilla Vid). */
  obtenerAdvertencias(procesoDiarioId: number): Observable<Advertencia[]> {
    return this.http.get<Advertencia[]>(`${environment.apiUrl}/procesos/${procesoDiarioId}/advertencias`);
  }

  /** Avance completo del dia como datos (para la vista en linea). */
  obtenerAvance(procesoDiarioId: number): Observable<AvanceVivoResponse> {
    return this.conRespaldo(
      this.http.get<AvanceVivoResponse>(`${environment.apiUrl}/procesos/${procesoDiarioId}/avance`),
      () => this.local.avance(procesoDiarioId)
    );
  }

  /** Chequeo barato "¿cambio algo?": solo devuelve una huella; la pantalla baja el avance si esta cambio. */
  obtenerVersionAvance(procesoDiarioId: number): Observable<AvanceVersion> {
    return this.conRespaldo(
      this.http.get<AvanceVersion>(`${environment.apiUrl}/procesos/${procesoDiarioId}/avance/version`),
      () => this.local.obtener(procesoDiarioId).pipe(
        map((r) => ({ procesoDiarioId, version: r.version, consultadoEn: new Date().toISOString() }))
      )
    );
  }

  obtenerImagenReporte(procesoDiarioId: number): Observable<Blob> {
    return this.conRespaldo(
      this.http.get(`${environment.apiUrl}/procesos/${procesoDiarioId}/reporte-imagen`, { responseType: 'blob' }),
      () => this.local.imagen(procesoDiarioId)
    );
  }

  /** Reporte editable (.xlsx) con formulas vivas. Solo Arandano por ahora. */
  descargarExcel(procesoDiarioId: number): Observable<HttpResponse<Blob>> {
    // observe 'response' para poder leer el nombre del archivo que manda el backend (Content-Disposition).
    return this.http.get(`${environment.apiUrl}/procesos/${procesoDiarioId}/reporte-excel`, {
      responseType: 'blob',
      observe: 'response'
    });
  }

  /** Saca el nombre del archivo del encabezado Content-Disposition (null si no viene). */
  static nombreDeArchivo(contentDisposition: string | null): string | null {
    if (!contentDisposition) return null;
    const m = /filename\*=UTF-8''([^;]+)/i.exec(contentDisposition) ?? /filename="?([^";]+)"?/i.exec(contentDisposition);
    if (!m) return null;
    try {
      return decodeURIComponent(m[1]).trim();
    } catch {
      return m[1].trim();
    }
  }
}
