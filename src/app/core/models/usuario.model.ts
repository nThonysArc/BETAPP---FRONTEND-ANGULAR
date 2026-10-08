/** Vista minima de un usuario para selectores y administracion de supervisores. */
export interface UsuarioResumen {
  id: number;
  nombreCompleto: string;
  rol: string;
  activo?: boolean;
}

/**
 * Alta/edicion de supervisor. Solo el nombre es obligatorio; email y password
 * son opcionales (juntos) y solo si ese supervisor va a iniciar sesion.
 */
export interface SupervisorRequest {
  nombreCompleto: string;
  email?: string | null;
  password?: string | null;
}
