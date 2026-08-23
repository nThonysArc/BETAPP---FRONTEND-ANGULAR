import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { MaquinaKato, MaquinaKatoRequest } from '../models/maquina-kato.model';

@Injectable({ providedIn: 'root' })
export class MaquinaKatoService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/maquina-katos`;

  listarPorMaquina(maquinaId: number, incluirInactivos = false): Observable<MaquinaKato[]> {
    return this.http.get<MaquinaKato[]>(this.baseUrl, { params: { maquinaId, incluirInactivos } });
  }

  crear(request: MaquinaKatoRequest): Observable<MaquinaKato> {
    return this.http.post<MaquinaKato>(this.baseUrl, request);
  }

  actualizar(id: number, request: MaquinaKatoRequest): Observable<MaquinaKato> {
    return this.http.put<MaquinaKato>(`${this.baseUrl}/${id}`, request);
  }

  desactivar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  reactivar(id: number): Observable<MaquinaKato> {
    return this.http.post<MaquinaKato>(`${this.baseUrl}/${id}/reactivar`, {});
  }
}
