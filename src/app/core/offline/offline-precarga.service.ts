import { Injectable, inject } from '@angular/core';
import { Observable, catchError, forkJoin, of, switchMap } from 'rxjs';
import { CampanaService } from '../services/campana.service';
import { CorteService } from '../services/corte.service';
import { IngresoMateriaPrimaService } from '../services/ingreso-materia-prima.service';
import { MaquinaKatoService } from '../services/maquina-kato.service';
import { MaquinaService } from '../services/maquina.service';
import { ProcesoDiarioService } from '../services/proceso-diario.service';
import { ProductoService } from '../services/producto.service';
import { UsuarioService } from '../services/usuario.service';
import { VariedadService } from '../services/variedad.service';
import { OfflineStore } from './offline-store.service';

/**
 * Descarga, mientras hay red, TODO lo que el operador necesita para trabajar el dia sin conexion:
 * catalogos (maquinas, katos, variedades, supervisores, productos), el proceso, sus cortes y la
 * plantilla del siguiente corte.
 *
 * Por que hace falta: el interceptor solo guarda lo que la persona ya abrio. Si nunca abrio el
 * formulario de corte con red, al cortarse el internet no tendria con que llenarlo. Precargar
 * invierte el orden: primero se asegura el material, despues se puede perder la conexion.
 *
 * Usa los mismos servicios (y los mismos argumentos) que las pantallas, asi las lecturas quedan
 * guardadas bajo exactamente la misma clave que despues se consulta.
 */
@Injectable({ providedIn: 'root' })
export class OfflinePrecargaService {
  private readonly store = inject(OfflineStore);
  private readonly procesos = inject(ProcesoDiarioService);
  private readonly campanas = inject(CampanaService);
  private readonly cortes = inject(CorteService);
  private readonly ingresos = inject(IngresoMateriaPrimaService);
  private readonly maquinas = inject(MaquinaService);
  private readonly katos = inject(MaquinaKatoService);
  private readonly variedades = inject(VariedadService);
  private readonly usuarios = inject(UsuarioService);
  private readonly productos = inject(ProductoService);

  private enCurso = new Set<number>();

  /** Silencioso: si algo falla (sin permiso, sin red) simplemente no se guarda esa parte. */
  precargar(procesoId: number): void {
    if (!this.store.enLinea() || this.enCurso.has(procesoId)) return;
    this.enCurso.add(procesoId);

    const ok = <T>(o: Observable<T>) => o.pipe(catchError(() => of(null)));

    this.procesos.obtener(procesoId).pipe(
      switchMap((proceso) =>
        this.campanas.obtener(proceso.campanaId).pipe(
          switchMap((campana) =>
            forkJoin({
              productos: ok(this.productos.listar()),
              variedades: ok(this.variedades.listarPorProducto(campana.productoId)),
              supervisores: ok(this.usuarios.listarSupervisores()),
              ingresos: ok(this.ingresos.listar(procesoId)),
              plantilla: ok(this.cortes.obtenerPlantillaSiguiente(procesoId)),
              lista: ok(this.cortes.listar(procesoId)),
              maquinas: ok(this.maquinas.listarPorCampana(proceso.campanaId))
            })
          )
        )
      ),
      switchMap((r) => {
        const tareas: Observable<unknown>[] = [];
        for (const m of r.maquinas ?? []) tareas.push(ok(this.katos.listarPorMaquina(m.id, true)));
        for (const c of r.lista ?? []) tareas.push(ok(this.cortes.obtener(procesoId, c.id)));
        return tareas.length ? forkJoin(tareas) : of([]);
      }),
      catchError(() => of(null))
    ).subscribe({ complete: () => this.enCurso.delete(procesoId) });
  }
}
