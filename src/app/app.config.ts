import { ApplicationConfig, isDevMode, provideZoneChangeDetection } from '@angular/core';
import { provideServiceWorker } from '@angular/service-worker';
import { provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MAT_DIALOG_DEFAULT_OPTIONS } from '@angular/material/dialog';

import { routes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import { offlineInterceptor } from './core/offline/offline.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideAnimationsAsync(),
    provideHttpClient(withInterceptors([offlineInterceptor, authInterceptor])),
    provideNativeDateAdapter(),
    // Service worker: guarda la app en el dispositivo para abrirla sin red (solo en produccion).
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:15000'
    }),
    // Los diálogos piden un ancho fijo (480 px, 560 px…); en celular se limitan
    // al ancho de la pantalla menos un margen para que nunca se salgan.
    {
      provide: MAT_DIALOG_DEFAULT_OPTIONS,
      useValue: { maxWidth: 'calc(100vw - 16px)', maxHeight: 'calc(100dvh - 16px)' }
    }
  ]
};
