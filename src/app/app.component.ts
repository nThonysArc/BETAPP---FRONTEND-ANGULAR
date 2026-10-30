import { Component, HostListener, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { OfflineBannerComponent } from './core/offline/offline-banner.component';
import { AuthService } from './core/auth/auth.service';
import { OfflineSyncService } from './core/offline/offline-sync.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, OfflineBannerComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  // Se instancia al arrancar para que el motor de sincronizacion empiece a vigilar la cola.
  private readonly sync = inject(OfflineSyncService);
  private readonly auth = inject(AuthService);

  /**
   * Evita recargar o cerrar la pagina por accidente (pull-to-refresh, F5, cerrar pestana) mientras
   * hay una sesion o envios pendientes. El navegador muestra su propio aviso: su texto no se puede
   * personalizar (regla de seguridad de los navegadores), pero si pide confirmacion.
   */
  @HostListener('window:beforeunload', ['$event'])
  confirmarRecarga(event: BeforeUnloadEvent): void {
    if (!this.auth.estaAutenticado()) return;
    event.preventDefault();
    event.returnValue = '';
  }
}
