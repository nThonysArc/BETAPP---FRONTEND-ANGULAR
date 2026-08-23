export interface IngresoMateriaPrima {
  id: number;
  variedadId: number;
  variedadNombre: string;
  jabas: number;
  kilos: number;
  pesoPromedioPorJaba: number | null;
  actualizadoEn: string;
}

export interface IngresoMateriaPrimaRequest {
  variedadId: number;
  jabas: number;
  kilos: number;
}
