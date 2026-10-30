import { HttpErrorResponse, HttpEvent, HttpInterceptorFn, HttpRequest, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, catchError, from, of, switchMap, tap, throwError, timeout } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CorteRequest } from '../models/corte.model';
import { IngresoMateriaPrimaRequest } from '../models/ingreso-materia-prima.model';
import { SALTAR_OFFLINE, esFalloDeRed } from './offline.context';
import { OfflineStore } from './offline-store.service';
import { OfflineSyncService } from './offline-sync.service';

/** Sin respuesta en este tiempo se asume que no hay red util ("lie-fi": senal que no transmite). */
const ESPERA_LECTURA_MS = 8000;
const ESPERA_ESCRITURA_MS = 15000;

const NO_CACHEABLE = /\/(reporte-imagen|avance|auth\/|advertencias)/;
const RUTA_PROCESO = /\/procesos\/(\d+)(?:\/(?:cortes(?:\/.*)?|materia-prima))?$/;

function procesoDe(url: string): number | null {
  const m = url.split('?')[0].match(RUTA_PROCESO);
  return m ? Number(m[1]) : null;
}

type Escritura =
  | { tipo: 'CORTE_CREAR'; procesoId: number }
  | { tipo: 'CORTE_EDITAR'; procesoId: number; corteId: number }
  | { tipo: 'MATERIA_PRIMA'; procesoId: number }
  | { tipo: 'PROCESO_CERRAR' | 'PROCESO_REABRIR'; procesoId: number };

function clasificar(req: HttpRequest<unknown>): Escritura | null {
  const url = req.url.split('?')[0];
  let m: RegExpMatchArray | null;
  if (req.method === 'POST' && (m = url.match(/\/procesos\/(\d+)\/cortes$/))) {
    return { tipo: 'CORTE_CREAR', procesoId: Number(m[1]) };
  }
  if (req.method === 'PUT' && (m = url.match(/\/procesos\/(\d+)\/cortes\/(-?\d+)$/))) {
    return { tipo: 'CORTE_EDITAR', procesoId: Number(m[1]), corteId: Number(m[2]) };
  }
  if (req.method === 'PUT' && (m = url.match(/\/procesos\/(\d+)\/materia-prima$/))) {
    return { tipo: 'MATERIA_PRIMA', procesoId: Number(m[1]) };
  }
  if (req.method === 'POST' && (m = url.match(/\/procesos\/(\d+)\/cerrar$/))) {
    return { tipo: 'PROCESO_CERRAR', procesoId: Number(m[1]) };
  }
  if (req.method === 'POST' && (m = url.match(/\/procesos\/(\d+)\/reabrir$/))) {
    return { tipo: 'PROCESO_REABRIR', procesoId: Number(m[1]) };
  }
  return null;
}

function respuesta<T>(req: HttpRequest<unknown>, cuerpo: T, status = 200): Observable<HttpEvent<T>> {
  return of(new HttpResponse<T>({ body: cuerpo, status, url: req.url }));
}

/**
 * Capa sin conexion (offline-first).
 *
 *  - Lecturas: red primero; si falla, se responde con la copia guardada en el dispositivo.
 *    Si hay envios pendientes del proceso, se lee SIEMPRE la copia local (el servidor aun no los conoce).
 *  - Escrituras (cortes, materia prima, cerrar/reabrir): si hay red y la cola esta vacia, se envian tal cual
 *    (el usuario ve los errores del servidor al instante). Si no hay red, o ya hay cola, se encolan y se
 *    responde de forma optimista para que la pantalla continue sin enterarse.
 *
 * Es seguro reintentar porque el corte lleva clienteUuid (el servidor no lo duplica) y el resto de
 * escrituras son "poner este valor" (repetirlas deja el mismo resultado).
 */
export const offlineInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.context.get(SALTAR_OFFLINE) || !req.url.startsWith(environment.apiUrl)) {
    return next(req);
  }
  const store = inject(OfflineStore);
  const sync = inject(OfflineSyncService);

  // ------------------------------------------------------------------ lecturas
  if (req.method === 'GET') {
    if (NO_CACHEABLE.test(req.url) || req.responseType !== 'json') return next(req);

    const key = req.urlWithParams;
    const procesoId = procesoDe(req.url);

    const local$ = (): Observable<HttpEvent<unknown>> =>
      from(store.responderGet(key, procesoId)).pipe(
        switchMap((cuerpo) => (cuerpo === undefined ? EMPTY_SIN_COPIA : respuesta(req, cuerpo)))
      );

    const red$ = next(req).pipe(
      timeout({ first: ESPERA_LECTURA_MS }),
      tap((evt) => {
        if (evt instanceof HttpResponse) {
          store.marcarConRed();
          if (evt.status === 200) void store.cachePut(key, evt.body);
        }
      }),
      catchError((err) => {
        if (!esFalloDeRed(err)) return throwError(() => err);
        store.marcarSinRed();
        return local$().pipe(
          catchError((e) => (e === SIN_COPIA ? throwError(() => err) : throwError(() => e)))
        );
      })
    );

    return from(procesoId != null ? store.hayPendientes(procesoId) : Promise.resolve(false)).pipe(
      switchMap((hayPendientes) =>
        hayPendientes
          ? local$().pipe(catchError((e) => (e === SIN_COPIA ? red$ : throwError(() => e))))
          : red$
      )
    );
  }

  // ------------------------------------------------------------------ escrituras
  const escritura = clasificar(req);
  if (!escritura) return next(req);

  const encolar$ = (): Observable<HttpEvent<unknown>> =>
    from(encolar(store, escritura, req)).pipe(
      tap(() => sync.programar()),
      switchMap((cuerpo) => respuesta(req, cuerpo, req.method === 'POST' ? 201 : 200)),
      catchError((e) => throwError(() => new HttpErrorResponse({
        status: 409,
        error: { message: e instanceof Error ? e.message : 'No se pudo guardar sin conexion' }
      })))
    );

  return from(store.hayPendientes()).pipe(
    switchMap((hayCola) => {
      if (hayCola || !store.enLinea()) return encolar$();
      return next(req).pipe(
        timeout({ first: ESPERA_ESCRITURA_MS }),
        tap((evt) => {
          if (evt instanceof HttpResponse) store.marcarConRed();
        }),
        catchError((err) => {
          if (!esFalloDeRed(err)) return throwError(() => err);
          store.marcarSinRed();
          return encolar$();
        })
      );
    })
  );
};

async function encolar(store: OfflineStore, e: Escritura, req: HttpRequest<unknown>): Promise<unknown> {
  switch (e.tipo) {
    case 'CORTE_CREAR':
      return store.encolarCorteNuevo(e.procesoId, req.url, req.body as CorteRequest);
    case 'CORTE_EDITAR':
      return store.encolarCorteEditado(e.procesoId, e.corteId, req.url, req.body as CorteRequest);
    case 'MATERIA_PRIMA':
      return store.encolarMateriaPrima(e.procesoId, req.url, req.body as IngresoMateriaPrimaRequest);
    case 'PROCESO_CERRAR':
      return store.encolarCambioEstado(e.procesoId, req.url, true);
    case 'PROCESO_REABRIR':
      return store.encolarCambioEstado(e.procesoId, req.url, false);
  }
}

/** Marca interna: el dispositivo no tiene copia de esa lectura. */
const SIN_COPIA = Symbol('sin-copia');
const EMPTY_SIN_COPIA: Observable<never> = throwError(() => SIN_COPIA);
