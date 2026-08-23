import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Corte, CorteRequest, CortePlantilla } from '../models/corte.model';

@Injectable({ providedIn: 'root' })
export class CorteService {
  private readonly http = inject(HttpClient);

  private baseUrl(procesoDiarioId: number): string {
    return `${environment.apiUrl}/procesos/${procesoDiarioId}/cortes`;
  }

  obtenerPlantillaSiguiente(procesoDiarioId: number): Observable<CortePlantilla> {
    return this.http.get<CortePlantilla>(`${this.baseUrl(procesoDiarioId)}/plantilla-siguiente`);
  }

  listar(procesoDiarioId: number): Observable<Corte[]> {
    return this.http.get<Corte[]>(this.baseUrl(procesoDiarioId));
  }

  obtener(procesoDiarioId: number, corteId: number): Observable<Corte> {
    return this.http.get<Corte>(`${this.baseUrl(procesoDiarioId)}/${corteId}`);
  }

  crear(procesoDiarioId: number, request: CorteRequest): Observable<Corte> {
    return this.http.post<Corte>(this.baseUrl(procesoDiarioId), request);
  }

  actualizar(procesoDiarioId: number, corteId: number, request: CorteRequest): Observable<Corte> {
    return this.http.put<Corte>(`${this.baseUrl(procesoDiarioId)}/${corteId}`, request);
  }

  consolidar(procesoDiarioId: number, corteId: number): Observable<Corte> {
    return this.http.post<Corte>(`${this.baseUrl(procesoDiarioId)}/${corteId}/consolidar`, {});
  }
}
