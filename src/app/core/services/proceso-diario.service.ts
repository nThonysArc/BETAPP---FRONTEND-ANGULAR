import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ProcesoDiario, ProcesoDiarioRequest } from '../models/proceso-diario.model';

@Injectable({ providedIn: 'root' })
export class ProcesoDiarioService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/procesos`;

  listarPorCampana(campanaId: number): Observable<ProcesoDiario[]> {
    return this.http.get<ProcesoDiario[]>(this.baseUrl, { params: { campanaId } });
  }

  obtener(id: number): Observable<ProcesoDiario> {
    return this.http.get<ProcesoDiario>(`${this.baseUrl}/${id}`);
  }

  buscarPorCampanaYFecha(campanaId: number, fecha: string): Observable<ProcesoDiario> {
    return this.http.get<ProcesoDiario>(`${this.baseUrl}/buscar`, { params: { campanaId, fecha } });
  }

  crear(request: ProcesoDiarioRequest): Observable<ProcesoDiario> {
    return this.http.post<ProcesoDiario>(this.baseUrl, request);
  }

  /** Jabas de dias previos de la campana (ingresadas y procesadas); lo usa el reporte de Vid, tambien sin conexion. */
  arrastre(id: number): Observable<{ ingresoAnteriorJabas: number; acumuladoAnteriorJabas: number }> {
    return this.http.get<{ ingresoAnteriorJabas: number; acumuladoAnteriorJabas: number }>(`${this.baseUrl}/${id}/arrastre`);
  }

  /** Guarda la proyeccion de jabas del dia (Vid); null la borra. */
  actualizarProyeccion(id: number, jabas: number | null): Observable<ProcesoDiario> {
    return this.http.put<ProcesoDiario>(`${this.baseUrl}/${id}/proyeccion`, { jabas });
  }

  /** Guarda el stock que quedo de un dia previo (Vid); jabas null lo borra. fecha null = el dia anterior al proceso. */
  actualizarStockAnterior(id: number, jabas: number | null, fecha: string | null): Observable<ProcesoDiario> {
    return this.http.put<ProcesoDiario>(`${this.baseUrl}/${id}/stock-anterior`, { jabas, fecha });
  }

  cerrar(id: number): Observable<ProcesoDiario> {
    return this.http.post<ProcesoDiario>(`${this.baseUrl}/${id}/cerrar`, {});
  }

  reabrir(id: number): Observable<ProcesoDiario> {
    return this.http.post<ProcesoDiario>(`${this.baseUrl}/${id}/reabrir`, {});
  }
}
