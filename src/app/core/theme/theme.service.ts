import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';

export type TemaApp = 'light' | 'dark' | 'planta';

export const TEMAS: ReadonlyArray<{ id: TemaApp; nombre: string; icono: string }> = [
  { id: 'light', nombre: 'Claro', icono: 'light_mode' },
  { id: 'dark', nombre: 'Oscuro', icono: 'dark_mode' },
  { id: 'planta', nombre: 'Planta (alto contraste)', icono: 'contrast' }
];

const CLAVE_ALMACENAMIENTO = 'beta-theme';

/**
 * Gestiona el tema visual. El atributo data-theme del <html> activa los
 * tokens de beta-tokens.css; la elección se guarda en el dispositivo y
 * index.html la aplica antes de pintar para evitar el parpadeo.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);

  readonly tema = signal<TemaApp>(this.leerTemaInicial());

  cambiar(tema: TemaApp): void {
    this.tema.set(tema);
    this.document.documentElement.setAttribute('data-theme', tema);
    try {
      localStorage.setItem(CLAVE_ALMACENAMIENTO, tema);
    } catch {
      // Almacenamiento no disponible (modo privado): el tema vale solo para esta sesión.
    }
  }

  private leerTemaInicial(): TemaApp {
    const actual = this.document.documentElement.getAttribute('data-theme');
    return actual === 'dark' || actual === 'planta' ? actual : 'light';
  }
}
