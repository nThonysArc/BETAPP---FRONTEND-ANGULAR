import { CalculadoraSumasDirective } from '../../../shared/calculadora-sumas/calculadora-sumas.directive';
import { Component, HostListener, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { IngresoMateriaPrimaService } from '../../../core/services/ingreso-materia-prima.service';
import { ProcesoDiarioService } from '../../../core/services/proceso-diario.service';
import { CampanaService } from '../../../core/services/campana.service';
import { VariedadService } from '../../../core/services/variedad.service';
import { ProductoService } from '../../../core/services/producto.service';
import { IngresoMateriaPrima } from '../../../core/models/ingreso-materia-prima.model';
import { Variedad } from '../../../core/models/variedad.model';
import { FilaPegada, parsearPegado, pareceTabla } from '../../../shared/pegado-excel/pegado-excel.util';
import { LoadingSpinnerComponent } from '../../../shared/loading-spinner/loading-spinner.component';

@Component({
  selector: 'app-ingreso-materia-prima',
  standalone: true,
  imports: [CalculadoraSumasDirective, 
    CommonModule,
    ReactiveFormsModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTableModule,
    MatCardModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    LoadingSpinnerComponent
  ],
  templateUrl: './ingreso-materia-prima.component.html',
  styleUrl: './ingreso-materia-prima.component.scss'
})
export class IngresoMateriaPrimaComponent {
  private readonly fb = inject(FormBuilder);
  private readonly ingresoService = inject(IngresoMateriaPrimaService);
  private readonly procesoDiarioService = inject(ProcesoDiarioService);
  private readonly campanaService = inject(CampanaService);
  private readonly variedadService = inject(VariedadService);
  private readonly productoService = inject(ProductoService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly procesoDiarioId = Number(this.route.snapshot.paramMap.get('procesoId'));
  readonly ingresos = signal<IngresoMateriaPrima[]>([]);
  readonly variedadesDisponibles = signal<Variedad[]>([]);
  readonly cargando = signal(true);
  readonly guardando = signal(false);
  private readonly columnasConKilos = ['variedad', 'jabas', 'kilos', 'pesoPromedio', 'actualizadoEn'];
  private readonly columnasSoloJabas = ['variedad', 'jabas', 'actualizadoEn'];

  private campanaId: number | null = null;

  /** Proyeccion del dia: solo la plantilla Vid la usa (aparece en el encabezado del reporte). */
  readonly esVid = signal(false);
  readonly guardandoProyeccion = signal(false);
  readonly proyeccionGuardada = signal<number | null>(null);
  readonly proyeccion = new FormControl<number | null>(null, [Validators.min(0)]);

  get proyeccionCambio(): boolean {
    const v = this.proyeccion.value;
    return (v === null || v === undefined ? null : Number(v)) !== this.proyeccionGuardada();
  }

  /** Filas detectadas al pegar desde Excel, pendientes de confirmar (varias variedades a la vez). */
  readonly pegado = signal<FilaPegada[]>([]);
  private readonly columnasPegadoConKilos = ['variedad', 'jabas', 'kilos', 'promedio'];
  private readonly columnasPegadoSoloJabas = ['variedad', 'jabas'];

  /** En Vid el avance se maneja por jabas: no se piden ni se muestran los kilos. */
  get columnas(): string[] {
    return this.esVid() ? this.columnasSoloJabas : this.columnasConKilos;
  }

  get columnasPegado(): string[] {
    return this.esVid() ? this.columnasPegadoSoloJabas : this.columnasPegadoConKilos;
  }

  readonly form = this.fb.group({
    variedadId: [null as number | null, Validators.required],
    jabas: [null as number | null, [Validators.required, Validators.min(0)]],
    kilos: [null as number | null, [Validators.required, Validators.min(0)]]
  });

  get totalJabas(): number {
    return this.ingresos().reduce((t, i) => t + Number(i.jabas || 0), 0);
  }

  get totalKilos(): number {
    return this.ingresos().reduce((t, i) => t + Number(i.kilos || 0), 0);
  }

  /** Promedio ponderado: kilos totales / jabas totales (no el promedio de los promedios). */
  get pesoPromedioGeneral(): number | null {
    return this.totalJabas > 0 ? this.totalKilos / this.totalJabas : null;
  }

  get pesoPromedioPreview(): number | null {
    if (this.esVid()) return null;
    const { jabas, kilos } = this.form.getRawValue();
    const nJabas = Number(jabas);
    if (!nJabas || nJabas <= 0 || kilos === null) return null;
    return Math.round((kilos / nJabas) * 1000) / 1000;
  }

  constructor() {
    this.cargarIngresos();

    this.procesoDiarioService.obtener(this.procesoDiarioId).subscribe({
      next: (proceso) => {
        this.campanaId = proceso.campanaId;
        this.proyeccionGuardada.set(proceso.proyeccionJabas ?? null);
        this.proyeccion.setValue(proceso.proyeccionJabas ?? null);
        this.fechaProceso = proceso.fecha;
        this.stockAnteriorGuardado.set(this.stockDe(proceso));
        this.aplicarStockAlFormulario(proceso);
        this.campanaService.obtener(proceso.campanaId).subscribe({
          next: (campana) => {
            this.productoService.listar().subscribe({
              next: (productos) => {
                const vid = productos.find((p) => p.id === campana.productoId)?.plantillaReporte === 'VID';
                this.esVid.set(vid);
                this.form.controls.kilos.setValidators(vid ? [Validators.min(0)] : [Validators.required, Validators.min(0)]);
                this.form.controls.kilos.updateValueAndValidity();
              }
            });
            this.variedadService.listarPorProducto(campana.productoId).subscribe({
              next: (variedades) => this.variedadesDisponibles.set(variedades)
            });
          }
        });
      }
    });
  }

  /** Stock que quedo de un dia previo (Vid): se digita aqui, junto con la materia prima. */
  readonly guardandoStock = signal(false);
  readonly stockAnteriorGuardado = signal<{ jabas: number; fecha: string } | null>(null);
  readonly stockAnterior = new FormControl<number | null>(null, [Validators.min(0)]);
  readonly stockAnteriorFecha = new FormControl<string>('', [Validators.required]);
  private fechaProceso = '';

  private stockDe(p: { stockAnteriorJabas?: number | null; stockAnteriorFecha?: string | null }) {
    return p.stockAnteriorJabas == null
      ? null
      : { jabas: Number(p.stockAnteriorJabas), fecha: p.stockAnteriorFecha ?? '' };
  }

  /** Por defecto la fecha es el dia anterior al del proceso, pero se puede cambiar. */
  private aplicarStockAlFormulario(p: { fecha: string; stockAnteriorJabas?: number | null; stockAnteriorFecha?: string | null }): void {
    const s = this.stockDe(p);
    this.stockAnterior.setValue(s ? s.jabas : null);
    this.stockAnteriorFecha.setValue(s?.fecha || diaAnterior(p.fecha));
  }

  get stockAnteriorCambio(): boolean {
    const g = this.stockAnteriorGuardado();
    const v = this.stockAnterior.value;
    const jabas = v === null || v === undefined || (v as unknown) === '' ? null : Number(v);
    if (jabas === null) return g !== null;
    return g === null || g.jabas !== jabas || g.fecha !== this.stockAnteriorFecha.value;
  }

  guardarStockAnterior(): void {
    if (this.stockAnterior.invalid || this.stockAnteriorFecha.invalid) return;
    const bruto = this.stockAnterior.value;
    const jabas = bruto === null || bruto === undefined || (bruto as unknown) === '' ? null : Number(bruto);
    if (jabas !== null && !Number.isFinite(jabas)) return;
    if (jabas !== null && this.fechaProceso && (this.stockAnteriorFecha.value ?? '') >= this.fechaProceso) {
      this.snackBar.open('La fecha del stock debe ser anterior a la del proceso', 'Cerrar', { duration: 4000 });
      return;
    }
    this.guardandoStock.set(true);
    this.procesoDiarioService
      .actualizarStockAnterior(this.procesoDiarioId, jabas, jabas === null ? null : this.stockAnteriorFecha.value)
      .subscribe({
        next: (proceso) => {
          this.guardandoStock.set(false);
          this.stockAnteriorGuardado.set(this.stockDe(proceso));
          this.aplicarStockAlFormulario(proceso);
          this.snackBar.open(jabas === null ? 'Stock anterior quitado' : 'Stock anterior guardado', 'Cerrar', { duration: 2500 });
        },
        error: (e) => {
          this.guardandoStock.set(false);
          this.snackBar.open(e?.error?.message ?? 'No se pudo guardar el stock anterior', 'Cerrar', { duration: 4000 });
        }
      });
  }

  quitarStockAnterior(): void {
    this.stockAnterior.setValue(null);
    this.guardarStockAnterior();
  }

  guardarProyeccion(): void {
    if (this.proyeccion.invalid) return;
    const bruto = this.proyeccion.value;
    const jabas = bruto === null || bruto === undefined || (bruto as unknown) === '' ? null : Number(bruto);
    if (jabas !== null && !Number.isFinite(jabas)) return;
    this.guardandoProyeccion.set(true);
    this.procesoDiarioService.actualizarProyeccion(this.procesoDiarioId, jabas).subscribe({
      next: (proceso) => {
        this.guardandoProyeccion.set(false);
        this.proyeccionGuardada.set(proceso.proyeccionJabas ?? null);
        this.proyeccion.setValue(proceso.proyeccionJabas ?? null);
        this.snackBar.open('Proyección guardada', 'Cerrar', { duration: 2500 });
      },
      error: (e) => {
        this.guardandoProyeccion.set(false);
        this.snackBar.open(e?.error?.message ?? 'No se pudo guardar la proyección', 'Cerrar', { duration: 4000 });
      }
    });
  }

  private cargarIngresos(): void {
    this.cargando.set(true);
    this.ingresoService.listar(this.procesoDiarioId).subscribe({
      next: (ingresos) => {
        this.ingresos.set(ingresos);
        this.cargando.set(false);
      },
      error: () => {
        this.cargando.set(false);
        this.snackBar.open('Error al cargar el ingreso de materia prima', 'Cerrar', { duration: 4000 });
      }
    });
  }

  /**
   * Pegar datos copiados de Excel en cualquier parte de la pantalla. Si es un solo valor ("500") se deja
   * que el campo lo reciba normal; si trae varias celdas/filas se interpreta como tabla.
   */
  @HostListener('paste', ['$event'])
  alPegar(evento: ClipboardEvent): void {
    const texto = evento.clipboardData?.getData('text') ?? '';
    if (!pareceTabla(texto)) return;
    evento.preventDefault();
    this.procesarPegado(texto);
  }

  procesarPegado(texto: string): void {
    const filas = parsearPegado(
      texto,
      this.variedadesDisponibles().map((v) => ({ id: v.id, nombre: v.nombre })),
      this.esVid()
    );
    if (filas.length === 0) {
      this.snackBar.open('No se encontraron jabas' + (this.esVid() ? '' : ' y kilos') + ' en lo pegado', 'Cerrar', { duration: 4000 });
      return;
    }
    // Una sola fila: se llena el formulario (si no trae variedad, se respeta la elegida) para revisar y guardar.
    if (filas.length === 1) {
      const f = filas[0];
      this.form.patchValue({
        variedadId: f.variedadId ?? this.form.getRawValue().variedadId,
        jabas: f.jabas,
        kilos: f.kilos
      });
      this.pegado.set([]);
      this.snackBar.open('Datos pegados: revisa y pulsa Guardar', 'Cerrar', { duration: 3000 });
      return;
    }
    this.pegado.set(filas);
  }

  asignarVariedadPegada(indice: number, variedadId: number): void {
    this.pegado.update((filas) => filas.map((f, i) => (i === indice ? { ...f, variedadId } : f)));
  }

  /** Jabas y kilos vienen al reves con frecuencia: un clic los intercambia en todas las filas. */
  intercambiarPegado(): void {
    this.pegado.update((filas) => filas.map((f) => ({ ...f, jabas: f.kilos, kilos: f.jabas })));
  }

  promedioDe(f: FilaPegada): number | null {
    return f.jabas > 0 ? Math.round((f.kilos / f.jabas) * 1000) / 1000 : null;
  }

  nombreVariedad(id: number): string {
    return this.variedadesDisponibles().find((v) => v.id === id)?.nombre ?? '';
  }

  get pegadoListo(): boolean {
    const filas = this.pegado();
    return filas.length > 0 && filas.every((f) => f.variedadId !== null);
  }

  descartarPegado(): void {
    this.pegado.set([]);
  }

  guardarPegado(): void {
    if (!this.pegadoListo) return;
    this.guardando.set(true);
    forkJoin(
      this.pegado().map((f) =>
        this.ingresoService.actualizar(this.procesoDiarioId, {
          variedadId: f.variedadId!,
          jabas: f.jabas,
          kilos: f.kilos
        })
      )
    ).subscribe({
      next: () => {
        this.guardando.set(false);
        this.snackBar.open(`${this.pegado().length} variedades actualizadas`, 'Cerrar', { duration: 3000 });
        this.pegado.set([]);
        this.cargarIngresos();
      },
      error: (err) => {
        this.guardando.set(false);
        this.snackBar.open(err.error?.message ?? 'Error al guardar lo pegado', 'Cerrar', { duration: 4000 });
      }
    });
  }

  editarVariedad(ingreso: IngresoMateriaPrima): void {
    this.form.patchValue({
      variedadId: ingreso.variedadId,
      jabas: ingreso.jabas,
      kilos: this.esVid() ? null : ingreso.kilos
    });
  }

  guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.guardando.set(true);
    const raw = this.form.getRawValue();

    this.ingresoService
      .actualizar(this.procesoDiarioId, {
        variedadId: raw.variedadId!,
        jabas: Number(raw.jabas),
        kilos: this.esVid() ? 0 : raw.kilos!
      })
      .subscribe({
        next: () => {
          this.guardando.set(false);
          this.snackBar.open('Ingreso actualizado', 'Cerrar', { duration: 3000 });
          this.form.reset();
          this.cargarIngresos();
        },
        error: (err) => {
          this.guardando.set(false);
          this.snackBar.open(err.error?.message ?? 'Error al actualizar el ingreso', 'Cerrar', { duration: 4000 });
        }
      });
  }

  volver(): void {
    if (this.campanaId !== null) {
      this.router.navigate(['/procesos', this.campanaId]);
    } else {
      this.router.navigate(['/']);
    }
  }
}

/** "2026-11-04" -> "2026-11-03" (UTC: no depende de la zona horaria del dispositivo). */
function diaAnterior(iso: string): string {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}
