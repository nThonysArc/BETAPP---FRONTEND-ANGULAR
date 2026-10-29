import { Corte } from '../models/corte.model';

/**
 * Un corte es "almuerzo del personal" cuando TODAS las maquinas que intervienen salieron a almorzar
 * (puede ser una sola maquina, si era la unica operando). Misma regla que usa el reporte, para que la
 * lista de cortes y la imagen nunca se contradigan.
 */
export function esAlmuerzoGeneral(corte: Corte): boolean {
  const filaPorMaquina = new Map<number, boolean>();
  for (const s of corte.supervisores ?? []) {
    filaPorMaquina.set(s.maquinaId, s.almuerzo);
  }
  const maquinas = new Set<number>([...filaPorMaquina.keys(), ...(corte.detalles ?? []).map((d) => d.maquinaId)]);
  if (maquinas.size === 0) return false;
  return [...maquinas].every((id) => filaPorMaquina.get(id) === true);
}

/**
 * Numero de HORA DE PROCESO de cada corte, tal como sale en el reporte: el almuerzo general no ocupa
 * numero (queda null) y las horas siguientes continuan la cuenta. Clave: id del corte.
 */
export function numerosDeHora(cortes: Corte[]): Map<number, number | null> {
  const resultado = new Map<number, number | null>();
  let numero = 0;
  for (const c of [...cortes].sort((a, b) => a.numeroCorte - b.numeroCorte)) {
    resultado.set(c.id, esAlmuerzoGeneral(c) ? null : ++numero);
  }
  return resultado;
}
