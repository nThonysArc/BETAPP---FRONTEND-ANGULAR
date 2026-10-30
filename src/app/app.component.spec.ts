import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from './core/auth/auth.service';
import { AppComponent } from './app.component';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()]
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should only host the router outlet (no starter template content)', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('router-outlet')).not.toBeNull();
    expect(compiled.querySelector('h1')).toBeNull();
    // Ademas del router, solo la franja de estado de conexion.
    expect(compiled.querySelector('app-offline-banner')).not.toBeNull();
  });

  it('pide confirmacion al recargar solo cuando hay sesion', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const auth = TestBed.inject(AuthService);
    const evento = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;

    const espia = spyOn(auth, 'estaAutenticado').and.returnValue(false);
    fixture.componentInstance.confirmarRecarga(evento);
    expect(evento.defaultPrevented).toBeFalse();

    espia.and.returnValue(true);
    fixture.componentInstance.confirmarRecarga(evento);
    expect(evento.defaultPrevented).toBeTrue();
  });
});
