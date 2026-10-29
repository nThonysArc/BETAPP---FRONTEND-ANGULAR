/** Espejo del JSON de GET /api/procesos/{id}/avance (reporte de avance en forma de datos). */

export interface AvanceVivoResponse {
  procesoDiarioId: number;
  plantilla: 'ARANDANO' | 'VID';
  estadoProceso: 'ABIERTO' | 'CERRADO';
  /** false = el producto aun no tiene vista en linea (hoy Vid); `avance` viene null y `mensaje` explica. */
  disponible: boolean;
  mensaje: string | null;
  /** Huella del estado del proceso: si no cambia, no hay nada nuevo que bajar. */
  version: string;
  generadoEn: string;
  avance: AvanceVivo | null;
}

export interface AvanceVersion {
  procesoDiarioId: number;
  version: string;
  consultadoEn: string;
}

export interface AvanceVivo {
  titulo: string;
  fecha: string;
  ingresos: AvanceIngreso[];
  ingresoJabas: number;
  ingresoKilos: number;
  horas: AvanceHora[];
  pie: AvancePie;
  resumen: AvanceResumenMaquina[];
  totalJabas: number;
  totalKilos: number;
}

export interface AvanceIngreso {
  variedad: string;
  jabas: number;
  kilos: number;
}

export interface AvanceHora {
  /** null en la barra de almuerzo del personal (no es hora de produccion). */
  numero: number | null;
  pausa: boolean;
  inicio: string; // 'HH:mm:ss'
  fin: string;
  fechaCosecha: string | null;
  observacionGeneral: string | null;
  jabas: number;
  kilos: number;
  acumuladoKilos: number;
  maquinas: AvanceMaquinaHora[];
}

export interface AvanceMaquinaHora {
  maquinaId: number;
  maquina: string;
  supervisor: string | null;
  observacion: string | null;
  almuerzo: boolean;
  jabas: number;
  kilos: number;
  filas: AvanceFila[];
}

export interface AvanceFila {
  kato: string;
  variedad: string;
  jabas: number;
  peso: number;
  empacadores: number;
  kgPorEmpacador: number;
}

export interface AvancePie {
  ultimaHoraJabas: number;
  ultimaHoraKilos: number;
  previoJabas: number;
  previoKilos: number;
  acumuladoJabas: number;
  acumuladoKilos: number;
  stockJabas: number;
  stockKilos: number;
}

export interface AvanceResumenMaquina {
  maquinaId: number;
  maquina: string;
  jabas: number;
  kilos: number;
  tramos: { supervisor: string; inicio: string; fin: string }[];
}
