import {
  Component,
  OnInit,
  OnDestroy,
  AfterViewInit,
  ElementRef,
  ViewChild,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DataService } from '../../core/services/data.service';
import { IncidentReport, CampusLocation } from '../../core/models/incident.model';
import { BadgeComponent } from '../../shared/components/badge/badge.component';
import * as L from 'leaflet';

@Component({
  selector: 'app-incidencias',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, BadgeComponent],
  template: `
    <main id="contenido" class="wrap main-content">
      <header class="page-heading">
        <p class="eyebrow">EXPLORA EL CAMPUS</p>
        <h1>Incidencias a la vista.</h1>
        <p>
          Explora ejemplos y reportes guardados en este navegador. Esta vista no
          representa información real de la universidad.
        </p>
      </header>

      <!-- Filtros y selección de vista -->
      <div class="explore-toolbar">
        <div class="filters">
          <div class="field">
            <label for="filter-category">Categoría</label>
            <select
              id="filter-category"
              [(ngModel)]="selectedCategory"
              (ngModelChange)="onFilterChange()"
            >
              <option value="">Todas las categorías</option>
              @for (cat of dataService.categories; track cat) {
                <option [value]="cat">{{ cat }}</option>
              }
            </select>
          </div>
          <div class="field">
            <label for="filter-location">Ubicación</label>
            <select
              id="filter-location"
              [(ngModel)]="selectedLocationId"
              (ngModelChange)="onFilterChange()"
            >
              <option value="">Todas las ubicaciones</option>
              @for (loc of dataService.locations; track loc.id) {
                <option [value]="loc.id">{{ loc.name }}</option>
              }
            </select>
          </div>
          <div class="field">
            <label for="filter-status">Estado</label>
            <select
              id="filter-status"
              [(ngModel)]="selectedStatus"
              (ngModelChange)="onFilterChange()"
            >
              <option value="">Todos los estados</option>
              @for (st of dataService.states; track st) {
                <option [value]="st">{{ st }}</option>
              }
            </select>
          </div>
        </div>

        <div class="view-switch" aria-label="Vista de incidencias">
          <button
            type="button"
            id="list-view"
            [attr.aria-pressed]="!isMapView"
            (click)="setView(false)"
          >
            Listado
          </button>
          <button
            type="button"
            id="map-view"
            [attr.aria-pressed]="isMapView"
            (click)="setView(true)"
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
              <path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" />
              <circle cx="12" cy="10" r="2" />
            </svg>
            Mapa
          </button>
        </div>
      </div>

      <!-- Cantidad de resultados -->
      <div class="results-meta">
        <p id="result-count" role="status">
          {{ filteredReports.length }} incidencia{{ filteredReports.length === 1 ? '' : 's' }} · datos de demostración
        </p>
        <button class="text-button" id="clear-filters" type="button" (click)="clearFilters()">
          Limpiar filtros
        </button>
      </div>

      <!-- Listado de incidencias -->
      <section id="list-panel" [hidden]="isMapView" aria-label="Listado de incidencias">
        <div id="incident-results" class="incident-list">
          @if (filteredReports.length === 0) {
            <div class="empty-state">
              <h2>No hay coincidencias</h2>
              <p>Prueba otra combinación de filtros.</p>
            </div>
          } @else {
            @for (r of filteredReports; track r.code) {
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

      <!-- Mapa de incidencias (OpenStreetMap) -->
      <section id="map-panel" [hidden]="!isMapView" aria-label="Mapa de incidencias">
        <div class="map-notice">
          Mapa interactivo con OpenStreetMap · Ubicaciones del campus universitario (Facultad Multidisciplinaria Oriental, UES).
        </div>
        <div class="map-layout">
          <!-- Vista del mapa OpenStreetMap -->
          <div #mapContainer class="campus-map" id="campus-map"></div>

          <!-- Incidencias de la ubicación seleccionada -->
          <aside id="map-detail" class="map-detail">
            @if (activeLocationReports.length > 0 && selectedMarkerLocation) {
              <p class="eyebrow">UBICACIÓN SELECCIONADA</p>
              <h2>{{ selectedMarkerLocation.name }}</h2>
              <p>{{ activeLocationReports.length }} incidencia(s) con estos filtros.</p>
              @for (r of activeLocationReports; track r.code) {
                <a
                  class="map-result"
                  [routerLink]="['/seguimiento']"
                  [queryParams]="{ codigo: r.code }"
                >
                  <app-badge [state]="r.state" />
                  <h3>{{ r.category }}</h3>
                  <small>{{ r.code }} →</small>
                </a>
              }
            } @else {
              <h2>{{ filteredReports.length ? 'Selecciona una ubicación' : 'No hay coincidencias' }}</h2>
              <p>
                {{
                  filteredReports.length
                    ? 'Toca un marcador en el mapa para ver sus incidencias. También puedes usar el listado.'
                    : 'Prueba otra combinación de filtros.'
                }}
              </p>
            }
          </aside>
        </div>
      </section>
    </main>
  `,
})
export class IncidenciasComponent implements OnInit, AfterViewInit, OnDestroy {
  dataService = inject(DataService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  @ViewChild('mapContainer') mapContainerRef?: ElementRef<HTMLDivElement>;

  allReports: IncidentReport[] = [];
  filteredReports: IncidentReport[] = [];

  selectedCategory = '';
  selectedLocationId = '';
  selectedStatus = '';

  isMapView = false;
  selectedMarkerLocation: CampusLocation | null = null;
  activeLocationReports: IncidentReport[] = [];

  private osmMap: L.Map | null = null;
  private markerGroup: L.LayerGroup | null = null;

  async ngOnInit(): Promise<void> {
    this.route.queryParamMap.subscribe((params) => {
      this.isMapView = params.get('vista') === 'mapa';
      if (this.isMapView && this.osmMap) {
        setTimeout(() => this.osmMap?.invalidateSize(), 100);
      }
    });

    try {
      await this.dataService.seed();
      const reports = await this.dataService.getReports();
      reports.sort((a, b) => b.created.localeCompare(a.created));
      this.allReports = reports;
      this.applyFilters();
    } catch (e) {
      console.error('Error loading reports', e);
    }
  }

  ngAfterViewInit(): void {
    if (this.isMapView) {
      setTimeout(() => this.initMap(), 50);
    }
  }

  ngOnDestroy(): void {
    if (this.osmMap) {
      this.osmMap.remove();
      this.osmMap = null;
    }
  }

  setView(isMap: boolean): void {
    this.isMapView = isMap;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: isMap ? { vista: 'mapa' } : { vista: null },
      queryParamsHandling: 'merge',
    });

