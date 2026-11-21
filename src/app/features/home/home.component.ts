import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DataService } from '../../core/services/data.service';
import { IncidentReport } from '../../core/models/incident.model';
import { BadgeComponent } from '../../shared/components/badge/badge.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink, BadgeComponent],
  template: `
    <main id="contenido" class="wrap main-content">
      <!-- Bienvenida al portal -->
      <section class="hero">
        <div class="hero-copy">
          <p class="eyebrow light">CUIDEMOS NUESTRO CAMPUS</p>
          <h1>
            Tu reporte hace
            <br />
            la diferencia.
          </h1>
          <p>
            Un espacio para comunicar problemas de infraestructura y seguir su atención,
            paso a paso.
          </p>
          <div class="hero-actions">
            <a class="button button-white" routerLink="/reporte">
              Reportar incidencia
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
            <a class="hero-link" routerLink="/seguimiento">Consultar un código</a>
          </div>
          <span class="hero-note">
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
              <path d="m5 12 4 4L19 6" />
            </svg>
            Puedes reportar sin crear una cuenta
          </span>
        </div>
        <div class="hero-visual">
          <svg
            class="campus-art"
            viewBox="0 0 480 340"
            role="img"
            aria-label="Ilustración de edificios del campus"
          >
            <defs>
              <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
                <path d="M32 0H0V32" fill="none" stroke="white" opacity=".09" />
              </pattern>
            </defs>
            <rect width="480" height="340" fill="url(#grid)" />
            <g transform="translate(45 44)">
              <path d="m0 181 195-105 195 105-195 106Z" fill="#fff" opacity=".12" />
              <path
                d="m52 151 144-77 144 77-144 77Z"
                fill="none"
                stroke="#fff"
                opacity=".35"
              />
              <g fill="#fff1e7" stroke="#a22929" stroke-width="2">
                <path d="m58 120 74-40 74 40-74 40Z" />
                <path d="M58 120v62l74 40v-62Z" />
                <path d="m132 160 74-40v62l-74 40Z" />
                <path d="m210 104 64-35 64 35-64 35Z" />
                <path d="M210 104v47l64 35v-47Z" />
                <path d="m274 139 64-35v47l-64 35Z" />
              </g>
              <g fill="#a22929">
                <path
                  d="m74 143 12 6v17l-12-6Zm25 13 12 6v17l-12-6Zm48 20 12-6v17l-12 6Zm25-13 12-6v17l-12 6Zm53-37 12 6v13l-12-6Zm25 13 12 6v13l-12-6Z"
                />
              </g>
              <g fill="#f8d7b4">
                <circle cx="41" cy="199" r="14" />
                <circle cx="341" cy="189" r="17" />
                <circle cx="297" cy="231" r="12" />
              </g>
              <g stroke="white" stroke-width="2" opacity=".65">
                <path d="M41 199v23m300-33v28m-44 14v21" />
              </g>
              <circle cx="187" cy="45" r="27" fill="white" />
              <path
                d="m175 45 8 8 16-17"
                fill="none"
                stroke="#a60000"
                stroke-width="4"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </g>
          </svg>
          <div class="campus-caption">
            <span class="live-dot"></span>
            Facultad Multidisciplinaria Oriental
            <small>Ilustración del campus</small>
          </div>
        </div>
      </section>

      <!-- Accesos rápidos -->
      <section class="quick-paths" aria-label="Accesos rápidos">
        <a routerLink="/reporte">
          <span class="path-icon">
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
          </span>
          <div>
            <h2>Reporta un problema</h2>
            <p>Cuéntanos qué pasó y dónde.</p>
          </div>
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
        <a routerLink="/seguimiento">
          <span class="path-icon">
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
          </span>
          <div>
            <h2>Revisa el seguimiento</h2>
            <p>Consulta el historial con tu código.</p>
          </div>
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
        <a routerLink="/incidencias" [queryParams]="{ vista: 'mapa' }">
          <span class="path-icon">
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
              <path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" />
              <circle cx="12" cy="10" r="2" />
            </svg>
          </span>
          <div>
            <h2>Explora el campus</h2>
            <p>Ubica las incidencias de ejemplo.</p>
          </div>
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
      </section>

      <!-- Incidencias recientes -->
      <section class="section">
        <div class="section-heading">
          <div>
            <p class="eyebrow">VISIBILIDAD DEL PROCESO</p>
            <h2>Lo que pasa en el campus</h2>
            <p>Una vista pública, sin datos personales.</p>
          </div>
          <a class="text-link" routerLink="/incidencias">
            Ver incidencias
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

        <div class="incident-list">
          @if (loading) {
            <p class="empty-state" role="status">Cargando incidencias…</p>
          } @else if (error) {
            <div class="empty-state" role="alert">
              <h2>No pudimos cargar la información</h2>
              <p>No se pudo acceder a los reportes locales. Comprueba los permisos de almacenamiento.</p>
            </div>
          } @else if (recentReports.length === 0) {
            <div class="empty-state">
              <p>No hay incidencias registradas todavía.</p>
            </div>
          } @else {
            @for (r of recentReports; track r.code) {
              <a
                class="incident-row"
                [routerLink]="['/seguimiento']"
                [queryParams]="{ codigo: r.code }"
              >
                <span class="row-icon">
                  <svg
                    class="icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.7"
                    aria-hidden="true"
                  >
                    <path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" />
                    <circle cx="12" cy="10" r="2" />
                  </svg>
                </span>
                <div>
                  <h3>{{ r.category }} · {{ dataService.locationName(r.location) }}</h3>
                  <p>
                    <span>{{ r.code }}</span>
                    <span>{{ dataService.formatDate(r.created) }}</span>
                    @if (r.sample) {
                      <span>Ejemplo</span>
                    }
                  </p>
                </div>
                <app-badge [state]="r.state" />
                <svg
                  class="icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.7"
                  aria-hidden="true"
                >
                  <path d="M5 12h14m-6-6 6 6-6 6" />
                </svg>
              </a>
            }
          }
        </div>
      </section>

      <!-- Enlace a la guía -->
      <section class="orientation-banner">
        <span class="path-icon">
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
            <path d="M12 5v15M3 4c3-1 6-1 9 1 3-2 6-2 9-1v15c-3-1-6-1-9 1-3-2-6-2-9-1Z" />
          </svg>
        </span>
        <div>
          <h2>Un reporte claro ayuda a atender mejor.</h2>
          <p>Revisa qué información incluir y cómo consultar una respuesta.</p>
        </div>
        <a class="button button-outline" routerLink="/ayuda">
          Cómo reportar
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
      </section>
    </main>
  `,
})
export class HomeComponent implements OnInit {
  dataService = inject(DataService);
  recentReports: IncidentReport[] = [];
  loading = true;
  error = false;

  async ngOnInit(): Promise<void> {
    try {
      await this.dataService.seed();
      const all = await this.dataService.getReports();
      all.sort((a, b) => b.created.localeCompare(a.created));
      this.recentReports = all.slice(0, 3);
    } catch (err) {
      this.error = true;
    } finally {
      this.loading = false;
    }
  }
}
