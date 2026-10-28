import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Advertencia } from '../models/advertencia.model';

@Injectable({ providedIn: 'root' })
export class ReporteService {
  private readonly http = inject(HttpClient);

  /** Advertencias de consistencia del dia (lista vacia si el producto no usa la plantilla Vid). */
  obtenerAdvertencias(procesoDiarioId: number): Observable<Advertencia[]> {
    return this.http.get<Advertencia[]>(`${environment.apiUrl}/procesos/${procesoDiarioId}/advertencias`);
  }

  obtenerImagenReporte(procesoDiarioId: number): Observable<Blob> {
    return this.http.get(`${environment.apiUrl}/procesos/${procesoDiarioId}/reporte-imagen`, {
      responseType: 'blob'
    });
  }
}
