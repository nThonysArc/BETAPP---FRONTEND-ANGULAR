import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { Corte, CortePlantilla, CorteRequest } from '../models/corte.model';
import { offlineDb } from './offline-db';
import { offlineInterceptor } from './offline.interceptor';
import { OfflineStore } from './offline-store.service';
import { OfflineSyncService } from './offline-sync.service';

const API = environment.apiUrl;
const PID = 77;
const sinRed = () => new ProgressEvent('error');

const peticion = (uuid: string, jabas: number): CorteRequest => ({
  clienteUuid: uuid, horaInicio: '07:00', horaFin: '08:00',
  detalles: [{
    clienteUuid: null, maquinaId: 1, maquinaNombre: null, maquinaKatoId: 5, katoNombre: null,
    variedadId: 9, variedadNombre: null, jabas, pesoTotal: jabas * 10, empacadores: 4, kgPorEmpacador: 0, orden: 0
  }]
});

/**
 * Pruebas de integracion con IndexedDB real del navegador: el interceptor, el almacen local y el motor
 * de sincronizacion trabajando juntos, con la red simulada.
 */
describe('capa sin conexion', () => {
  let http: HttpClient;
  let controlador: HttpTestingController;
  let store: OfflineStore;
  let sync: OfflineSyncService;

  beforeEach(async () => {
    await offlineDb.vaciar('cache');
    await offlineDb.vaciar('outbox');
    await offlineDb.vaciar('meta');
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([offlineInterceptor])), provideHttpClientTesting()]
    });
    http = TestBed.inject(HttpClient);
    controlador = TestBed.inject(HttpTestingController);
    store = TestBed.inject(OfflineStore);
    sync = TestBed.inject(OfflineSyncService);
    store.enLinea.set(true);
  });

  /** Espera a que el interceptor (asincrono por IndexedDB) lance la peticion y la devuelve. */
  async function siguiente(url: string) {
    for (let i = 0; i < 100; i++) {
      const hallados = controlador.match((r) => r.url === url || r.urlWithParams === url);
      if (hallados.length) return hallados[0];
      await new Promise((r) => setTimeout(r, 10));
    }
    throw new Error('No se envio la peticion a ' + url);
  }

  it('guarda las lecturas y las sirve sin red', async () => {
    const lista = [{ id: 1, numeroCorte: 1, detalles: [], supervisores: [], horaFin: '08:00:00' }];
    const p1 = new Promise((ok) => http.get(`${API}/procesos/${PID}/cortes`).subscribe(ok));
    (await siguiente(`${API}/procesos/${PID}/cortes`)).flush(lista);
    await p1;

    const p2 = new Promise<unknown>((ok) => http.get(`${API}/procesos/${PID}/cortes`).subscribe(ok));
    (await siguiente(`${API}/procesos/${PID}/cortes`)).error(sinRed());
    expect(await p2).toEqual(lista);
  });

  it('un corte guardado sin red se muestra al instante y la plantilla siguiente lo considera', async () => {
    const pCortes = new Promise((ok) => http.get(`${API}/procesos/${PID}/cortes`).subscribe(ok));
    (await siguiente(`${API}/procesos/${PID}/cortes`)).flush([]);
    await pCortes;

    store.enLinea.set(false);
    const creado = await new Promise<Corte>((ok) =>
      http.post<Corte>(`${API}/procesos/${PID}/cortes`, peticion('u-1', 3)).subscribe(ok));
    expect(creado.numeroCorte).toBe(1);
    expect(creado.id).toBeLessThan(0);
    expect(creado.pendienteSync).toBeTrue();
    expect(creado.jabasTotalEfectivo).toBe(3);

    const lista = await new Promise<Corte[]>((ok) => http.get<Corte[]>(`${API}/procesos/${PID}/cortes`).subscribe(ok));
    expect(lista.map((c) => c.numeroCorte)).toEqual([1]);

    const plantilla = await new Promise<CortePlantilla>((ok) =>
      http.get<CortePlantilla>(`${API}/procesos/${PID}/cortes/plantilla-siguiente`).subscribe(ok));
    expect(plantilla.numeroCorteSugerido).toBe(2);
    expect(plantilla.horaInicio).toBe('08:00:00');

    const segundo = await new Promise<Corte>((ok) =>
      http.post<Corte>(`${API}/procesos/${PID}/cortes`, peticion('u-2', 4)).subscribe(ok));
    expect(segundo.numeroCorte).toBe(2);
    expect(store.pendientes().length).toBe(2);
  });

  it('si la red falla al enviar, el corte se encola en vez de perderse', async () => {
    const resultado = new Promise<Corte>((ok) =>
      http.post<Corte>(`${API}/procesos/${PID}/cortes`, peticion('u-3', 2)).subscribe(ok));
    (await siguiente(`${API}/procesos/${PID}/cortes`)).error(sinRed());
    const c = await resultado;
    expect(c.pendienteSync).toBeTrue();
    expect(store.pendientes().length).toBe(1);
  });

  it('un 504 (asi responde el service worker sin red) se trata como falta de conexion y se encola', async () => {
    const resultado = new Promise<Corte>((ok) =>
      http.post<Corte>(`${API}/procesos/${PID}/cortes`, peticion('u-504', 2)).subscribe(ok));
    (await siguiente(`${API}/procesos/${PID}/cortes`)).flush('', { status: 504, statusText: 'Gateway Timeout' });
    expect((await resultado).pendienteSync).toBeTrue();
    expect(store.pendientes().length).toBe(1);
  });

  it('un error de validacion del servidor (red OK) se muestra al usuario y NO se encola', async () => {
    const resultado = new Promise<number>((ok) =>
      http.post(`${API}/procesos/${PID}/cortes`, peticion('u-4', 2)).subscribe({ error: (e) => ok(e.status) }));
    (await siguiente(`${API}/procesos/${PID}/cortes`)).flush({ message: 'cerrado' }, { status: 400, statusText: 'Bad Request' });
    expect(await resultado).toBe(400);
    expect(store.pendientes().length).toBe(0);
  });

  it('editar un corte aun no enviado se funde en su creacion y conserva el mismo clienteUuid', async () => {
    store.enLinea.set(false);
    const creado = await new Promise<Corte>((ok) =>
      http.post<Corte>(`${API}/procesos/${PID}/cortes`, peticion('u-orig', 3)).subscribe(ok));
    await new Promise((ok) =>
      http.put(`${API}/procesos/${PID}/cortes/${creado.id}`, peticion('u-otro', 8)).subscribe(ok));

    expect(store.pendientes().length).toBe(1);
    const enviado = store.pendientes()[0].cuerpo as CorteRequest;
    expect(enviado.clienteUuid).toBe('u-orig');
    expect(enviado.detalles[0].jabas).toBe(8);
  });

  it('al volver la red envia la cola EN ORDEN y la respuesta del servidor reemplaza lo provisional', async () => {
    store.enLinea.set(false);
    await new Promise((ok) => http.post(`${API}/procesos/${PID}/cortes`, peticion('a', 1)).subscribe(ok));
    await new Promise((ok) => http.post(`${API}/procesos/${PID}/cortes`, peticion('b', 2)).subscribe(ok));
    store.enLinea.set(true);

    const fin = sync.sincronizar();
    const r1 = await siguiente(`${API}/procesos/${PID}/cortes`);
    expect((r1.request.body as CorteRequest).clienteUuid).toBe('a');
    r1.flush({ ...peticion('a', 1), id: 501, numeroCorte: 1, detalles: [], supervisores: [], horaFin: '08:00:00' });

    const r2 = await siguiente(`${API}/procesos/${PID}/cortes`);
    expect((r2.request.body as CorteRequest).clienteUuid).toBe('b');
    r2.flush({ ...peticion('b', 2), id: 502, numeroCorte: 2, detalles: [], supervisores: [], horaFin: '09:00:00' });
    await fin;

    expect(store.pendientes().length).toBe(0);
    const enCache = await store.cacheGet<Corte[]>(`${API}/procesos/${PID}/cortes`);
    expect(enCache!.map((c) => c.id)).toEqual([501, 502]);
  });

  it('sin red durante el envio, la cola se conserva intacta', async () => {
    store.enLinea.set(false);
    await new Promise((ok) => http.post(`${API}/procesos/${PID}/cortes`, peticion('z', 1)).subscribe(ok));
    store.enLinea.set(true);
    const fin = sync.sincronizar();
    (await siguiente(`${API}/procesos/${PID}/cortes`)).error(sinRed());
    await fin;
    expect(store.pendientes().length).toBe(1);
    expect(store.pendientes()[0].error).toBeUndefined();
  });

  it('un rechazo de negocio detiene la cola y la marca con el mensaje, sin descartarla', async () => {
    store.enLinea.set(false);
    await new Promise((ok) => http.post(`${API}/procesos/${PID}/cortes`, peticion('y', 1)).subscribe(ok));
    store.enLinea.set(true);
    const fin = sync.sincronizar();
    (await siguiente(`${API}/procesos/${PID}/cortes`)).flush(
      { message: 'Este proceso diario ya esta cerrado.' }, { status: 400, statusText: 'Bad Request' });
    await fin;
    expect(store.pendientes().length).toBe(1);
    expect(store.pendientes()[0].error).toContain('cerrado');
  });
});
