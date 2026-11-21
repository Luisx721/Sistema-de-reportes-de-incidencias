import { Component, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  template: `
    <!-- Acceso directo al contenido -->
    <a class="skip-link" href="#contenido">Saltar al contenido</a>

    <!-- Aviso de demostración -->
    <div class="demo-bar">
      <div class="wrap">
        <span>
          <i></i>
          PROTOTIPO INTERACTIVO
        </span>
        <span>Datos de ejemplo · Los reportes se guardan solo en este navegador</span>
      </div>
    </div>

    <!-- Encabezado y navegación -->
    <header class="site-header">
      <div class="wrap header-inner">
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
        <button
          class="menu-toggle"
          type="button"
          aria-controls="main-nav"
          [attr.aria-expanded]="menuOpen"
          [attr.aria-label]="menuOpen ? 'Cerrar menú' : 'Abrir menú'"
          (click)="toggleMenu()"
        >
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
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <nav
          id="main-nav"
          class="main-nav"
          [class.open]="menuOpen"
          aria-label="Navegación principal"
        >
          <a
            routerLink="/"
            routerLinkActive
            #rlaHome="routerLinkActive"
            [routerLinkActiveOptions]="{ exact: true }"
            [attr.aria-current]="rlaHome.isActive ? 'page' : null"
            (click)="closeMenu()"
          >
            Inicio
          </a>
          <a
            routerLink="/incidencias"
            routerLinkActive
            #rlaIncidencias="routerLinkActive"
            [attr.aria-current]="rlaIncidencias.isActive ? 'page' : null"
            (click)="closeMenu()"
          >
            Incidencias
          </a>
          <a
            routerLink="/seguimiento"
            routerLinkActive
            #rlaSeguimiento="routerLinkActive"
            [attr.aria-current]="rlaSeguimiento.isActive ? 'page' : null"
            (click)="closeMenu()"
          >
            Seguimiento
          </a>
          <a
            routerLink="/ayuda"
            routerLinkActive
            #rlaAyuda="routerLinkActive"
            [attr.aria-current]="rlaAyuda.isActive ? 'page' : null"
            (click)="closeMenu()"
          >
            Cómo reportar
          </a>
          <a
            routerLink="/admin"
            routerLinkActive
            #rlaAdmin="routerLinkActive"
            [attr.aria-current]="rlaAdmin.isActive ? 'page' : null"
            (click)="closeMenu()"
          >
            Administración
          </a>

          @if (authService.user(); as u) {
            <span class="nav-account" title="Sesión activa · Reportante">{{ u.name }}</span>
            <button (click)="logout()" class="text-button" type="button">Salir</button>
          } @else {
            <a
              class="nav-account"
              routerLink="/login"
              routerLinkActive
              #rlaLogin="routerLinkActive"
              [attr.aria-current]="rlaLogin.isActive ? 'page' : null"
              (click)="closeMenu()"
            >
              Iniciar sesión
            </a>
          }

          <a routerLink="/reporte" class="button button-small" (click)="closeMenu()">
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
              <path d="M12 5v14M5 12h14" />
            </svg>
            Reportar
          </a>
        </nav>
      </div>
    </header>
  `,
})
export class HeaderComponent {
  authService = inject(AuthService);
  private router = inject(Router);
  menuOpen = false;

  toggleMenu(): void {
    this.menuOpen = !this.menuOpen;
  }

  closeMenu(): void {
    this.menuOpen = false;
  }

  logout(): void {
    this.authService.endSession();
    this.closeMenu();
    this.router.navigate(['/']);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.menuOpen) {
      this.menuOpen = false;
    }
  }
}
