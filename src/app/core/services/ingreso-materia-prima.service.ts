import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { IngresoMateriaPrima, IngresoMateriaPrimaRequest } from '../models/ingreso-materia-prima.model';

@Injectable({ providedIn: 'root' })
export class IngresoMateriaPrimaService {
  private readonly http = inject(HttpClient);

  private baseUrl(procesoDiarioId: number): string {
    return `${environment.apiUrl}/procesos/${procesoDiarioId}/materia-prima`;
  }

  listar(procesoDiarioId: number): Observable<IngresoMateriaPrima[]> {
    return this.http.get<IngresoMateriaPrima[]>(this.baseUrl(procesoDiarioId));
  }

  actualizar(procesoDiarioId: number, request: IngresoMateriaPrimaRequest): Observable<IngresoMateriaPrima> {
    return this.http.put<IngresoMateriaPrima>(this.baseUrl(procesoDiarioId), request);
  }
}
