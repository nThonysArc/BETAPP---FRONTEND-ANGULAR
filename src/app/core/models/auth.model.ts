export interface LoginRequest {
  email: string;
  password: string;
}

export type RolUsuario = 'SUPER_ADMIN' | 'ADMIN' | 'SUPERVISOR' | 'OPERADOR';

export interface LoginResponse {
  token: string;
  email: string;
  nombreCompleto: string;
  rol: RolUsuario;
  /** Codigos de permiso (ej. "CORTES_CREAR"). El SUPER_ADMIN recibe todos. */
  permisos: string[];
}
