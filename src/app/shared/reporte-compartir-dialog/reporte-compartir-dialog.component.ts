import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { ReporteService } from '../../core/services/reporte.service';
import { CorteService } from '../../core/services/corte.service';
import { numerosDeHora } from '../../core/utils/horas-corte.util';
import { CampanaService } from '../../core/services/campana.service';
import { ProcesoDiarioService } from '../../core/services/proceso-diario.service';
import { construirMensajeReporte, nombreProcesoParaMensaje, procesoPorDefecto } from '../../core/utils/mensaje-reporte.util';
import {
  asuntoBase, construirEml, fechaConPuntos, htmlCorreo, nombreProcesoCorreo, nuevoMessageId,
  saludoCorreo
} from '../../core/utils/correo-avance.util';
import { saludoSegunHora } from '../../core/utils/mensaje-reporte.util';
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
    MatCheckboxModule, MatSnackBarModule, LoadingSpinnerComponent
  ],
  template: `
    <h2 mat-dialog-title>Reporte de avance</h2>
    <mat-dialog-content class="contenido">
      @if (cargando()) {
        <app-loading-spinner mensaje="Generando imagen..." />
      } @else if (error()) {
        <p class="error">{{ error() }}</p>
      } @else {
        <div class="visor" [class.ampliada]="ampliada()">
          <img [src]="urlImagen()" alt="Imagen del reporte de avance" class="imagen" />
        </div>
        <button mat-button type="button" class="ampliar" (click)="ampliada.set(!ampliada())">
          <mat-icon>{{ ampliada() ? 'zoom_out' : 'zoom_in' }}</mat-icon>
          {{ ampliada() ? 'Ajustar a la pantalla' : 'Ver en tamaño real (para leer los datos)' }}
        </button>

        <mat-form-field appearance="outline" class="mensaje">
          <mat-label>Mensaje</mat-label>
          <textarea matInput rows="3" [(ngModel)]="mensaje"></textarea>
        </mat-form-field>

        @if (correoAbierto()) {
          <section class="correo">
            <h3>Correo (Outlook)</h3>
            <mat-form-field appearance="outline">
              <mat-label>Asunto</mat-label>
              <input matInput [(ngModel)]="asunto" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Para (separa con ;)</mat-label>
              <input matInput [(ngModel)]="para" (ngModelChange)="guardarConfig()" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>CC</mat-label>
              <input matInput [(ngModel)]="cc" (ngModelChange)="guardarConfig()" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Saludo a</mat-label>
              <input matInput [(ngModel)]="saludoA" placeholder="Ing. Christian" (ngModelChange)="guardarConfig()" />
            </mat-form-field>
            <mat-checkbox [(ngModel)]="continuarHilo">
              Continuar el hilo anterior
              @if (enviadosAntes() > 0) { <span class="nota">· {{ enviadosAntes() }} previo(s) hoy</span> }
            </mat-checkbox>
            <div class="acciones-correo">
              @if (puedeCompartirArchivo()) {
                <button mat-flat-button color="primary" (click)="compartirPorCorreo()">
                  <mat-icon>share</mat-icon> Compartir por correo
                </button>
              }
              <button mat-stroked-button (click)="copiarLista('para')" [disabled]="!para">
                <mat-icon>content_copy</mat-icon> Copiar Para
              </button>
              <button mat-stroked-button (click)="copiarLista('cc')" [disabled]="!cc">
                <mat-icon>content_copy</mat-icon> Copiar CC
              </button>
              <button mat-stroked-button (click)="descargarBorrador()">
                <mat-icon>mail</mat-icon> Descargar borrador (.eml)
              </button>
              @if (puedeCopiarImagen) {
                <button mat-stroked-button (click)="copiarParaOutlook()">
                  <mat-icon>content_paste</mat-icon> Copiar para pegar
                </button>
              }
            </div>
          </section>
        }
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
        <button mat-stroked-button (click)="correoAbierto.set(!correoAbierto())">
          <mat-icon>mail</mat-icon> Correo
        </button>
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
    .visor { overflow: auto; max-height: 60vh; border-radius: 8px; }
    .visor.ampliada .imagen { max-width: none; width: 1500px; }
    .ampliar { align-self: flex-start; }
    .imagen { max-width: 100%; height: auto; border: 1px solid var(--hairline); border-radius: 8px; background: #fff; }
    .mensaje { width: 100%; }
    .error { color: var(--danger); }
    .correo { display: flex; flex-direction: column; gap: 4px; padding: 12px; border: 1px solid var(--hairline); border-radius: 12px; }
    .correo h3 { margin: 0 0 8px; }
    .nota { opacity: .7; font-size: 12px; }
    .acciones-correo { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
    .acciones { flex-wrap: wrap; gap: 8px; }
  `]
})
export class ReporteCompartirDialogComponent implements OnDestroy {
  readonly dialogRef = inject(MatDialogRef<ReporteCompartirDialogComponent>);
  private readonly data = inject<ReporteCompartirData>(MAT_DIALOG_DATA);
  private readonly reporteService = inject(ReporteService);
  private readonly corteService = inject(CorteService);
  private readonly procesoService = inject(ProcesoDiarioService);
  private readonly campanaService = inject(CampanaService);
  private readonly snackBar = inject(MatSnackBar);

  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly urlImagen = signal<string>('');
  readonly ampliada = signal(false);
  mensaje = '';

