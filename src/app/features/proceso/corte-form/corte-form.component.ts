import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { CorteService } from '../../../core/services/corte.service';
import { ProcesoDiarioService } from '../../../core/services/proceso-diario.service';
import { CampanaService } from '../../../core/services/campana.service';
import { MaquinaService } from '../../../core/services/maquina.service';
import { MaquinaKatoService } from '../../../core/services/maquina-kato.service';
import { UsuarioService } from '../../../core/services/usuario.service';
import { VariedadService } from '../../../core/services/variedad.service';
import { IngresoMateriaPrimaService } from '../../../core/services/ingreso-materia-prima.service';
import { CorteRequest, CorteSupervisor } from '../../../core/models/corte.model';
import { UsuarioResumen } from '../../../core/models/usuario.model';
import { Maquina } from '../../../core/models/maquina.model';
import { MaquinaKato } from '../../../core/models/maquina-kato.model';
import { Variedad } from '../../../core/models/variedad.model';
import { LoadingSpinnerComponent } from '../../../shared/loading-spinner/loading-spinner.component';

@Component({
  selector: 'app-corte-form',
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
    MatSnackBarModule,
    MatCardModule,
    MatChipsModule,
    MatCheckboxModule,
    MatProgressSpinnerModule,
    LoadingSpinnerComponent
  ],
  templateUrl: './corte-form.component.html',
  styleUrl: './corte-form.component.scss'
})
export class CorteFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly corteService = inject(CorteService);
  private readonly procesoDiarioService = inject(ProcesoDiarioService);
  private readonly campanaService = inject(CampanaService);
  private readonly maquinaService = inject(MaquinaService);
  private readonly maquinaKatoService = inject(MaquinaKatoService);
  private readonly usuarioService = inject(UsuarioService);
  private readonly variedadService = inject(VariedadService);
  private readonly ingresoService = inject(IngresoMateriaPrimaService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly procesoDiarioId = Number(this.route.snapshot.paramMap.get('procesoId'));
  private readonly corteIdParam = this.route.snapshot.paramMap.get('corteId');
  readonly esEdicion = this.corteIdParam !== null;
  readonly corteId = this.esEdicion ? Number(this.corteIdParam) : null;

  readonly numeroCorteSugerido = signal<number | null>(null);
  readonly cargandoPlantilla = signal(true);
  readonly guardando = signal(false);
  readonly maquinasDisponibles = signal<Maquina[]>([]);
  readonly supervisoresDisponibles = signal<UsuarioResumen[]>([]);
  readonly variedadesDisponibles = signal<Variedad[]>([]);
  readonly hayIngresoRegistrado = signal(false);
  readonly procesoEstado = signal<'ABIERTO' | 'CERRADO' | null>(null);
  readonly requiereRevision = signal(false);

  private campanaId: number | null = null;

  /** variedadId -> peso promedio por jaba, segun el ultimo ingreso reportado. */
  private pesosPromedio = new Map<number, number>();

  /** maquinaId -> katos activos de esa maquina, para el select dependiente. */
  private katosPorMaquina = new Map<number, MaquinaKato[]>();

  /**
   * maquinaId -> supervisorId elegido para ESTE corte (null = sin supervisor).
   * Un solo supervisor por maquina y por hora. Se precarga con el del corte
   * anterior (plantilla) y, para una maquina nueva, con el sugerido de la maquina.
   */
  private supervisorPorMaquina = new Map<number, number | null>();

  /**
   * maquinaId -> observacion de ESTA maquina en ESTA hora. Nunca se hereda del corte
   * anterior: cada hora se anota lo que paso en esa hora.
   */
  private observacionPorMaquina = new Map<number, string>();

  /** Maquinas que salen a almorzar en ESTA hora. Nunca se hereda del corte anterior. */
  private almuerzoPorMaquina = new Set<number>();

  readonly form = this.fb.group({
    horaInicio: ['', Validators.required],
    horaFin: ['', Validators.required],
    observacion: [''],
    motivoAjuste: [''],
    detalles: this.fb.array([])
  });

  get detalles(): FormArray {
    return this.form.get('detalles') as FormArray;
  }

  constructor() {
    this.cargarDatosIniciales();
  }

  katosDisponiblesPara(maquinaId: number | null): MaquinaKato[] {
    if (maquinaId === null) return [];
    return this.katosPorMaquina.get(maquinaId) ?? [];
  }

  /** Maquinas que aparecen en el detalle, sin repetir y en orden de aparicion. */
  maquinasEnUso(): { id: number; nombre: string }[] {
    const vistas = new Set<number>();
    const resultado: { id: number; nombre: string }[] = [];

    for (const control of this.detalles.controls) {
      const id = control.get('maquinaId')?.value as number | null;
      if (id === null || id === undefined || vistas.has(id)) continue;
      vistas.add(id);
      const maquina = this.maquinasDisponibles().find((m) => m.id === id);
      resultado.push({ id, nombre: maquina?.nombre ?? `Maquina ${id}` });
    }
    return resultado;
  }

  supervisorDe(maquinaId: number): number | null {
    return this.supervisorPorMaquina.get(maquinaId) ?? null;
  }

  almuerzoDe(maquinaId: number): boolean {
    return this.almuerzoPorMaquina.has(maquinaId);
  }

  /** Todas las maquinas del corte estan en almuerzo: el reporte mostrara la barra "ALMUERZO DEL PERSONAL". */
  todoElPersonalAlmuerza(): boolean {
    const maquinas = this.maquinasEnUso();
    return maquinas.length > 0 && maquinas.every((m) => this.almuerzoDe(m.id));
  }

  onAlmuerzoChange(maquinaId: number, almuerza: boolean): void {
    if (almuerza) {
      this.almuerzoPorMaquina.add(maquinaId);
      // Una maquina en almuerzo no produce: sus filas quedan en 0.
      for (const control of this.detalles.controls) {
        if (control.get('maquinaId')?.value === maquinaId) {
          control.patchValue({ jabas: 0, pesoTotal: 0, kgPorEmpacador: 0 }, { emitEvent: false });
        }
      }
    } else {
      this.almuerzoPorMaquina.delete(maquinaId);
    }
  }

  marcarTodoElPersonalEnAlmuerzo(): void {
    this.maquinasEnUso().forEach((m) => this.onAlmuerzoChange(m.id, true));
  }

  observacionDe(maquinaId: number): string {
    return this.observacionPorMaquina.get(maquinaId) ?? '';
  }

  onObservacionChange(maquinaId: number, texto: string): void {
    this.observacionPorMaquina.set(maquinaId, texto);
  }

  onSupervisorChange(maquinaId: number, supervisorId: number | null): void {
    this.supervisorPorMaquina.set(maquinaId, supervisorId ?? null);
  }

  /** Si la maquina aun no tiene supervisor definido en este corte, propone el sugerido de la maquina. */
  private asegurarSupervisor(maquinaId: number | null): void {
    if (maquinaId === null || maquinaId === undefined || this.supervisorPorMaquina.has(maquinaId)) return;
    const maquina = this.maquinasDisponibles().find((m) => m.id === maquinaId);
    this.supervisorPorMaquina.set(maquinaId, maquina?.supervisorId ?? null);
  }

  /** Carga los supervisores del corte (plantilla o corte existente) y agrega a la lista a los que ya no estan activos. */
  private precargarSupervisores(supervisores: CorteSupervisor[] | undefined, activos: UsuarioResumen[]): void {
    const opciones = [...activos];
    this.supervisorPorMaquina.clear();
    this.observacionPorMaquina.clear();
    this.almuerzoPorMaquina.clear();

    (supervisores ?? []).forEach((s) => {
      if (s.almuerzo) {
        this.almuerzoPorMaquina.add(s.maquinaId);
      }
      this.supervisorPorMaquina.set(s.maquinaId, s.supervisorId);
      if (s.observacion) {
        this.observacionPorMaquina.set(s.maquinaId, s.observacion);
      }
      if (s.supervisorId !== null && !opciones.some((u) => u.id === s.supervisorId)) {
        opciones.push({
          id: s.supervisorId,
          nombreCompleto: s.supervisorNombre ?? `Usuario ${s.supervisorId}`,
          rol: 'SUPERVISOR'
        });
      }
    });

    this.supervisoresDisponibles.set(opciones);
  }

  private cargarDatosIniciales(): void {
    this.cargandoPlantilla.set(true);

    this.procesoDiarioService.obtener(this.procesoDiarioId).subscribe({
      next: (proceso) => {
        this.campanaId = proceso.campanaId;
        this.procesoEstado.set(proceso.estado);

        this.campanaService.obtener(proceso.campanaId).subscribe({
          next: (campana) => {
            const datosBase$ = forkJoin({
              ingresos: this.ingresoService.listar(this.procesoDiarioId),
              variedades: this.variedadService.listarPorProducto(campana.productoId),
              maquinas: this.maquinaService.listarPorCampana(proceso.campanaId),
              supervisores: this.usuarioService.listarSupervisores().pipe(
                catchError(() => of([] as UsuarioResumen[]))
              )
            });

            const contenidoCorte$ = this.esEdicion
              ? this.corteService.obtener(this.procesoDiarioId, this.corteId!)
              : this.corteService.obtenerPlantillaSiguiente(this.procesoDiarioId);

            forkJoin({ base: datosBase$, corte: contenidoCorte$ }).subscribe({
              next: ({ base, corte }) => {
                const { ingresos, variedades, maquinas, supervisores } = base;

                this.variedadesDisponibles.set(variedades);
                this.maquinasDisponibles.set(maquinas);

                this.pesosPromedio.clear();
                ingresos.forEach((i) => {
                  if (i.pesoPromedioPorJaba !== null) {
                    this.pesosPromedio.set(i.variedadId, i.pesoPromedioPorJaba);
                  }
                });
                this.hayIngresoRegistrado.set(ingresos.length > 0);

                const cargasKatos = maquinas.map((m) =>
                  this.maquinaKatoService.listarPorMaquina(m.id, true).pipe(
                    catchError(() => of([] as MaquinaKato[]))
                  )
                );

                forkJoin(cargasKatos.length > 0 ? cargasKatos : [of([] as MaquinaKato[])]).subscribe({
                  next: (listas) => {
                    maquinas.forEach((m, i) => this.katosPorMaquina.set(m.id, listas[i] ?? []));

                    // Primero los supervisores del corte: al agregar filas, las maquinas
                    // que ya tienen supervisor lo conservan y solo las nuevas usan el sugerido.
                    this.precargarSupervisores((corte as any).supervisores, supervisores);

                    if (this.esEdicion) {
                      const c = corte as any;
                      this.numeroCorteSugerido.set(c.numeroCorte);
                      this.requiereRevision.set(c.requiereRevision);
                      this.form.patchValue({
                        horaInicio: c.horaInicio.substring(0, 5),
                        horaFin: c.horaFin.substring(0, 5),
                        observacion: c.observacion ?? ''
                      });
                      c.detalles.forEach((d: any) =>
                        this.agregarDetalle(
                          d.maquinaId, d.maquinaKatoId, d.variedadId,
                          d.jabas, d.pesoTotal, d.empacadores, d.kgPorEmpacador
                        )
                      );
                    } else {
                      const p = corte as any;
                      this.numeroCorteSugerido.set(p.numeroCorteSugerido);
                      this.form.patchValue({
                        horaInicio: p.horaInicio.substring(0, 5),
                        horaFin: p.horaFin.substring(0, 5)
                      });
                      if (p.detalles.length > 0) {
                        p.detalles.forEach((d: any) =>
                          this.agregarDetalle(
                            d.maquinaId, d.maquinaKatoId, d.variedadId,
                            d.jabas, d.pesoTotal, d.empacadores, d.kgPorEmpacador
                          )
                        );
                      } else {
                        this.agregarDetalle();
                      }
                    }

                    this.cargandoPlantilla.set(false);
                  }
                });
              },
              error: () => {
                this.cargandoPlantilla.set(false);
                this.snackBar.open('Error al cargar el corte', 'Cerrar', { duration: 4000 });
              }
            });
          }
        });
      }
    });
  }

  agregarDetalle(
    maquinaId: number | null = null,
    maquinaKatoId: number | null = null,
    variedadId: number | null = null,
    jabas = 0,
    pesoTotal = 0,
    empacadores = 0,
    kgPorEmpacador = 0
  ): void {
    const grupo = this.fb.group({
      maquinaId: [maquinaId, Validators.required],
      maquinaKatoId: [maquinaKatoId, Validators.required],
      variedadId: [variedadId, Validators.required],
      jabas: [jabas, [Validators.required, Validators.min(0)]],
      pesoTotal: [pesoTotal, [Validators.required, Validators.min(0)]],
      empacadores: [empacadores, [Validators.required, Validators.min(0)]],
      kgPorEmpacador: [kgPorEmpacador, [Validators.required, Validators.min(0)]]
    });

    this.configurarAutoCalculo(grupo);
    this.asegurarSupervisor(maquinaId);
    this.detalles.push(grupo);
  }

  private configurarAutoCalculo(grupo: FormGroup): void {
    grupo.get('maquinaId')?.valueChanges.subscribe((maquinaId) => {
      grupo.get('maquinaKatoId')?.setValue(null);
      this.asegurarSupervisor(maquinaId);
    });

    const recalcularPesoTotal = () => {
      const variedadId = grupo.get('variedadId')?.value;
      const jabas = grupo.get('jabas')?.value;
      const pesoPromedio = variedadId !== null ? this.pesosPromedio.get(variedadId) : undefined;

      if (pesoPromedio !== undefined && jabas !== null && jabas !== undefined && jabas > 0) {
        const pesoCalculado = Math.round(jabas * pesoPromedio * 100) / 100;
        grupo.get('pesoTotal')?.setValue(pesoCalculado, { emitEvent: true });
      }
    };

    const recalcularKgPorEmpacador = () => {
      const pesoTotal = grupo.get('pesoTotal')?.value;
      const empacadores = grupo.get('empacadores')?.value;

      if (pesoTotal !== null && pesoTotal !== undefined && empacadores) {
        const kg = Math.round((pesoTotal / empacadores) * 100) / 100;
        grupo.get('kgPorEmpacador')?.setValue(kg, { emitEvent: false });
      }
    };

    grupo.get('jabas')?.valueChanges.subscribe(recalcularPesoTotal);
    grupo.get('variedadId')?.valueChanges.subscribe(recalcularPesoTotal);
    grupo.get('pesoTotal')?.valueChanges.subscribe(recalcularKgPorEmpacador);
    grupo.get('empacadores')?.valueChanges.subscribe(recalcularKgPorEmpacador);
  }

  eliminarDetalle(index: number): void {
    this.detalles.removeAt(index);
  }

  private construirRequest(): CorteRequest {
    const raw = this.form.getRawValue();

    return {
      clienteUuid: crypto.randomUUID(),
      horaInicio: raw.horaInicio!,
      horaFin: raw.horaFin!,
      observacion: raw.observacion || null,
      motivoAjuste: raw.motivoAjuste || null,
      detalles: raw.detalles!.map((d: any, i: number) => ({
        clienteUuid: null,
        maquinaId: d.maquinaId,
        maquinaNombre: null,
        maquinaKatoId: d.maquinaKatoId,
        katoNombre: null,
        variedadId: d.variedadId,
        variedadNombre: null,
        jabas: d.jabas,
        pesoTotal: d.pesoTotal,
        empacadores: d.empacadores,
        kgPorEmpacador: d.kgPorEmpacador,
        orden: i + 1
      })),
      supervisores: this.maquinasEnUso().map((m) => ({
        maquinaId: m.id,
        maquinaNombre: null,
        supervisorId: this.supervisorDe(m.id),
        supervisorNombre: null,
        observacion: this.observacionDe(m.id).trim() || null,
        almuerzo: this.almuerzoDe(m.id)
      }))
    };
  }

  guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.snackBar.open('Revisa los campos marcados en rojo', 'Cerrar', { duration: 3000 });
      return;
    }

    if (this.esEdicion && this.procesoEstado() === 'CERRADO' && !this.form.getRawValue().motivoAjuste) {
      this.snackBar.open('Este proceso ya esta cerrado: indica un motivo para editar este corte', 'Cerrar', { duration: 4000 });
      return;
    }

    this.guardando.set(true);
    const request = this.construirRequest();

    const accion$ = this.esEdicion
      ? this.corteService.actualizar(this.procesoDiarioId, this.corteId!, request)
      : this.corteService.crear(this.procesoDiarioId, request);

    accion$.subscribe({
      next: () => {
        this.guardando.set(false);
        this.snackBar.open(this.esEdicion ? 'Corte actualizado' : 'Corte guardado', 'Cerrar', { duration: 3000 });
        this.volver();
      },
      error: (err) => {
        this.guardando.set(false);
        this.snackBar.open(err.error?.message ?? 'Error al guardar el corte', 'Cerrar', { duration: 4000 });
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
