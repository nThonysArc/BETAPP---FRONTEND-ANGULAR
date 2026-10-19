import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CatalogoPermisos, UsuarioAdmin, UsuarioAdminRequest } from '../models/usuario-admin.model';

/** Gestion de usuarios y permisos (solo super admin). */
@Injectable({ providedIn: 'root' })
export class UsuarioAdminService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/admin/usuarios`;

  listar(): Observable<UsuarioAdmin[]> {
    return this.http.get<UsuarioAdmin[]>(this.baseUrl);
  }

  catalogo(): Observable<CatalogoPermisos> {
    return this.http.get<CatalogoPermisos>(`${this.baseUrl}/catalogo-permisos`);
  }

  crear(request: UsuarioAdminRequest): Observable<UsuarioAdmin> {
    return this.http.post<UsuarioAdmin>(this.baseUrl, request);
  }

  actualizar(id: number, request: UsuarioAdminRequest): Observable<UsuarioAdmin> {
    return this.http.put<UsuarioAdmin>(`${this.baseUrl}/${id}`, request);
  }
}