  // ---- Correo (Outlook) ----
  readonly correoAbierto = signal(false);
  readonly enviadosAntes = signal(0);
  asunto = '';
  para = '';
  cc = '';
  saludoA = '';
  continuarHilo = false;
  private contexto: { producto: string; anio: number | null; fecha: string } | null = null;
  private anteriores: string[] = [];

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
      cortes: this.corteService.listar(this.data.procesoDiarioId).pipe(catchError(() => of(null))),
      // Producto del proceso (proceso -> campana -> producto) para nombrar el cultivo en el mensaje.
      producto: this.procesoService.obtener(this.data.procesoDiarioId).pipe(
        switchMap((p) => this.campanaService.obtener(p.campanaId).pipe(map((c) => ({ ...c, fecha: p.fecha })))),
        map((c) => ({ producto: c.productoNombre, anio: c.anio ?? null, fecha: c.fecha })),
        catchError(() => of(null))
      )
    }).subscribe({
      next: ({ imagen, avance, cortes, producto }) => {
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
        this.mensaje = construirMensajeReporte(
          new Date(), ultima,
          producto ? nombreProcesoParaMensaje(producto.producto) : procesoPorDefecto(avance?.plantilla)
        );
        if (producto) this.prepararCorreo(producto);
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

  /**
   * WhatsApp no deja adjuntar archivos por enlace (wa.me solo admite texto). Por eso:
   * - Celular: se abre el menu nativo de compartir con la imagen ADJUNTA; ahi se toca WhatsApp y se elige el chat.
   * - PC: se abre WhatsApp con el texto y la imagen queda copiada para pegarla (Ctrl+V) en el chat.
   */
  async abrirWhatsApp(): Promise<void> {
    if (this.puedeCompartirArchivo()) {
      await this.compartir();
      return;
    }
    // window.open primero y sincrono: despues de un await el navegador puede bloquearlo como ventana emergente.
    window.open(`https://wa.me/?text=${encodeURIComponent(this.mensaje)}`, '_blank', 'noopener');
    if (this.puedeCopiarImagen) {
      await this.copiarImagen();
      this.snackBar.open('Imagen copiada: pégala en el chat con Ctrl+V.', 'Cerrar', { duration: 6000 });
    } else {
      this.snackBar.open('Descarga la imagen y adjúntala en el chat.', 'Cerrar', { duration: 6000 });
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

  // ==========================================================
  // Correo: borrador .eml para Outlook
  // ==========================================================

  private claveHilo(): string {
    return `betaapp.correo.hilo.${this.data.procesoDiarioId}`;
  }

  private prepararCorreo(ctx: { producto: string; anio: number | null; fecha: string }): void {
    this.contexto = ctx;
    try {
      const cfg = JSON.parse(localStorage.getItem('betaapp.correo.config') ?? '{}');
      this.para = cfg.para ?? '';
      this.cc = cfg.cc ?? '';
      this.saludoA = cfg.saludoA ?? '';
      this.anteriores = JSON.parse(localStorage.getItem(this.claveHilo()) ?? '[]');
    } catch {
      /* sin almacenamiento: queda vacio */
    }
    this.enviadosAntes.set(this.anteriores.length);
    this.continuarHilo = this.anteriores.length > 0;
    this.actualizarAsunto();
  }

  actualizarAsunto(): void {
    if (!this.contexto) return;
    const base = asuntoBase(this.contexto.producto, this.contexto.anio, this.contexto.fecha);
    // Mismo asunto en todos los correos del dia, sin "RE:": Outlook agrupa la conversacion por asunto.
    this.asunto = base;
  }

  guardarConfig(): void {
    try {
      localStorage.setItem('betaapp.correo.config', JSON.stringify({ para: this.para, cc: this.cc, saludoA: this.saludoA }));
    } catch {
      /* no se pudo guardar: solo se pierde la comodidad */
    }
  }

  private fraseCorreo(): string {
    const ctx = this.contexto!;
    return `Se envía el avance del proceso ${nombreProcesoCorreo(ctx.producto)} correspondiente al día ${fechaConPuntos(ctx.fecha)}`;
  }

  private saludoLinea(): string {
    return saludoCorreo(saludoSegunHora(new Date()), this.saludoA);
  }

  /** Texto del cuerpo para el menu de compartir (sin imagen incrustada: ahi va adjunta). */
  private cuerpoTexto(): string {
    return `${this.saludoLinea()}\n${this.fraseCorreo()}\n\nSaludos`;
  }

  /**
   * Celular: el menu nativo de compartir. El asunto va en `title` y el cuerpo en `text`, con la imagen adjunta.
   * Los destinatarios (Para/CC) NO se pueden mandar por este menu (el navegador no lo permite): por eso
   * existe "Copiar Para y CC" para pegarlos en un toque.
   */
  async compartirPorCorreo(): Promise<void> {
    if (!this.blob || !this.contexto) return;
    try {
      await navigator.share({ files: [this.archivo()], title: this.asunto, text: this.cuerpoTexto() });
    } catch (e) {
      if ((e as DOMException)?.name !== 'AbortError') {
        this.snackBar.open('No se pudo abrir el menu de compartir.', 'Cerrar', { duration: 4000 });
      }
    }
  }

  /** Copia solo las direcciones (sin etiquetas) para pegarlas directo en el campo Para o CC. */
  async copiarLista(campo: 'para' | 'cc'): Promise<void> {
    const direcciones = (campo === 'para' ? this.para : this.cc)
      .split(/[;,\n]/).map((x) => x.trim()).filter(Boolean).join('; ');
    try {
      await navigator.clipboard.writeText(direcciones);
      this.snackBar.open(`Copiado. Pégalo en ${campo === 'para' ? 'Para' : 'CC'}.`, 'Cerrar', { duration: 3500 });
    } catch {
      this.snackBar.open('No se pudo copiar.', 'Cerrar', { duration: 3000 });
    }
  }

  async descargarBorrador(): Promise<void> {
    if (!this.blob || !this.contexto) return;
    const png = new Uint8Array(await this.blob.arrayBuffer());
    const id = nuevoMessageId(this.data.procesoDiarioId, Date.now());
    const eml = construirEml({
      asunto: this.asunto, para: this.para, cc: this.cc, saludo: this.saludoLinea(), frase: this.fraseCorreo(),
      png, messageId: id, anteriores: this.continuarHilo ? this.anteriores : []
    });
    const url = URL.createObjectURL(new Blob([eml], { type: 'message/rfc822' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.asunto.replace(/[\\/:*?"<>|]/g, '-')}.eml`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    // Se recuerda este correo para encadenar el siguiente.
    this.anteriores = [...(this.continuarHilo ? this.anteriores : []), id];
    this.enviadosAntes.set(this.anteriores.length);
    try {
      localStorage.setItem(this.claveHilo(), JSON.stringify(this.anteriores));
    } catch {
      /* sin almacenamiento: el asunto RE: igual agrupa el hilo en Outlook */
    }
    this.snackBar.open('Abre el archivo descargado: Outlook lo muestra como borrador listo para enviar.', 'Cerrar', { duration: 7000 });
  }

  /** Para Outlook web: copia el correo (texto + imagen) y se pega en un mensaje nuevo. */
  async copiarParaOutlook(): Promise<void> {
    if (!this.blob || !this.contexto) return;
    try {
      const png = new Uint8Array(await this.blob.arrayBuffer());
      let bin = '';
      for (let i = 0; i < png.length; i += 0x8000) bin += String.fromCharCode(...png.subarray(i, i + 0x8000));
      const html = htmlCorreo(
        { saludo: this.saludoLinea(), frase: this.fraseCorreo(), png },
        `data:image/png;base64,${btoa(bin)}`
      );
      await navigator.clipboard.write([new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([`${this.saludoLinea()}\n${this.fraseCorreo()}\n\nSaludos`], { type: 'text/plain' })
      })]);
      this.snackBar.open(`Copiado. Pégalo en un correo nuevo con el asunto: ${this.asunto}`, 'Cerrar', { duration: 8000 });
    } catch {
      this.snackBar.open('No se pudo copiar; usa Descargar borrador.', 'Cerrar', { duration: 4000 });
    }
  }
}