    if (isMap) {
      if (!this.osmMap) {
        setTimeout(() => this.initMap(), 50);
      } else {
        setTimeout(() => {
          this.osmMap?.invalidateSize();
          this.renderOsmMarkers();
        }, 80);
      }
    }
  }

  onFilterChange(): void {
    this.applyFilters();
  }

  clearFilters(): void {
    this.selectedCategory = '';
    this.selectedLocationId = '';
    this.selectedStatus = '';
    this.applyFilters();
  }

  private applyFilters(): void {
    this.filteredReports = this.allReports.filter((r) => {
      const matchCat = !this.selectedCategory || r.category === this.selectedCategory;
      const matchLoc = !this.selectedLocationId || r.location === this.selectedLocationId;
      const matchStatus = !this.selectedStatus || r.state === this.selectedStatus;
      return matchCat && matchLoc && matchStatus;
    });

    // Check if the current selected location is still valid
    if (this.selectedLocationId) {
      const loc = this.dataService.locations.find((l) => l.id === this.selectedLocationId);
      if (loc && this.filteredReports.some((r) => r.location === loc.id)) {
        this.selectLocation(loc, false);
      } else {
        this.selectedMarkerLocation = null;
        this.activeLocationReports = [];
      }
    } else if (this.selectedMarkerLocation) {
      const stillHas = this.filteredReports.some((r) => r.location === this.selectedMarkerLocation?.id);
      if (stillHas) {
        this.selectLocation(this.selectedMarkerLocation, false);
      } else {
        this.selectedMarkerLocation = null;
        this.activeLocationReports = [];
      }
    }

    if (this.isMapView) {
      this.renderOsmMarkers();
    }
  }

  private initMap(): void {
    const el = document.getElementById('campus-map');
    if (this.osmMap || !el) return;

    const campusCenter: L.LatLngExpression = [13.4404, -88.1583];
    this.osmMap = L.map(el, {
      center: campusCenter,
      zoom: 17,
      minZoom: 15,
      maxZoom: 19,
      scrollWheelZoom: true,
    });

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
    }).addTo(this.osmMap);

    this.markerGroup = L.layerGroup().addTo(this.osmMap);
    this.renderOsmMarkers();
    setTimeout(() => this.osmMap?.invalidateSize(), 100);
  }

  private selectLocation(loc: CampusLocation, shouldPan = false): void {
    this.selectedMarkerLocation = loc;
    this.activeLocationReports = this.filteredReports.filter((r) => r.location === loc.id);

    if (shouldPan && this.osmMap && loc.lat && loc.lng) {
      this.osmMap.panTo([loc.lat, loc.lng]);
    }
    this.renderOsmMarkers();
  }

  private renderOsmMarkers(): void {
    if (!this.osmMap || !this.markerGroup) return;
    this.markerGroup.clearLayers();

    for (const loc of this.dataService.locations) {
      const count = this.filteredReports.filter((r) => r.location === loc.id).length;
      if (!count || !loc.lat || !loc.lng) continue;

      const isSelected = this.selectedMarkerLocation?.id === loc.id;
      const customIcon = L.divIcon({
        className: 'osm-marker-wrapper',
        html: `
          <button
            type="button"
            class="map-marker ${isSelected ? 'is-selected' : ''}"
            data-location="${loc.id}"
            aria-label="${loc.name}: ${count} incidencia(s)"
            aria-pressed="${isSelected}"
          >
            <b>${count}</b>
            <span>${loc.name}</span>
          </button>
        `,
        iconSize: [110, 60],
        iconAnchor: [55, 18],
      });

      const marker = L.marker([loc.lat, loc.lng], {
        icon: customIcon,
        title: `${loc.name}: ${count} incidencia(s)`,
      });

      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        this.selectLocation(loc, true);
      });

      this.markerGroup.addLayer(marker);
    }
  }
}
