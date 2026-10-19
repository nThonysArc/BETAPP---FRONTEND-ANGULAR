import { Injectable, computed, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { LoginRequest, LoginResponse, RolUsuario } from '../models/auth.model';

const TOKEN_KEY = 'avance_token';
const USER_KEY = 'avance_usuario';

interface UsuarioActual {
  email: string;
  nombreCompleto: string;
  rol: RolUsuario;
  permisos: string[];
}

/**
 * Maneja la sesion del usuario: login, token JWT, y el usuario actual
 * expuesto como signal para que cualquier componente reaccione a cambios
 * (ej. mostrar/ocultar botones segun rol) sin necesidad de suscribirse
 * manualmente a un Observable.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly usuarioSignal = signal<UsuarioActual | null>(this.leerUsuarioGuardado());

  readonly usuario = this.usuarioSignal.asReadonly();
  readonly estaAutenticado = computed(() => this.usuarioSignal() !== null);
  readonly esSuperAdmin = computed(() => this.usuarioSignal()?.rol === 'SUPER_ADMIN');
  private readonly permisosSet = computed(() => new Set(this.usuarioSignal()?.permisos ?? []));

  /**
   * Solo sirve para mostrar u ocultar opciones. La seguridad real la aplica el backend en cada
   * peticion; los permisos aqui son los del ultimo inicio de sesion.
   */
  tiene(permiso: string): boolean {
    return this.permisosSet().has(permiso);
  }

  constructor(private http: HttpClient) {}

  login(request: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${environment.apiUrl}/auth/login`, request).pipe(
      tap((response) => this.guardarSesion(response))
    );
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this.usuarioSignal.set(null);
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  private guardarSesion(response: LoginResponse): void {
    localStorage.setItem(TOKEN_KEY, response.token);
    const usuario: UsuarioActual = {
      email: response.email,
      nombreCompleto: response.nombreCompleto,
      rol: response.rol,
      permisos: response.permisos ?? []
    };
    localStorage.setItem(USER_KEY, JSON.stringify(usuario));
    this.usuarioSignal.set(usuario);
  }

  private leerUsuarioGuardado(): UsuarioActual | null {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      const usuario = JSON.parse(raw) as UsuarioActual;
      // Sesion guardada antes de existir los permisos: se obliga a iniciar sesion de nuevo
      return Array.isArray(usuario.permisos) ? usuario : null;
    } catch {
      return null;
    }
  }
}
