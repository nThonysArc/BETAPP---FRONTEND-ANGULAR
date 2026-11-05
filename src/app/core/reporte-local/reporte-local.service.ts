import { Injectable, inject } from '@angular/core';
import { Observable, catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { AvanceVivoResponse } from '../models/avance-vivo.model';
import { Corte } from '../models/corte.model';
import { CampanaService } from '../services/campana.service';
import { CorteService } from '../services/corte.service';
import { IngresoMateriaPrimaService } from '../services/ingreso-materia-prima.service';
import { MaquinaService } from '../services/maquina.service';
import { ProcesoDiarioService } from '../services/proceso-diario.service';
import { ProductoService } from '../services/producto.service';
import { respuestaAvanceLocal } from './avance-vivo-local';
import { ReporteDatos, construirDatosReporte } from './reporte-datos';
import { Imagen, cargarImagen, renderizarReportePng } from './reporte-canvas';

export interface ReporteLocal {
  datos: ReporteDatos;
  estado: 'ABIERTO' | 'CERRADO';
  plantilla: 'ARANDANO' | 'VID';
  producto: string;
  anio: number | null;
  fecha: string;
  version: string;
}

/**
 * Arma el reporte (PNG y avance en vivo) en el dispositivo, con lo que haya guardado.
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

  private recursos: Promise<{ logo: Imagen | null; foto: Imagen | null }> | null = null;

  obtener(procesoId: number): Observable<ReporteLocal> {
    return this.procesos.obtener(procesoId).pipe(
      switchMap((proceso) =>
        this.campanas.obtener(proceso.campanaId).pipe(
          switchMap((campana) =>
            forkJoin({
              ingresos: this.ingresos.listar(procesoId),
              lista: this.cortes.listar(procesoId),
              maquinas: this.maquinas.listarPorCampana(proceso.campanaId).pipe(catchError(() => of([]))),
              productos: this.productos.listar().pipe(catchError(() => of([])))
            }).pipe(
              map(({ ingresos, lista, maquinas, productos }) => {
                const plantilla = productos.find((p) => p.id === campana.productoId)?.plantillaReporte
                  ?? (/vid/i.test(campana.productoNombre) ? 'VID' : 'ARANDANO');
                const datos = construirDatosReporte(
                  {
                    fechaProceso: proceso.fecha,
                    productoNombre: campana.productoNombre,
                    anio: campana.anio ?? null,
                    supervisorPorMaquina: new Map(maquinas.map((m) => [m.id, m.supervisorNombre]))
                  },
                  ingresos, lista as Corte[]
                );
                return {
                  datos, estado: proceso.estado as 'ABIERTO' | 'CERRADO', plantilla,
                  producto: campana.productoNombre, anio: campana.anio ?? null, fecha: proceso.fecha,
                  version: `local:${lista.length}:${ingresos.length}:${lista.map((c) => c.pesoTotalEfectivo).join(',')}`
                };
              })
            )
          )
        )
      )
    );
  }

  /** PNG del reporte dibujado en el dispositivo. Solo plantilla Arandano por ahora. */
  imagen(procesoId: number): Observable<Blob> {
    return this.obtener(procesoId).pipe(
      switchMap(async (r) => {
        if (r.plantilla === 'VID') {
          throw new Error('El reporte de Vid todavia no se puede generar sin conexion.');
        }
        const rec = await this.cargarRecursos();
        return renderizarReportePng(r.datos, rec);
      })
    );
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
          : respuestaAvanceLocal(procesoId, r.estado, r.datos, r.version)
      )
    );
  }

  private cargarRecursos() {
    this.recursos ??= Promise.all([
      cargarImagen('reporte/logo-beta.png').catch(() => null),
      cargarImagen('reporte/producto-arandano.png').catch(() => null)
    ]).then(([logo, foto]) => ({ logo, foto }));
    this.recursos.catch(() => (this.recursos = null));
    return this.recursos;
  }
}
