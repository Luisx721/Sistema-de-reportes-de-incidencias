import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../../application/services/auth.service';

@Component({
  selector: 'app-registro',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './registro.component.html',
})
export class RegistroComponent {
  // Dependencias y estado de la vista

  private changeDetector = inject(ChangeDetectorRef);

  private authService = inject(AuthService);
  private router = inject(Router);

  fullName = '';
  email = '';
  universityRole = '';
  password = '';
  confirmPassword = '';

  showPassword = false;
  showConfirmPassword = false;
  authStatus = '';

  errors: {
    fullName?: string;
    email?: string;
    universityRole?: string;
    password?: string;
    confirmPassword?: string;
  } = {};

  async submitRegister(): Promise<void> {
    try {
      this.authStatus = '';
      this.errors = {
        fullName: this.fullName.trim().length < 2 ? 'Ingresa tu nombre.' : '',
        email: !this.email.trim()
          ? 'Ingresa tu correo electrónico.'
          : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email.trim())
            ? 'Ingresa un correo electrónico válido.'
            : '',
        universityRole: !this.universityRole ? 'Selecciona tu vínculo con la universidad.' : '',
        password:
          this.password.length < 8 ? 'Usa al menos 8 caracteres para esta demostración.' : '',
        confirmPassword:
          this.confirmPassword !== this.password || !this.confirmPassword
            ? 'Las contraseñas deben coincidir.'
            : '',
      };

      const firstKey = (Object.keys(this.errors) as (keyof typeof this.errors)[]).find(
        (k) => !!this.errors[k],
      );

      if (firstKey) {
        document.getElementById(firstKey)?.focus();
        return;
      }

      try {
        await this.authService.register(this.fullName, this.email, this.password);
        this.router.navigate(['/']);
      } catch (error) {
        this.authStatus =
          error instanceof Error ? error.message : 'No se pudo guardar la cuenta local';
      }
    } finally {
      this.changeDetector.markForCheck();
    }
  }
}
