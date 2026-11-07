import { Injectable, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import { Corte, CortePlantilla, CorteRequest } from '../models/corte.model';
import { IngresoMateriaPrima, IngresoMateriaPrimaRequest } from '../models/ingreso-materia-prima.model';
import { ProcesoDiario } from '../models/proceso-diario.model';
import { offlineDb } from './offline-db';
import { EntradaCache, EscrituraPendiente } from './offline.model';
import {
  RESOLUTOR_VACIO,
  ResolutorNombres,
  aplicarEdicionLocal,
  construirCorteLocal,
  construirIngresoLocal,
  derivarPlantilla,
  ordenarPorNumero
} from './datos-locales';

const API = environment.apiUrl;
const claveCortes = (pid: number) => `${API}/procesos/${pid}/cortes`;
const claveCorte = (pid: number, cid: number) => `${API}/procesos/${pid}/cortes/${cid}`;
const clavePlantilla = (pid: number) => `${API}/procesos/${pid}/cortes/plantilla-siguiente`;
const claveMateria = (pid: number) => `${API}/procesos/${pid}/materia-prima`;

/**
 * Estado y almacenamiento de la capa sin conexion.
 *
 * Idea central (offline-first con servidor como fuente de verdad):
 *  - Cada GET exitoso se guarda en IndexedDB; sin red se responde desde ahi.
 *  - Las escrituras que no se pueden enviar se guardan en una cola (outbox) y se aplican de forma
 *    optimista sobre esa copia local, para que las pantallas las muestren de inmediato.
 *  - Al volver la red, OfflineSyncService envia la cola en orden y la respuesta real del servidor
 *    reemplaza los valores provisionales.
 */
@Injectable({ providedIn: 'root' })
export class OfflineStore {
  /** Hay red (navegador en linea y sin fallos de conexion recientes). */
  readonly enLinea = signal(typeof navigator === 'undefined' ? true : navigator.onLine);
  readonly pendientes = signal<EscrituraPendiente[]>([]);

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.enLinea.set(true));
      window.addEventListener('offline', () => this.enLinea.set(false));
    }
    void this.refrescarPendientes();
  }

  marcarSinRed(): void {
    this.enLinea.set(false);
  }

  marcarConRed(): void {
    if (!this.enLinea()) this.enLinea.set(true);
  }

  // ------------------------------------------------------------------ cache de lecturas

  async cacheGet<T>(key: string): Promise<T | undefined> {
    const e = await offlineDb.obtener<EntradaCache>('cache', key);
    return e?.cuerpo as T | undefined;
  }

  async cachePut(key: string, cuerpo: unknown): Promise<void> {
    const entrada: EntradaCache = { key, url: key, cuerpo, guardadoEn: new Date().toISOString() };
    await offlineDb.guardar('cache', entrada);
  }

  async cacheDelete(key: string): Promise<void> {
    await offlineDb.eliminar('cache', key);
  }

  // ------------------------------------------------------------------ cola

  async refrescarPendientes(): Promise<void> {
    const lista = await offlineDb.todos<EscrituraPendiente>('outbox');
    lista.sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
    this.pendientes.set(lista);
  }

  /** Hay escrituras sin enviar (de un proceso concreto, o de cualquiera si no se indica). */
  async hayPendientes(procesoId?: number | null): Promise<boolean> {
    const lista = await offlineDb.todos<EscrituraPendiente>('outbox');
    return procesoId == null ? lista.length > 0 : lista.some((p) => p.procesoId === procesoId);
  }

  private async agregarACola(item: EscrituraPendiente): Promise<void> {
    await offlineDb.guardar('outbox', item);
    await this.refrescarPendientes();
  }

  async quitarDeCola(seq: number): Promise<void> {
    await offlineDb.eliminar('outbox', seq);
    await this.refrescarPendientes();
  }

  async marcarError(item: EscrituraPendiente, mensaje: string): Promise<void> {
    await offlineDb.guardar('outbox', { ...item, error: mensaje });
    await this.refrescarPendientes();
  }

  async limpiarError(item: EscrituraPendiente): Promise<void> {
    const { error: _omitido, ...sinError } = item;
    await offlineDb.guardar('outbox', sinError);
    await this.refrescarPendientes();
  }

  private async siguienteIdTemporal(): Promise<number> {
    const actual = (await offlineDb.obtener<{ key: string; valor: number }>('meta', 'idTemporal'))?.valor ?? 0;
    const siguiente = actual - 1;
    await offlineDb.guardar('meta', { key: 'idTemporal', valor: siguiente });
    return siguiente;
  }

  // ------------------------------------------------------------------ nombres

  /** Construye un resolutor de nombres con los catalogos que el dispositivo ya descargo. */
  async resolutor(): Promise<ResolutorNombres> {
    let entradas: EntradaCache[];
    try {
      entradas = await offlineDb.todos<EntradaCache>('cache');
    } catch {
      return RESOLUTOR_VACIO;
    }
    const maquinas = new Map<number, string>();
    const variedades = new Map<number, string>();
    const katos = new Map<number, string>();
    const usuarios = new Map<number, string>();

    for (const e of entradas) {
      const ruta = e.key.split('?')[0];
      const cuerpo = e.cuerpo;
      if (!Array.isArray(cuerpo)) continue;
      if (ruta.endsWith('/maquinas')) {
        for (const m of cuerpo) {
          maquinas.set(m.id, m.nombre);
          if (m.supervisorId != null && m.supervisorNombre) usuarios.set(m.supervisorId, m.supervisorNombre);
        }
      } else if (ruta.endsWith('/variedades')) {
        for (const v of cuerpo) variedades.set(v.id, v.nombre);
      } else if (ruta.endsWith('/maquina-katos')) {
        for (const k of cuerpo) katos.set(k.id, k.nombre);
      } else if (ruta.endsWith('/usuarios')) {
        for (const u of cuerpo) usuarios.set(u.id, u.nombreCompleto);
      } else if (ruta.endsWith('/cortes')) {
        for (const c of cuerpo as Corte[]) {
          for (const d of c.detalles ?? []) {
            if (d.maquinaNombre) maquinas.set(d.maquinaId, d.maquinaNombre);
            if (d.variedadNombre) variedades.set(d.variedadId, d.variedadNombre);
            if (d.maquinaKatoId != null && d.katoNombre) katos.set(d.maquinaKatoId, d.katoNombre);
          }
          for (const s of c.supervisores ?? []) {
            if (s.supervisorId != null && s.supervisorNombre) usuarios.set(s.supervisorId, s.supervisorNombre);
          }
        }
      }
    }
    return {
      maquina: (id) => (id == null ? null : (maquinas.get(id) ?? null)),
      variedad: (id) => (id == null ? null : (variedades.get(id) ?? null)),
      kato: (id) => (id == null ? null : (katos.get(id) ?? null)),
      usuario: (id) => (id == null ? null : (usuarios.get(id) ?? null))
    };
  }

  // ------------------------------------------------------------------ lecturas locales

  /** Respuesta local para un GET (o undefined si el dispositivo no la tiene). */
  async responderGet(key: string, procesoId: number | null): Promise<unknown | undefined> {
    if (procesoId != null && key === clavePlantilla(procesoId)) {
      const cortes = await this.cacheGet<Corte[]>(claveCortes(procesoId));
      if (cortes === undefined) return undefined;
      return derivarPlantilla(procesoId, cortes) as CortePlantilla;
    }
    return this.cacheGet(key);
  }

  // ------------------------------------------------------------------ escrituras sin red

  async encolarCorteNuevo(procesoId: number, url: string, request: CorteRequest): Promise<Corte> {
    const nombres = await this.resolutor();
    const cortes = (await this.cacheGet<Corte[]>(claveCortes(procesoId))) ?? [];
    const ordenados = ordenarPorNumero(cortes);
    const numero = (ordenados.length ? ordenados[ordenados.length - 1].numeroCorte : 0) + 1;
    const previos = ordenados.length ? ordenados[ordenados.length - 1].supervisores : [];
    const idTemporal = await this.siguienteIdTemporal();

    const corte = construirCorteLocal(procesoId, idTemporal, numero, request, previos, nombres);
    await this.cachePut(claveCortes(procesoId), [...cortes, corte]);
    await this.cachePut(claveCorte(procesoId, idTemporal), corte);
    await this.cacheDelete(clavePlantilla(procesoId));
    await this.ajustarTotalCortes(procesoId, +1);

    await this.agregarACola({
      metodo: 'POST',
      url,
      cuerpo: request,
      procesoId,
      tipo: 'CORTE_CREAR',
      idTemporal,
      etiqueta: `Corte ${numero}`,
      creadoEn: new Date().toISOString()
    });
    return corte;
  }

  async encolarCorteEditado(procesoId: number, corteId: number, url: string, request: CorteRequest): Promise<Corte> {
    const nombres = await this.resolutor();
    const cortes = (await this.cacheGet<Corte[]>(claveCortes(procesoId))) ?? [];
    const existente =
      (await this.cacheGet<Corte>(claveCorte(procesoId, corteId))) ?? cortes.find((c) => c.id === corteId);
    if (!existente) {
      throw new Error('Este corte no esta disponible sin conexion. Conectate para editarlo.');
    }
    const pendientes = await offlineDb.todos<EscrituraPendiente>('outbox');
    const corte = aplicarEdicionLocal(existente, request, nombres, true);

    await this.cachePut(claveCortes(procesoId), cortes.map((c) => (c.id === corteId ? corte : c)));
    await this.cachePut(claveCorte(procesoId, corteId), corte);
    await this.cacheDelete(clavePlantilla(procesoId));

    if (corteId < 0) {
      // Corte creado sin red y aun no enviado: la edicion se funde en el envio de creacion,
      // conservando su clienteUuid original (asi el servidor lo registra una sola vez).
      const creacion = pendientes.find((p) => p.tipo === 'CORTE_CREAR' && p.idTemporal === corteId);
      if (creacion) {
        const original = creacion.cuerpo as CorteRequest;
        await this.agregarACola({ ...creacion, cuerpo: { ...request, clienteUuid: original.clienteUuid }, error: undefined });
      }
    } else {
      const previa = pendientes.find((p) => p.tipo === 'CORTE_EDITAR' && p.url === url);
      await this.agregarACola({
        ...(previa ?? {
          metodo: 'PUT' as const,
          url,
          procesoId,
          tipo: 'CORTE_EDITAR' as const,
          etiqueta: `Edicion del corte ${existente.numeroCorte}`,
          creadoEn: new Date().toISOString()
        }),
        cuerpo: request,
        error: undefined
      });
    }
    return corte;
  }

  /**
   * Elimina un corte sin conexion. La pantalla lo deja de ver al instante.
   *  - Si el corte aun no se habia enviado (id temporal negativo), basta con quitar su envio de la cola:
   *    el servidor nunca llega a conocerlo.
   *  - Si ya existe en el servidor, se encola el DELETE (con su motivo en la URL) y se descartan las
   *    ediciones pendientes de ese corte, que ya no tienen sentido.
   */
  async encolarCorteEliminado(procesoId: number, corteId: number, url: string): Promise<null> {
    const cortes = (await this.cacheGet<Corte[]>(claveCortes(procesoId))) ?? [];
    const existente = cortes.find((c) => c.id === corteId)
      ?? (await this.cacheGet<Corte>(claveCorte(procesoId, corteId)));
    const pendientes = await offlineDb.todos<EscrituraPendiente>('outbox');

    if (corteId < 0) {
      const creacion = pendientes.find((p) => p.tipo === 'CORTE_CREAR' && p.idTemporal === corteId);
      if (!creacion && !existente) {
        throw new Error('Este corte no esta disponible sin conexion. Conectate para eliminarlo.');
      }
      if (creacion?.seq !== undefined) await offlineDb.eliminar('outbox', creacion.seq);
    } else {
      if (!existente) {
        throw new Error('Este corte no esta disponible sin conexion. Conectate para eliminarlo.');
      }
      const base = url.split('?')[0];
      for (const previa of pendientes) {
        if (previa.tipo === 'CORTE_EDITAR' && previa.url.split('?')[0] === base && previa.seq !== undefined) {
          await offlineDb.eliminar('outbox', previa.seq);
        }
      }
      await this.agregarACola({
        metodo: 'DELETE',
        url,
        cuerpo: null,
        procesoId,
        tipo: 'CORTE_ELIMINAR',
        etiqueta: `Eliminar corte ${existente.numeroCorte}`,
        creadoEn: new Date().toISOString()
      });
    }

    await this.cachePut(claveCortes(procesoId), cortes.filter((c) => c.id !== corteId));
    await this.cacheDelete(claveCorte(procesoId, corteId));
    await this.cacheDelete(clavePlantilla(procesoId));
    await this.ajustarTotalCortes(procesoId, -1);
    await this.refrescarPendientes();
    return null;
  }

  async encolarMateriaPrima(
    procesoId: number,
    url: string,
    request: IngresoMateriaPrimaRequest
  ): Promise<IngresoMateriaPrima> {
    const nombres = await this.resolutor();
    const lista = (await this.cacheGet<IngresoMateriaPrima[]>(claveMateria(procesoId))) ?? [];
    const existente = lista.find((i) => i.variedadId === request.variedadId);
    const ingreso = construirIngresoLocal(existente, request, nombres);
    await this.cachePut(
      claveMateria(procesoId),
      existente ? lista.map((i) => (i.variedadId === request.variedadId ? ingreso : i)) : [...lista, ingreso]
    );

    const pendientes = await offlineDb.todos<EscrituraPendiente>('outbox');
    const previa = pendientes.find(
      (p) => p.tipo === 'MATERIA_PRIMA' && p.procesoId === procesoId &&
        (p.cuerpo as IngresoMateriaPrimaRequest).variedadId === request.variedadId
    );
    await this.agregarACola({
      ...(previa ?? {
        metodo: 'PUT' as const,
        url,
        procesoId,
        tipo: 'MATERIA_PRIMA' as const,
        etiqueta: `Materia prima: ${ingreso.variedadNombre}`,
        creadoEn: new Date().toISOString()
      }),
      cuerpo: request,
      error: undefined
    });
    return ingreso;
  }

  /**
   * La proyeccion es un "poner este valor": se refleja ya en el proceso guardado y, si habia una
   * proyeccion sin enviar, se reemplaza (solo importa la ultima).
   */
  async encolarProyeccion(procesoId: number, url: string, jabas: number | null): Promise<ProcesoDiario> {
    const actualizado = await this.parchearProceso(procesoId, (p) => ({ ...p, proyeccionJabas: jabas }));
    if (!actualizado) {
      throw new Error('Este proceso no esta disponible sin conexion. Conectate para guardar la proyeccion.');
    }
    const pendientes = await offlineDb.todos<EscrituraPendiente>('outbox');
    const previa = pendientes.find((p) => p.tipo === 'PROYECCION' && p.procesoId === procesoId);
    await this.agregarACola({
      ...(previa ?? {
        metodo: 'PUT' as const,
        url,
        procesoId,
        tipo: 'PROYECCION' as const,
        etiqueta: 'Proyeccion del dia',
        creadoEn: new Date().toISOString()
      }),
      cuerpo: { jabas },
      error: undefined
    });
    return actualizado;
  }

  /**
   * El stock anterior tambien es un "poner este valor": se refleja ya en el proceso guardado y reemplaza al
   * que estuviera sin enviar. Si no se indica fecha se usa el dia previo al proceso, igual que hace el servidor.
   */
  async encolarStockAnterior(
    procesoId: number, url: string, jabas: number | null, fecha: string | null
  ): Promise<ProcesoDiario> {
    const actualizado = await this.parchearProceso(procesoId, (p) => ({
      ...p,
      stockAnteriorJabas: jabas,
      stockAnteriorFecha: jabas === null ? null : (fecha ?? diaAnterior(p.fecha))
    }));
    if (!actualizado) {
      throw new Error('Este proceso no esta disponible sin conexion. Conectate para guardar el stock anterior.');
    }
    const pendientes = await offlineDb.todos<EscrituraPendiente>('outbox');
    const previa = pendientes.find((p) => p.tipo === 'STOCK_ANTERIOR' && p.procesoId === procesoId);
    await this.agregarACola({
      ...(previa ?? {
        metodo: 'PUT' as const,
        url,
        procesoId,
        tipo: 'STOCK_ANTERIOR' as const,
        etiqueta: 'Stock anterior',
        creadoEn: new Date().toISOString()
      }),
      cuerpo: { jabas, fecha },
      error: undefined
    });
    return actualizado;
  }

  async encolarCambioEstado(procesoId: number, url: string, cerrar: boolean): Promise<ProcesoDiario> {
    const actualizado = await this.parchearProceso(procesoId, (p) => ({
      ...p,
      estado: cerrar ? ('CERRADO' as const) : ('ABIERTO' as const)
    }));
    if (!actualizado) {
      throw new Error('Este proceso no esta disponible sin conexion. Conectate para cambiar su estado.');
    }

    const pendientes = await offlineDb.todos<EscrituraPendiente>('outbox');
    const contraria = pendientes.find(
      (p) => p.procesoId === procesoId && p.tipo === (cerrar ? 'PROCESO_REABRIR' : 'PROCESO_CERRAR')
    );
    if (contraria?.seq !== undefined) {
      // Cerrar y reabrir sin haberse enviado ninguno se anulan entre si.
      await this.quitarDeCola(contraria.seq);
    } else {
      await this.agregarACola({
        metodo: 'POST',
        url,
        cuerpo: {},
        procesoId,
        tipo: cerrar ? 'PROCESO_CERRAR' : 'PROCESO_REABRIR',
        etiqueta: cerrar ? 'Cierre del proceso' : 'Reapertura del proceso',
        creadoEn: new Date().toISOString()
      });
    }
    return actualizado;
  }

  private async ajustarTotalCortes(procesoId: number, delta: number): Promise<void> {
    await this.parchearProceso(procesoId, (p) => ({ ...p, totalCortes: Math.max(0, p.totalCortes + delta) }));
  }

  /**
   * El proceso puede estar guardado bajo varias lecturas (por id, por campana+fecha, en la lista del
   * historial). Se actualizan todas para que cualquier pantalla vea el mismo estado.
   * @returns el proceso ya modificado (o null si el dispositivo no lo conoce).
   */
  private async parchearProceso(
    procesoId: number,
    cambio: (p: ProcesoDiario) => ProcesoDiario
  ): Promise<ProcesoDiario | null> {
    const esProceso = (x: unknown): x is ProcesoDiario =>
      !!x && typeof x === 'object' && (x as ProcesoDiario).id === procesoId &&
      'estado' in (x as object) && 'campanaId' in (x as object);

    let resultado: ProcesoDiario | null = null;
    const entradas = await offlineDb.todos<EntradaCache>('cache');
    for (const e of entradas) {
      if (!e.key.includes('/procesos')) continue;
      if (esProceso(e.cuerpo)) {
        const nuevo = cambio(e.cuerpo);
        resultado = nuevo;
        await this.cachePut(e.key, nuevo);
      } else if (Array.isArray(e.cuerpo) && e.cuerpo.some(esProceso)) {
        await this.cachePut(e.key, e.cuerpo.map((x) => (esProceso(x) ? (resultado = cambio(x)) : x)));
      }
    }
    return resultado;
  }

  // ------------------------------------------------------------------ tras sincronizar

  /** El servidor confirmo una escritura: su respuesta reemplaza el valor provisional del cache. */
  async aplicarResultado(item: EscrituraPendiente, respuesta: unknown): Promise<void> {
    const pid = item.procesoId;
    if (pid == null) return;

    if (item.tipo === 'CORTE_CREAR' && item.idTemporal !== undefined && respuesta) {
      const real = respuesta as Corte;
      const cortes = (await this.cacheGet<Corte[]>(claveCortes(pid))) ?? [];
      await this.cachePut(claveCortes(pid), cortes.map((c) => (c.id === item.idTemporal ? real : c)));
      await this.cacheDelete(claveCorte(pid, item.idTemporal));
      await this.cachePut(claveCorte(pid, real.id), real);
    } else if (item.tipo === 'CORTE_EDITAR' && respuesta) {
      const real = respuesta as Corte;
      const cortes = (await this.cacheGet<Corte[]>(claveCortes(pid))) ?? [];
      await this.cachePut(claveCortes(pid), cortes.map((c) => (c.id === real.id ? real : c)));
      await this.cachePut(claveCorte(pid, real.id), real);
    } else if ((item.tipo === 'PROCESO_CERRAR' || item.tipo === 'PROCESO_REABRIR' || item.tipo === 'PROYECCION' || item.tipo === 'STOCK_ANTERIOR') && respuesta) {
      const real = respuesta as ProcesoDiario;
      await this.parchearProceso(pid, () => real);
    }
    await this.cacheDelete(clavePlantilla(pid));
  }
}

/** "2026-11-04" -> "2026-11-03" (en UTC, para no depender de la zona horaria del dispositivo). */
function diaAnterior(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}
