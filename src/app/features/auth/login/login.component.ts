import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="auth-body">
      <!-- Acceso directo al contenido -->
      <a class="skip-link" href="#auth-form">Saltar al formulario</a>

      <!-- Estructura de acceso al portal -->
      <main class="auth-layout">
        <!-- Identidad y bienvenida -->
        <section class="auth-welcome">
          <a class="brand" routerLink="/" aria-label="Sistema de Reportes UES, inicio">
            <img src="files/images/logo.png" alt="Logo del sistema" />
            <span>
              <small>UNIVERSIDAD DE EL SALVADOR</small>
              <strong>
                Reportes
                <span class="brand-accent">UES</span>
              </strong>
            </span>
          </a>
          <div class="auth-welcome-copy">
            <p class="eyebrow light">COMUNIDAD UNIVERSITARIA</p>
            <h1>
              Un mejor campus.
              <br />
              Comienza contigo.
            </h1>
            <p>
              Ayúdanos a cuidar los espacios que compartimos. Reporta un problema y consulta
              su atención.
            </p>
          </div>

          <!-- Accesos sin cuenta -->
          <nav class="auth-quick" aria-label="Accesos públicos">
            <a routerLink="/seguimiento">
              <svg
                class="icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.7"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <circle cx="10.5" cy="10.5" r="6.5" />
                <path d="m16 16 4 4" />
              </svg>
              Consultar reporte
            </a>
            <a routerLink="/ayuda">
              <svg
                class="icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.7"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path
                  d="M12 5v15M3 4c3-1 6-1 9 1 3-2 6-2 9-1v15c-3-1-6-1-9 1-3-2-6-2-9-1Z"
                />
              </svg>
              Cómo reportar
            </a>
          </nav>
          <p class="auth-welcome-foot">Facultad Multidisciplinaria Oriental · UES</p>
        </section>

        <!-- Datos de acceso -->
        <section class="auth-form-panel">
          <a class="auth-back" routerLink="/">← Volver al portal</a>
          <div class="auth-heading">
            <p class="eyebrow">BIENVENIDO DE NUEVO</p>
            <h2>Iniciar sesión</h2>
            <p>Ingresa tus datos para acceder a la demostración.</p>
          </div>

          <!-- Acceso como invitado -->
          <a class="button button-outline guest-button" routerLink="/">
            Continuar como invitado
            <svg
              class="icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.7"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M5 12h14m-6-6 6 6-6 6" />
            </svg>
          </a>
          <p class="guest-hint">Puedes reportar y consultar sin crear una cuenta.</p>
          <div class="auth-divider"><span>o inicia sesión</span></div>

          <!-- Mensajes de validación -->
          @if (authStatus) {
            <div id="auth-status" class="form-status" role="alert">
              {{ authStatus }}
            </div>
          }

          <!-- Formulario de inicio de sesión -->
          <form id="auth-form" novalidate (ngSubmit)="submitLogin()">
            <div class="field">
              <label for="email">Correo electrónico</label>
              <div class="auth-input">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autocomplete="email"
                  placeholder="nombre@ejemplo.com"
                  [(ngModel)]="email"
                  (ngModelChange)="errors.email = ''"
                  [attr.aria-invalid]="!!errors.email"
                  aria-describedby="email-error"
                  required
                />
              </div>
              @if (errors.email) {
                <span class="field-error" id="email-error">{{ errors.email }}</span>
              }
            </div>

            <div class="field">
              <label for="password">Contraseña</label>
              <div class="auth-input">
                <input
                  id="password"
                  name="password"
                  [type]="showPassword ? 'text' : 'password'"
                  autocomplete="current-password"
                  placeholder="Ingresa tu contraseña"
                  [(ngModel)]="password"
                  (ngModelChange)="errors.password = ''"
                  [attr.aria-invalid]="!!errors.password"
                  aria-describedby="password-error"
                  required
                />
                <button
                  type="button"
                  class="password-toggle"
                  (click)="showPassword = !showPassword"
                  [attr.aria-label]="showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'"
                >
                  {{ showPassword ? 'Ocultar' : 'Mostrar' }}
                </button>
              </div>
              @if (errors.password) {
                <span class="field-error" id="password-error">{{ errors.password }}</span>
              }
            </div>

            <button class="button" type="submit">
              Iniciar sesión
              <svg
                class="icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.7"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="M5 12h14m-6-6 6 6-6 6" />
              </svg>
            </button>
          </form>

          <!-- Enlace entre inicio y registro -->
          <p class="auth-switch">
            ¿No tienes cuenta?
            <a routerLink="/registro">Regístrate</a>
          </p>

          <!-- Aviso sobre la cuenta de demostración -->
          <p class="auth-disclaimer">
            Versión de demostración: no se crean cuentas reales ni se guardan contraseñas.
          </p>
        </section>
      </main>
    </div>
  `,
})
export class LoginComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  email = '';
  password = '';
  showPassword = false;
  authStatus = '';

  errors: { email?: string; password?: string } = {};

  submitLogin(): void {
    this.authStatus = '';
    this.errors = {
      email: !this.email.trim()
        ? 'Ingresa tu correo electrónico.'
        : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email.trim())
          ? 'Ingresa un correo electrónico válido.'
          : '',
      password: !this.password ? 'Ingresa tu contraseña.' : '',
    };

    if (this.errors.email || this.errors.password) {
      const firstId = this.errors.email ? 'email' : 'password';
      document.getElementById(firstId)?.focus();
      return;
    }

    try {
      this.authService.startSession({ name: 'Reportante' });
      this.router.navigate(['/']);
    } catch {
      this.authStatus =
        'No se pudo abrir la sesión de demostración. Puedes continuar como invitado.';
    }
  }
}
