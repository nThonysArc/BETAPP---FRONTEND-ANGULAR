import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SupervisorRequest, UsuarioResumen } from '../models/usuario.model';

@Injectable({ providedIn: 'root' })
export class UsuarioService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/usuarios`;

  /** Supervisores ordenados por nombre; por defecto solo los activos. */
  listarSupervisores(incluirInactivos = false): Observable<UsuarioResumen[]> {
    return this.http.get<UsuarioResumen[]>(this.baseUrl, { params: { rol: 'SUPERVISOR', incluirInactivos } });
  }

  crearSupervisor(request: SupervisorRequest): Observable<UsuarioResumen> {
    return this.http.post<UsuarioResumen>(this.baseUrl, request);
  }

  actualizarSupervisor(id: number, request: SupervisorRequest): Observable<UsuarioResumen> {
    return this.http.put<UsuarioResumen>(`${this.baseUrl}/${id}`, request);
  }

  desactivar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  reactivar(id: number): Observable<UsuarioResumen> {
    return this.http.post<UsuarioResumen>(`${this.baseUrl}/${id}/reactivar`, {});
  }
}
