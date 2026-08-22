import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Maquina, MaquinaRequest } from '../models/maquina.model';

@Injectable({ providedIn: 'root' })
export class MaquinaService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/maquinas`;

  listarPorCampana(campanaId: number, incluirInactivas = false): Observable<Maquina[]> {
    return this.http.get<Maquina[]>(this.baseUrl, { params: { campanaId, incluirInactivas } });
  }

  crear(request: MaquinaRequest): Observable<Maquina> {
    return this.http.post<Maquina>(this.baseUrl, request);
  }

  actualizar(id: number, request: MaquinaRequest): Observable<Maquina> {
    return this.http.put<Maquina>(`${this.baseUrl}/${id}`, request);
  }

  desactivar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  reactivar(id: number): Observable<Maquina> {
    return this.http.post<Maquina>(`${this.baseUrl}/${id}/reactivar`, {});
  }
}
