import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { ReporteService } from '../../core/services/reporte.service';
import { CorteService } from '../../core/services/corte.service';
import { numerosDeHora } from '../../core/utils/horas-corte.util';
import { construirMensajeReporte } from '../../core/utils/mensaje-reporte.util';
import { LoadingSpinnerComponent } from '../loading-spinner/loading-spinner.component';

export interface ReporteCompartirData {
  procesoDiarioId: number;
  /** Fecha del proceso 'YYYY-MM-DD' (solo para nombrar el archivo). */
  fecha?: string;
}

/**
 * Muestra la imagen del reporte DENTRO del sistema (sin abrir otra pestana) y permite compartirla.
 *
 * - "Compartir": menu nativo del celular (Web Share API) con la imagen ADJUNTA y el mensaje; ahi se
 *   elige WhatsApp. Es la unica forma web de adjuntar la imagen automaticamente.
 * - "WhatsApp": abre WhatsApp con el mensaje escrito (WhatsApp no permite adjuntar archivos por enlace);
 *   se usa en computador, junto con "Copiar imagen" para pegarla en la conversacion.
 * - "Descargar": guarda el PNG.
 */
@Component({
  selector: 'app-reporte-compartir-dialog',
  standalone: true,
  imports: [
    FormsModule, MatDialogModule, MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule,
    MatSnackBarModule, LoadingSpinnerComponent
  ],
  template: `
    <h2 mat-dialog-title>Reporte de avance</h2>
    <mat-dialog-content class="contenido">
      @if (cargando()) {
        <app-loading-spinner mensaje="Generando imagen..." />
      } @else if (error()) {
        <p class="error">{{ error() }}</p>
      } @else {
        <img [src]="urlImagen()" alt="Imagen del reporte de avance" class="imagen" />

        <mat-form-field appearance="outline" class="mensaje">
          <mat-label>Mensaje</mat-label>
          <textarea matInput rows="3" [(ngModel)]="mensaje"></textarea>
        </mat-form-field>
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end" class="acciones">
      <button mat-button (click)="dialogRef.close()">Cerrar</button>
      @if (!cargando() && !error()) {
        <button mat-stroked-button (click)="descargar()">
          <mat-icon>download</mat-icon> Descargar
        </button>
        @if (puedeCopiarImagen) {
          <button mat-stroked-button (click)="copiarImagen()">
            <mat-icon>content_copy</mat-icon> Copiar imagen
          </button>
        }
        <button mat-stroked-button (click)="abrirWhatsApp()">
          <mat-icon>chat</mat-icon> WhatsApp
        </button>
        @if (puedeCompartirArchivo()) {
          <button mat-flat-button color="primary" (click)="compartir()">
            <mat-icon>share</mat-icon> Compartir
          </button>
        }
      }
    </mat-dialog-actions>
  `,
  styles: [`
    .contenido { display: flex; flex-direction: column; gap: 12px; max-height: 75vh; }
    .imagen { max-width: 100%; height: auto; border: 1px solid var(--hairline); border-radius: 8px; background: #fff; }
    .mensaje { width: 100%; }
    .error { color: var(--danger); }
    .acciones { flex-wrap: wrap; gap: 8px; }
  `]
})
export class ReporteCompartirDialogComponent implements OnDestroy {
  readonly dialogRef = inject(MatDialogRef<ReporteCompartirDialogComponent>);
  private readonly data = inject<ReporteCompartirData>(MAT_DIALOG_DATA);
  private readonly reporteService = inject(ReporteService);
  private readonly corteService = inject(CorteService);
  private readonly snackBar = inject(MatSnackBar);

  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly urlImagen = signal<string>('');
  mensaje = '';

  private blob: Blob | null = null;

  readonly puedeCopiarImagen =
    typeof ClipboardItem !== 'undefined' && !!navigator.clipboard && typeof navigator.clipboard.write === 'function';

  /** Solo hay menu nativo con archivo en celulares/navegadores que lo soportan. */
  readonly puedeCompartirArchivo = computed(() => {
    if (!this.blob || typeof navigator.canShare !== 'function') return false;
    return navigator.canShare({ files: [this.archivo()] });
  });

  constructor() {
    // La imagen es lo importante; el avance solo sirve para saber que hora va. Si falla, igual se comparte.
    forkJoin({
      imagen: this.reporteService.obtenerImagenReporte(this.data.procesoDiarioId),
      avance: this.reporteService.obtenerAvance(this.data.procesoDiarioId).pipe(catchError(() => of(null))),
      cortes: this.corteService.listar(this.data.procesoDiarioId).pipe(catchError(() => of(null)))
    }).subscribe({
      next: ({ imagen, avance, cortes }) => {
        this.blob = imagen;
        this.urlImagen.set(URL.createObjectURL(imagen));
        // Arandano: la hora sale del avance. Vid no tiene vista en linea (avance null): se cuenta
        // con los cortes, igual que el reporte (el almuerzo general no ocupa numero de hora).
        let ultima: number | null = null;
        const horas = (avance?.avance?.horas ?? []).filter((h) => !h.pausa);
        if (horas.length) {
          ultima = horas[horas.length - 1].numero;
        } else if (cortes?.length) {
          const numeros = [...numerosDeHora(cortes).values()].filter((n): n is number => n !== null);
          ultima = numeros.length ? Math.max(...numeros) : null;
        }
        this.mensaje = construirMensajeReporte(new Date(), ultima, avance?.plantilla);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set('No se pudo generar la imagen del reporte.');
        this.cargando.set(false);
      }
    });
  }

  ngOnDestroy(): void {
    if (this.urlImagen()) URL.revokeObjectURL(this.urlImagen());
  }

  private archivo(): File {
    return new File([this.blob!], `avance-${this.data.fecha ?? 'reporte'}.png`, { type: 'image/png' });
  }

  async compartir(): Promise<void> {
    try {
      await navigator.share({ files: [this.archivo()], text: this.mensaje });
    } catch (e) {
      // AbortError = el usuario cerro el menu: no es un error.
      if ((e as DOMException)?.name !== 'AbortError') {
        this.snackBar.open('No se pudo abrir el menu de compartir.', 'Cerrar', { duration: 4000 });
      }
    }
  }

  abrirWhatsApp(): void {
    window.open(`https://wa.me/?text=${encodeURIComponent(this.mensaje)}`, '_blank', 'noopener');
    if (!this.puedeCompartirArchivo()) {
      this.snackBar.open('Pega la imagen en el chat (usa "Copiar imagen" o "Descargar").', 'Cerrar', { duration: 6000 });
    }
  }

  async copiarImagen(): Promise<void> {
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': this.blob! })]);
      this.snackBar.open('Imagen copiada. Pégala en la conversación.', 'Cerrar', { duration: 4000 });
    } catch {
      this.snackBar.open('No se pudo copiar la imagen; usa Descargar.', 'Cerrar', { duration: 4000 });
    }
  }

  descargar(): void {
    const a = document.createElement('a');
    a.href = this.urlImagen();
    a.download = this.archivo().name;
    a.click();
  }
}
