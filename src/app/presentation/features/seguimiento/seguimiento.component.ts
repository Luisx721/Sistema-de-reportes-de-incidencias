import { ChangeDetectorRef, Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { DataService } from '../../../application/services/data.service';
import { IncidentReport } from '../../../domain/models/incident.model';
import { BadgeComponent } from '../../shared/components/badge/badge.component';

@Component({
  selector: 'app-seguimiento',
  standalone: true,
  imports: [CommonModule, FormsModule, BadgeComponent],
  templateUrl: './seguimiento.component.html',
})
export class SeguimientoComponent implements OnInit, OnDestroy {
  // Dependencias y estado de la vista

  private changeDetector = inject(ChangeDetectorRef);

  dataService = inject(DataService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  private timer?: ReturnType<typeof setInterval>;
  searchQuery = '';
  report: IncidentReport | null = null;
  loading = false;
  searched = false;
  lookupError = '';
  photoUrls: string[] = [];

  ngOnInit(): void {
    this.timer = setInterval(() => {
      if (this.report && !this.loading) void this.performLookup(this.report.code);
    }, 30000);
    this.route.queryParamMap.subscribe((params) => {
      const code = params.get('codigo');
      if (code) {
        this.searchQuery = code;
        this.performLookup(code);
      }
    });
  }

  ngOnDestroy(): void {
    clearInterval(this.timer);
    this.revokePhotoUrls();
  }

  useExampleCode(): void {
    this.searchQuery = 'UESDEMO0001';
    this.searchCode();
  }

  searchCode(): void {
    const code = this.searchQuery.trim().toUpperCase();
    if (!code) return;
    this.searchQuery = code;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { codigo: code },
      queryParamsHandling: 'merge',
    });
    this.performLookup(code);
  }

  private async performLookup(code: string): Promise<void> {
    try {
      this.loading = true;
      this.searched = true;
      this.lookupError = '';
      this.revokePhotoUrls();

      try {
        if (this.dataService.demoMode) await this.dataService.seed();
        const r = await this.dataService.getReport(code);
        this.report = r || null;
        if (this.report && this.report.photos && this.report.photos.length > 0) {
          this.photoUrls = this.report.photos.map((p) => URL.createObjectURL(p));
        }
      } catch (err: any) {
        this.report = null;
        this.lookupError = err?.status === 401
          ? 'La sesión no es válida (401). Inicia sesión nuevamente.'
          : err?.status === 403
            ? 'No tienes autorización para consultar este reporte (403).'
            : err?.status === 0
              ? 'No se pudo conectar con la API. Comprueba que esté disponible.'
              : 'No se pudo completar la consulta.';
      } finally {
        this.loading = false;
      }
    } finally {
      this.changeDetector.markForCheck();
    }
  }

  private revokePhotoUrls(): void {
    this.photoUrls.forEach((url) => URL.revokeObjectURL(url));
    this.photoUrls = [];
  }
}
