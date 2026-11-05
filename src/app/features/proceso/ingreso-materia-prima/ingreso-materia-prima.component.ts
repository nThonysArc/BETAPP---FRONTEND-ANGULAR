import { CalculadoraSumasDirective } from '../../../shared/calculadora-sumas/calculadora-sumas.directive';
import { Component, HostListener, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
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
  private readonly snackBar = inject(MatSnackBar);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly procesoDiarioId = Number(this.route.snapshot.paramMap.get('procesoId'));
  readonly ingresos = signal<IngresoMateriaPrima[]>([]);
  readonly variedadesDisponibles = signal<Variedad[]>([]);
  readonly cargando = signal(true);
  readonly guardando = signal(false);
  readonly columnas = ['variedad', 'jabas', 'kilos', 'pesoPromedio', 'actualizadoEn'];

  private campanaId: number | null = null;

  /** Filas detectadas al pegar desde Excel, pendientes de confirmar (varias variedades a la vez). */
  readonly pegado = signal<FilaPegada[]>([]);
  readonly columnasPegado = ['variedad', 'jabas', 'kilos', 'promedio'];

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
        this.campanaService.obtener(proceso.campanaId).subscribe({
          next: (campana) => {
            this.variedadService.listarPorProducto(campana.productoId).subscribe({
              next: (variedades) => this.variedadesDisponibles.set(variedades)
            });
          }
        });
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
      this.variedadesDisponibles().map((v) => ({ id: v.id, nombre: v.nombre }))
    );
    if (filas.length === 0) {
      this.snackBar.open('No se encontraron jabas y kilos en lo pegado', 'Cerrar', { duration: 4000 });
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
      kilos: ingreso.kilos
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
        kilos: raw.kilos!
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
