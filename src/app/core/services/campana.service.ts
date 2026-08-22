import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Campana, CampanaRequest } from '../models/campana.model';

@Injectable({ providedIn: 'root' })
export class CampanaService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/campanas`;

  listar(incluirInactivas = false): Observable<Campana[]> {
    return this.http.get<Campana[]>(this.baseUrl, { params: { incluirInactivas } });
  }

  obtener(id: number): Observable<Campana> {
    return this.http.get<Campana>(`${this.baseUrl}/${id}`);
  }

  crear(request: CampanaRequest): Observable<Campana> {
    return this.http.post<Campana>(this.baseUrl, request);
  }

  actualizar(id: number, request: CampanaRequest): Observable<Campana> {
    return this.http.put<Campana>(`${this.baseUrl}/${id}`, request);
  }

  desactivar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  reactivar(id: number): Observable<Campana> {
    return this.http.post<Campana>(`${this.baseUrl}/${id}/reactivar`, {});
  }
}
