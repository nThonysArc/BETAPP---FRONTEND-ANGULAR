import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { OfflineBannerComponent } from './core/offline/offline-banner.component';
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
}
