import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../../application/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.component.html',
})
export class LoginComponent {
  // Dependencias y estado de la vista

  private changeDetector = inject(ChangeDetectorRef);

  private authService = inject(AuthService);
  private router = inject(Router);

  email = '';
  password = '';
  showPassword = false;
  authStatus = '';
  isSubmitting = false;

  errors: { email?: string; password?: string } = {};

  async submitLogin(): Promise<void> {
    if (this.isSubmitting) return;
    this.isSubmitting = true;
    try {
      this.authStatus = '';
      this.errors = {
        email: !this.email.trim() ? 'Ingresa tu usuario o correo.' : '',
        password: !this.password ? 'Ingresa tu contraseña.' : '',
      };

      if (this.errors.email || this.errors.password) {
        const firstId = this.errors.email ? 'email' : 'password';
        document.getElementById(firstId)?.focus();
        return;
      }

      try {
        if (!(await this.authService.login(this.email, this.password))) {
          this.authStatus = 'Usuario o contraseña incorrectos o cuenta desactivada.';
          return;
        }
        this.router.navigate([
          this.authService.user()?.profile === 'Administrador' ? '/admin' : '/panel',
        ]);
      } catch (error: any) {
        this.authStatus = error?.status === 403
          ? 'Tu cuenta no tiene autorización para iniciar sesión (403).'
          : error?.status === 401
            ? 'Usuario o contraseña incorrectos (401).'
            : error?.status === 0
              ? 'No se pudo conectar con la API de sesiones.'
              : 'No se pudo abrir la sesión.';
      }
    } finally {
      this.isSubmitting = false;
      this.changeDetector.markForCheck();
    }
  }
}
