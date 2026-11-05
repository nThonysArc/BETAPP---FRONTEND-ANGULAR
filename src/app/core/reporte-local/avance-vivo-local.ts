/**
 * Version en el dispositivo de AvanceVivoCalculador.java: convierte los datos del reporte en la
 * vista "Avance en vivo" (horas, pie de totales, resumen por maquina). Funciones puras.
 * Por que: sin internet la pantalla de monitoreo debe seguir mostrando lo que se esta capturando.
 */
import { AvanceHora, AvanceMaquinaHora, AvanceResumenMaquina, AvanceVivo, AvanceVivoResponse } from '../models/avance-vivo.model';
import { ReporteDatos, todoAlmuerzo } from './reporte-datos';

const nz = (n: number | null | undefined): number => (n == null || Number.isNaN(n) ? 0 : n);
const vacio = (s: string | null | undefined): boolean => !s || s.trim() === '';
const r2 = (n: number): number => Math.round((n + Number.EPSILON) * 1e6) / 1e6;

export function calcularAvanceVivo(d: ReporteDatos): AvanceVivo {
  const ingresos = d.ingresos.map((l) => ({ variedad: l.variedad, jabas: nz(l.jabas), kilos: nz(l.kilos) }));
  const mpJabas = ingresos.reduce((a, i) => a + i.jabas, 0);
  const mpKilos = ingresos.reduce((a, i) => a + i.kilos, 0);

  const horas: AvanceHora[] = [];
  const resumen = new Map<number, AvanceResumenMaquina>();
  let totJabas = 0, totKilos = 0, ultJabas = 0, ultKilos = 0, acumulado = 0, numero = 0;

  for (const c of d.cortes) {
    totJabas += nz(c.jabasTotal);
    totKilos += nz(c.pesoTotal);

    if (todoAlmuerzo(c)) {
      horas.push({
        numero: null, pausa: true, inicio: c.inicio, fin: c.fin, fechaCosecha: c.fechaCosecha,
        observacionGeneral: c.observacionGeneral, jabas: 0, kilos: 0, acumuladoKilos: r2(acumulado), maquinas: []
      });
      continue;
    }
    ultJabas = nz(c.jabasTotal);
    ultKilos = nz(c.pesoTotal);
    acumulado += ultKilos;

    const info = new Map(c.maquinas.map((m) => [m.maquinaId, m]));
    const porMaquina = new Map<number, typeof c.filas>();
    for (const f of c.filas) {
      const g = porMaquina.get(f.maquinaId);
      if (g) g.push(f);
      else porMaquina.set(f.maquinaId, [f]);
    }

    const maquinas: AvanceMaquinaHora[] = [];
    for (const [id, filas] of porMaquina) {
      const m = info.get(id);
      const jabas = filas.reduce((a, f) => a + nz(f.jabas), 0);
      const kilos = filas.reduce((a, f) => a + nz(f.peso), 0);
      const supervisor = m && !vacio(m.supervisor) ? m.supervisor : null;
      maquinas.push({
        maquinaId: id, maquina: filas[0].maquina, supervisor, observacion: m?.observacion ?? null,
        almuerzo: !!m?.almuerzo, jabas: r2(jabas), kilos: r2(kilos),
        filas: filas.map((f) => ({
          kato: f.kato, variedad: f.variedad, jabas: nz(f.jabas), peso: nz(f.peso),
          empacadores: f.empacadores, kgPorEmpacador: nz(f.kgPorEmpacador)
        }))
      });

      let r = resumen.get(id);
      if (!r) {
        r = { maquinaId: id, maquina: filas[0].maquina, jabas: 0, kilos: 0, tramos: [] };
        resumen.set(id, r);
      }
      r.jabas = r2(r.jabas + jabas);
      r.kilos = r2(r.kilos + kilos);
      const sup = supervisor ?? '-';
      const ultimo = r.tramos[r.tramos.length - 1];
      if (ultimo && ultimo.supervisor === sup) ultimo.fin = c.fin;
      else r.tramos.push({ supervisor: sup, inicio: c.inicio, fin: c.fin });
    }

    horas.push({
      numero: ++numero, pausa: false, inicio: c.inicio, fin: c.fin, fechaCosecha: c.fechaCosecha,
      observacionGeneral: c.observacionGeneral, jabas: nz(c.jabasTotal), kilos: nz(c.pesoTotal),
      acumuladoKilos: r2(acumulado), maquinas
    });
  }

  const resumenMaquinas = [...resumen.values()];
  return {
    titulo: d.titulo, fecha: d.fechaProceso, ingresos, ingresoJabas: r2(mpJabas), ingresoKilos: r2(mpKilos),
    horas,
    pie: {
      ultimaHoraJabas: ultJabas, ultimaHoraKilos: ultKilos,
      previoJabas: r2(totJabas - ultJabas), previoKilos: r2(totKilos - ultKilos),
      acumuladoJabas: r2(totJabas), acumuladoKilos: r2(totKilos),
      stockJabas: r2(mpJabas - totJabas), stockKilos: r2(mpKilos - totKilos)
    },
    resumen: resumenMaquinas,
    totalJabas: r2(resumenMaquinas.reduce((a, r) => a + r.jabas, 0)),
    totalKilos: r2(resumenMaquinas.reduce((a, r) => a + r.kilos, 0))
  };
}

export function respuestaAvanceLocal(
  procesoId: number, estado: 'ABIERTO' | 'CERRADO', datos: ReporteDatos, version: string
): AvanceVivoResponse {
  return {
    procesoDiarioId: procesoId, plantilla: 'ARANDANO', estadoProceso: estado, disponible: true, mensaje: null,
    version, generadoEn: new Date().toISOString(), avance: calcularAvanceVivo(datos)
  };
}
