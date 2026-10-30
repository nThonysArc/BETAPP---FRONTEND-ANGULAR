/**
 * Almacen local minimo sobre IndexedDB (sin dependencias).
 *
 * Por que IndexedDB y no localStorage: localStorage es sincrono, limitado a ~5 MB y solo guarda
 * texto; IndexedDB es asincrono, guarda objetos y sobrevive a cierres del navegador. Es el
 * lugar correcto para datos que NO pueden perderse (la cola de cortes pendientes de envio).
 *
 * Almacenes:
 *  - cache : respuestas GET del backend, para poder abrir pantallas sin red.
 *  - outbox: escrituras (crear/editar corte, materia prima, cerrar) pendientes de enviar.
 *  - meta  : contadores (id temporal negativo para cortes creados sin red).
 */
const NOMBRE_DB = 'betaapp-offline';
const VERSION_DB = 1;

export type Almacen = 'cache' | 'outbox' | 'meta';

let conexion: Promise<IDBDatabase> | null = null;

function abrir(): Promise<IDBDatabase> {
  if (conexion) return conexion;
  conexion = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(NOMBRE_DB, VERSION_DB);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('cache')) db.createObjectStore('cache', { keyPath: 'key' });
      if (!db.objectStoreNames.contains('outbox')) db.createObjectStore('outbox', { keyPath: 'seq', autoIncrement: true });
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      conexion = null;
      reject(req.error);
    };
  });
  return conexion;
}

function envolver<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx(almacen: Almacen, modo: IDBTransactionMode): Promise<IDBObjectStore> {
  const db = await abrir();
  return db.transaction(almacen, modo).objectStore(almacen);
}

export const offlineDb = {
  async obtener<T>(almacen: Almacen, clave: IDBValidKey): Promise<T | undefined> {
    return envolver((await tx(almacen, 'readonly')).get(clave)) as Promise<T | undefined>;
  },

  async todos<T>(almacen: Almacen): Promise<T[]> {
    return envolver((await tx(almacen, 'readonly')).getAll()) as Promise<T[]>;
  },

  async contar(almacen: Almacen): Promise<number> {
    return envolver((await tx(almacen, 'readonly')).count());
  },

  /** Inserta o reemplaza. Devuelve la clave (en outbox, el numero de secuencia asignado). */
  async guardar(almacen: Almacen, valor: unknown): Promise<IDBValidKey> {
    return envolver((await tx(almacen, 'readwrite')).put(valor));
  },

  async eliminar(almacen: Almacen, clave: IDBValidKey): Promise<void> {
    await envolver((await tx(almacen, 'readwrite')).delete(clave));
  },

  async vaciar(almacen: Almacen): Promise<void> {
    await envolver((await tx(almacen, 'readwrite')).clear());
  }
};
