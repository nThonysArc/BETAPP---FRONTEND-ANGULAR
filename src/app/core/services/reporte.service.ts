import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Advertencia } from '../models/advertencia.model';
import { AvanceVersion, AvanceVivoResponse } from '../models/avance-vivo.model';

@Injectable({ providedIn: 'root' })
export class ReporteService {
  private readonly http = inject(HttpClient);

  /** Advertencias de consistencia del dia (lista vacia si el producto no usa la plantilla Vid). */
  obtenerAdvertencias(procesoDiarioId: number): Observable<Advertencia[]> {
    return this.http.get<Advertencia[]>(`${environment.apiUrl}/procesos/${procesoDiarioId}/advertencias`);
  }

  /** Avance completo del dia como datos (para la vista en linea). */
  obtenerAvance(procesoDiarioId: number): Observable<AvanceVivoResponse> {
    return this.http.get<AvanceVivoResponse>(`${environment.apiUrl}/procesos/${procesoDiarioId}/avance`);
  }

  /** Chequeo barato "¿cambio algo?": solo devuelve una huella; la pantalla baja el avance si esta cambio. */
  obtenerVersionAvance(procesoDiarioId: number): Observable<AvanceVersion> {
    return this.http.get<AvanceVersion>(`${environment.apiUrl}/procesos/${procesoDiarioId}/avance/version`);
  }

  obtenerImagenReporte(procesoDiarioId: number): Observable<Blob> {
    return this.http.get(`${environment.apiUrl}/procesos/${procesoDiarioId}/reporte-imagen`, {
      responseType: 'blob'
    });
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
