import { Component } from '@angular/core';

/**
 * Franja de marca del login: nombre de la app, título y (en escritorio) dos
 * puntos de lo que hace. Es solo presentación; los colores llegan como variables
 * (--banda-fondo, --banda-texto, --banda-sutil, --motivo-punto) que define el
 * login según el tema activo.
 */
@Component({
  selector: 'app-login-marca',
  standalone: true,
  template: `
    <header class="marca">
      <svg class="marca__motivo" viewBox="0 0 200 200" aria-hidden="true" focusable="false">
        <circle cx="100" cy="100" r="96" />
        <path d="M100 30V12M170 100H188M100 170V188M30 100H12" />
        <path
          d="M144 23.8L138 34.2M176.2 56L165.8 62M176.2 144L165.8 138M144 176.2L138 165.8M56 176.2L62 165.8M23.8 144L34.2 138M23.8 56L34.2 62M56 23.8L62 34.2"
        />
        <path d="M100 100L55 74" />
        <circle class="marca__punto" cx="55" cy="74" r="7" />
      </svg>

      <span class="marca__logo">BetaApp</span>

      <div class="marca__textos">
        <p class="marca__empresa">Beta Agroindustrial</p>
        <h1 class="marca__titulo">Avance de producción</h1>
        <p class="marca__lema">Corte de hora de las líneas de arándano</p>

        <ul class="marca__puntos">
          @for (p of puntos; track p.titulo) {
            <li class="punto">
              <span class="punto__icono">
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path [attr.d]="p.trazo" /></svg>
              </span>
              <div>
                <p class="punto__titulo">{{ p.titulo }}</p>
                <p class="punto__detalle">{{ p.detalle }}</p>
              </div>
            </li>
          }
        </ul>
      </div>
    </header>
  `,
  styleUrl: './login-marca.component.scss'
})
export class LoginMarcaComponent {
  /** Datos de dominio, no de diseño: se cambian aquí sin tocar plantilla ni estilos. */
  protected readonly puntos = [
    {
      titulo: 'Variedad, máquina y Kato desde catálogo',
      detalle: 'Sin texto libre, para que los consolidados no se rompan por errores de tipeo.',
      trazo: 'M9 6h12M9 12h12M9 18h12M3 6l1.5 1.5L7 5M3 12l1.5 1.5L7 11M3 18l1.5 1.5L7 17'
    },
    {
      titulo: 'Reporte del corte en imagen',
      detalle: 'La imagen se genera sola, sin armar el formato a mano.',
      trazo: 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM3 15l5-5 4 4 3-3 6 6M9 8h.01'
    }
  ] as const;
}
