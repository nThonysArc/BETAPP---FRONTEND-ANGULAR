import { HttpContextToken, HttpErrorResponse } from '@angular/common/http';
import { TimeoutError } from 'rxjs';

/** Marca una peticion para que NO pase por la capa sin conexion (la usa el motor de sincronizacion). */
export const SALTAR_OFFLINE = new HttpContextToken<boolean>(() => false);

/**
 * Error de conexion: sin respuesta del servidor (status 0), respuesta que no llego a tiempo, o 502/503/504.
 *
 * Los 502/503/504 importan por dos motivos: el service worker de Angular responde 504 "Gateway Timeout"
 * cuando no hay red (en vez de dejar fallar la peticion), y Railway responde 502/503 si el backend
 * esta reiniciando. En ambos casos lo correcto es lo mismo que sin internet: guardar y reintentar.
 */
export const esFalloDeRed = (e: unknown): boolean =>
  e instanceof TimeoutError ||
  (e instanceof HttpErrorResponse && (e.status === 0 || e.status === 502 || e.status === 503 || e.status === 504));
