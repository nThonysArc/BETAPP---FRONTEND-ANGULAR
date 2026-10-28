import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { HttpErrorResponse } from '@angular/common/http';

import { AuthService } from '../../core/auth/auth.service';
import { ErrorResponse } from '../../core/models/error-response.model';
import { ThemeSwitchComponent } from '../../shared/theme-switch/theme-switch.component';
import { LoginMarcaComponent } from './login-marca.component';

type CampoLogin = 'email' | 'password';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    ThemeSwitchComponent,
    LoginMarcaComponent
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly cargando = signal(false);
  readonly errorMensaje = signal<string | null>(null);
  readonly mostrarPassword = signal(false);

  readonly form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]]
  });

  togglePassword(): void {
    this.mostrarPassword.update((v) => !v);
  }

  /** El error de un campo se muestra solo después de tocarlo, igual que antes. */
  protected invalido(campo: CampoLogin): boolean {
    const control = this.form.controls[campo];
    return control.invalid && control.touched;
  }

  protected mensajeEmail(): string {
    return this.form.controls.email.hasError('required')
      ? 'Ingresa tu correo electrónico'
      : 'Escribe un correo válido, por ejemplo nombre@empresa.com';
  }

  onSubmit(): void {
    if (this.cargando()) return;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.cargando.set(true);
    this.errorMensaje.set(null);

    const { email, password } = this.form.getRawValue();

    this.authService.login({ email: email!, password: password! }).subscribe({
      next: () => {
        this.cargando.set(false);
        this.router.navigate(['/']);
      },
      error: (err: HttpErrorResponse) => {
        this.cargando.set(false);
        const body = err.error as ErrorResponse | undefined;
        this.errorMensaje.set(body?.message ?? 'No se pudo iniciar sesión. Inténtalo de nuevo.');
      }
    });
  }
}
