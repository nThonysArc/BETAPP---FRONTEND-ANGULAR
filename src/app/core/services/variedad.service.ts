import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Variedad, VariedadRequest } from '../models/variedad.model';

@Injectable({ providedIn: 'root' })
export class VariedadService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/variedades`;

  listarPorProducto(productoId: number, incluirInactivas = false): Observable<Variedad[]> {
    return this.http.get<Variedad[]>(this.baseUrl, { params: { productoId, incluirInactivas } });
  }

  crear(request: VariedadRequest): Observable<Variedad> {
    return this.http.post<Variedad>(this.baseUrl, request);
  }

  actualizar(id: number, request: VariedadRequest): Observable<Variedad> {
    return this.http.put<Variedad>(`${this.baseUrl}/${id}`, request);
  }

  desactivar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  reactivar(id: number): Observable<Variedad> {
    return this.http.post<Variedad>(`${this.baseUrl}/${id}/reactivar`, {});
  }
}
