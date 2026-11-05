import { Injectable, inject } from '@angular/core';
import { Observable, catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { Advertencia } from '../models/advertencia.model';
import { AvanceVivoResponse } from '../models/avance-vivo.model';
import { Corte } from '../models/corte.model';
import { Maquina } from '../models/maquina.model';
import { CampanaService } from '../services/campana.service';
import { CorteService } from '../services/corte.service';
import { IngresoMateriaPrimaService } from '../services/ingreso-materia-prima.service';
import { MaquinaService } from '../services/maquina.service';
import { ProcesoDiarioService } from '../services/proceso-diario.service';
import { ProductoService } from '../services/producto.service';
import { respuestaAvanceLocal } from './avance-vivo-local';
import { Imagen, cargarImagen, renderizarReportePng } from './reporte-canvas';
import { ReporteDatos, construirDatosReporte } from './reporte-datos';
import { HoraVid, ResultadoVid, calcularVid, validarVid } from './vid-calculo';
import { renderizarReporteVidPng } from './vid-canvas';

export interface ReporteLocal {
  /** Datos de la plantilla Arandano (null si el producto usa la de Vid). */
  datos: ReporteDatos | null;
  /** Calculo de la plantilla Vid (null si es Arandano). */
  vid: { horas: HoraVid[]; resultado: ResultadoVid; advertencias: Advertencia[] } | null;
  estado: 'ABIERTO' | 'CERRADO';
  plantilla: 'ARANDANO' | 'VID';
  producto: string;
  anio: number | null;
  fecha: string;
  version: string;
}

/** Nombre del archivo de foto a partir del producto ("Vid" -> "vid"), como en el servidor. */
export function slugProducto(nombre: string): string {
  return nombre.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

/** Corte guardado -> hora de Vid (espejo de AvanceVidService.mapearHora): un modulo por detalle. */
export function horaVidDeCorte(c: Corte, supervisorPorMaquina: Map<number, string | null>): HoraVid {
  const porMaquina = new Map((c.supervisores ?? []).map((s) => [s.maquinaId, s]));
  const detalles = c.detalles
    .map((d, i) => ({ d, i }))
    .sort((a, b) => (a.d.orden ?? 0) - (b.d.orden ?? 0) || a.i - b.i)
    .map((x) => x.d);
  return {
    numero: c.numeroCorte,
    inicio: c.horaInicio,
    fin: c.horaFin,
    fechaCosecha: c.fechaCosecha ?? null,
    totalAjustado: c.jabasTotalAjustado ?? null,
    modulos: detalles.map((d) => {
      const cm = porMaquina.get(d.maquinaId);
      return {
        maquinaId: d.maquinaId,
        modulo: d.maquinaNombre ?? '',
        variedad: d.variedadNombre ?? '',
        personas: d.empacadores ?? 0,
        jabas: d.jabas,
        // Con fila de supervisor del corte manda esa (aunque venga vacia); sin fila, el de la maquina.
        supervisor: cm ? cm.supervisorNombre : supervisorPorMaquina.get(d.maquinaId) ?? null,
        observacion: cm ? cm.observacion : null,
        almuerzo: !!cm?.almuerzo
      };
    })
  };
}

/**
 * Arma el reporte (PNG, avance en vivo y advertencias) en el dispositivo, con lo que haya guardado.
 *
 * Por que reutiliza los servicios HTTP normales: el interceptor offline ya responde esas lecturas
 * desde IndexedDB (incluyendo los cortes pendientes de sync), asi que este servicio no toca la
 * base directamente y siempre ve lo mismo que el resto de pantallas.
 */
@Injectable({ providedIn: 'root' })
export class ReporteLocalService {
  private readonly procesos = inject(ProcesoDiarioService);
  private readonly campanas = inject(CampanaService);
  private readonly cortes = inject(CorteService);
  private readonly ingresos = inject(IngresoMateriaPrimaService);
  private readonly maquinas = inject(MaquinaService);
  private readonly productos = inject(ProductoService);

  obtener(procesoId: number): Observable<ReporteLocal> {
    return this.procesos.obtener(procesoId).pipe(
      switchMap((proceso) =>
        this.campanas.obtener(proceso.campanaId).pipe(
          switchMap((campana) =>
            forkJoin({
              ingresos: this.ingresos.listar(procesoId),
              lista: this.cortes.listar(procesoId),
              maquinas: this.maquinas.listarPorCampana(proceso.campanaId).pipe(catchError(() => of([] as Maquina[]))),
              productos: this.productos.listar().pipe(catchError(() => of([]))),
              arrastre: this.procesos.arrastre(procesoId).pipe(
                catchError(() => of({ ingresoAnteriorJabas: 0, acumuladoAnteriorJabas: 0 })))
            }).pipe(
              map(({ ingresos, lista, maquinas, productos, arrastre }) => {
                const plantilla = productos.find((p) => p.id === campana.productoId)?.plantillaReporte
                  ?? (/vid|uva/i.test(campana.productoNombre) ? 'VID' : 'ARANDANO');
                const supervisorPorMaquina = new Map(maquinas.map((m) => [m.id, m.supervisorNombre]));
                const cortes = lista as Corte[];
                const base = {
                  estado: proceso.estado as 'ABIERTO' | 'CERRADO', plantilla, producto: campana.productoNombre,
                  anio: campana.anio ?? null, fecha: proceso.fecha,
                  version: `local:${proceso.proyeccionJabas ?? ''}:${proceso.stockAnteriorJabas ?? ''}:${proceso.stockAnteriorFecha ?? ''}:${lista.length}:${ingresos.length}:` +
                    lista.map((c) => `${c.pesoTotalEfectivo}/${c.jabasTotalEfectivo}`).join(',')
                };
                if (plantilla === 'VID') {
                  const horas = [...cortes].sort((a, b) => a.numeroCorte - b.numeroCorte)
                    .map((c) => horaVidDeCorte(c, supervisorPorMaquina));
                  const resultado = calcularVid(horas, {
                    fechaProceso: proceso.fecha,
                    ingresoDia: ingresos.reduce((a, i) => a + (Number(i.jabas) || 0), 0),
                    ingresoAnterior: Number(arrastre.ingresoAnteriorJabas) || 0,
                    acumuladoAnterior: Number(arrastre.acumuladoAnteriorJabas) || 0,
                    proyeccion: proceso.proyeccionJabas ?? null,
                    stockAnterior: proceso.stockAnteriorJabas ?? null,
                    stockAnteriorFecha: proceso.stockAnteriorFecha ?? null
                  });
                  return { ...base, datos: null, vid: { horas, resultado, advertencias: validarVid(horas, resultado) } };
                }
                const datos = construirDatosReporte(
                  { fechaProceso: proceso.fecha, productoNombre: campana.productoNombre, anio: campana.anio ?? null, supervisorPorMaquina },
                  ingresos, cortes
                );
                return { ...base, datos, vid: null };
              })
            )
          )
        )
      )
    );
  }

  /** PNG del reporte dibujado en el dispositivo (Arandano o Vid, segun el producto). */
  imagen(procesoId: number): Observable<Blob> {
    return this.obtener(procesoId).pipe(
      switchMap(async (r) => {
        if (r.plantilla === 'VID' && r.vid) {
          const slug = slugProducto(r.producto);
          const [logo, izq, der] = await Promise.all([
            cargarImagen('reporte/logo-beta-transparente.png'),
            this.foto(slug, '-izq'),
            this.foto(slug, '')
          ]);
          return renderizarReporteVidPng({
            titulo: 'AVANCE POR HORA DE SELECCIÓN ' + r.producto.toLocaleUpperCase('en-US') + (r.anio != null ? ' ' + r.anio : ''),
            fechaProceso: r.fecha, resultado: r.vid.resultado, logo, fotoIzquierda: izq ?? der, fotoDerecha: der
          });
        }
        const [logo, foto] = await Promise.all([cargarImagen('reporte/logo-beta.png'), cargarImagen('reporte/producto-arandano.png')]);
        return renderizarReportePng(r.datos!, { logo, foto });
      })
    );
  }

  /** Foto del producto ("Vid" -> producto-vid.png; si el nombre termina en "s", tambien sin ella). */
  private async foto(slug: string, sufijo: string): Promise<Imagen | null> {
    let img = await cargarImagen(`reporte/producto-${slug}${sufijo}.png`);
    if (!img && slug.endsWith('s')) img = await cargarImagen(`reporte/producto-${slug.slice(0, -1)}${sufijo}.png`);
    return img;
  }

  avance(procesoId: number): Observable<AvanceVivoResponse> {
    return this.obtener(procesoId).pipe(
      map((r) =>
        r.plantilla === 'VID'
          ? ({
              procesoDiarioId: procesoId, plantilla: 'VID', estadoProceso: r.estado, disponible: false,
              mensaje: 'La vista en linea de Vid aun no esta disponible. Use la imagen del reporte.',
              version: r.version, generadoEn: new Date().toISOString(), avance: null
            } as AvanceVivoResponse)
          : respuestaAvanceLocal(procesoId, r.estado, r.datos!, r.version)
      )
    );
  }

  /** Advertencias de consistencia de Vid (lista vacia en Arandano). */
  advertencias(procesoId: number): Observable<Advertencia[]> {
    return this.obtener(procesoId).pipe(map((r) => r.vid?.advertencias ?? []));
  }
}
