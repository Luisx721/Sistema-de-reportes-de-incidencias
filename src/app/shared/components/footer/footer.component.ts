import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [RouterLink],
  template: `
    <footer class="site-footer">
      <div class="wrap footer-inner">
        <div>
          <strong>Un campus mejor empieza contigo.</strong>
          <p>Infraestructura · Facultad Multidisciplinaria Oriental, UES</p>
        </div>
        <a routerLink="/ayuda">
          ¿Necesitas orientación?
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
      </div>
    </footer>
  `,
})
export class FooterComponent {}
