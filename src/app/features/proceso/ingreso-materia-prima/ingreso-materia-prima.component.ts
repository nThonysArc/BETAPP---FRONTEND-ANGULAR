import { Component, inject, signal } from '@angular/core';
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
import { LoadingSpinnerComponent } from '../../../shared/loading-spinner/loading-spinner.component';

@Component({
  selector: 'app-ingreso-materia-prima',
  standalone: true,
  imports: [
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

  readonly form = this.fb.group({
    variedadId: [null as number | null, Validators.required],
    jabas: [null as number | null, [Validators.required, Validators.min(0)]],
    kilos: [null as number | null, [Validators.required, Validators.min(0)]]
  });

  get pesoPromedioPreview(): number | null {
    const { jabas, kilos } = this.form.getRawValue();
    if (!jabas || jabas <= 0 || kilos === null) return null;
    return Math.round((kilos / jabas) * 1000) / 1000;
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
        jabas: raw.jabas!,
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
