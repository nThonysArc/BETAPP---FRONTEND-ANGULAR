import { RolUsuario } from './auth.model';

export interface UsuarioAdmin {
  id: number;
  nombreCompleto: string;
  email: string;
  rol: RolUsuario;
  activo: boolean;
  puedeIniciarSesion: boolean;
  permisos: string[];
}

export interface PermisoItem {
  codigo: string;
  modulo: string;
  accion: string;
  descripcion: string;
  requiere: string[];
}

export interface CatalogoPermisos {
  permisos: PermisoItem[];
  /** rol -> permisos con los que se precarga la checklist */
  plantillas: Record<string, string[]>;
}

export interface UsuarioAdminRequest {
  nombreCompleto: string;
  email?: string | null;
  password?: string | null;
  rol: RolUsuario;
  activo?: boolean | null;
  permisos: string[];
}
