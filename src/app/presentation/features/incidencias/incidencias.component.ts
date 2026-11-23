import { ChangeDetectorRef } from '@angular/core';
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
import { DataService } from '../../../application/services/data.service';
import { IncidentReport, CampusLocation } from '../../../domain/models/incident.model';
import { BadgeComponent } from '../../shared/components/badge/badge.component';
import * as L from 'leaflet';

@Component({
  selector: 'app-incidencias',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, BadgeComponent],
  templateUrl: './incidencias.component.html',
})
export class IncidenciasComponent implements OnInit, AfterViewInit, OnDestroy {
  // Dependencias y estado de la vista

  private changeDetector = inject(ChangeDetectorRef);

  loadError = '';
  mapError = '';
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
    try {
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
        this.loadError = 'No se pudieron cargar los reportes. Recarga la página para reintentar.';
      }
    } finally {
      this.changeDetector.markForCheck();
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

    // Conservar la seleccion del mapa solo mientras pertenece al resultado filtrado
    if (this.selectedLocationId) {
      const loc = this.dataService.locations.find((l) => l.id === this.selectedLocationId);
      if (loc && this.filteredReports.some((r) => r.location === loc.id)) {
        this.selectLocation(loc, false);
      } else {
        this.selectedMarkerLocation = null;
        this.activeLocationReports = [];
      }
    } else if (this.selectedMarkerLocation) {
      const stillHas = this.filteredReports.some(
        (r) => r.location === this.selectedMarkerLocation?.id,
      );
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
    })
      .on('tileerror', () => {
        this.mapError =
          'No se pudo cargar el fondo del mapa. Puedes consultar todas las incidencias en la lista.';
        this.changeDetector.markForCheck();
      })
      .addTo(this.osmMap);

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
      // Construir etiquetas como texto para no interpretar nombres del catalogo como HTML
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'map-marker' + (isSelected ? ' is-selected' : '');
      button.dataset['location'] = loc.id;
      button.setAttribute('aria-label', loc.name + ': ' + count + ' incidencias');
      button.setAttribute('aria-pressed', String(isSelected));
      const number = document.createElement('b');
      number.textContent = String(count);
      const label = document.createElement('span');
      label.textContent = loc.name;
      button.append(number, label);
      const customIcon = L.divIcon({
        className: 'osm-marker-wrapper',
        html: button,
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
        this.changeDetector.markForCheck();
      });

      this.markerGroup.addLayer(marker);
    }
  }
}
