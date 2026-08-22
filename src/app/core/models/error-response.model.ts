export interface CampoError {
  campo: string;
  mensaje: string;
}

export interface ErrorResponse {
  timestamp: string;
  status: number;
  error: string;
  message: string;
  path: string;
  errores: CampoError[] | null;
}
