import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ProcesoDiario, ProcesoDiarioRequest } from '../models/proceso-diario.model';

@Injectable({ providedIn: 'root' })
export class ProcesoDiarioService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/procesos`;

  obtener(id: number): Observable<ProcesoDiario> {
    return this.http.get<ProcesoDiario>(`${this.baseUrl}/${id}`);
  }

  buscarPorCampanaYFecha(campanaId: number, fecha: string): Observable<ProcesoDiario> {
    return this.http.get<ProcesoDiario>(`${this.baseUrl}/buscar`, { params: { campanaId, fecha } });
  }

  crear(request: ProcesoDiarioRequest): Observable<ProcesoDiario> {
    return this.http.post<ProcesoDiario>(this.baseUrl, request);
  }

  cerrar(id: number): Observable<ProcesoDiario> {
    return this.http.post<ProcesoDiario>(`${this.baseUrl}/${id}/cerrar`, {});
  }
}
