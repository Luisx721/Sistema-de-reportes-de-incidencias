import { ChangeDetectorRef, Component, HostListener, inject, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../application/services/auth.service';
import { DataService } from '../../../application/services/data.service';
import { DocumentService } from '../../../application/services/document.service';
import { ApiClient } from '../../../infrastructure/api-client';
import { IncidentReport } from '../../../domain/models/incident.model';
import {
  allowedTransitions,
  canEditReport,
  visibleReports,
} from '../../../domain/policies/permissions';

@Component({
  selector: 'app-workspace',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './workspace.component.html',
  styleUrl: './workspace.component.css',
})
export class WorkspaceComponent implements OnInit, OnDestroy {
  private changeDetector = inject(ChangeDetectorRef);
  private api = inject(ApiClient);

  // Servicios de aplicación
  auth = inject(AuthService);
  data = inject(DataService);
  documents = inject(DocumentService);

  // Estado de presentación y filtros
  reports: IncidentReport[] = [];
  selected: IncidentReport | null = null;
  photos: string[] = [];
  loading = false;
  catalogsLoading = false;
  catalogsError = '';
  busy = false;
  message = '';
  query = '';
  category = '';
  location = '';
  state = '';
  urgency = '';
  from = '';
  to = '';
  nextState = '';
  priority = 'Media';
  note = '';
  tab = 'bandeja';

  private timer?: ReturnType<typeof setInterval>;
  private filterTimer?: ReturnType<typeof setTimeout>;
  private requestId = 0;

  get title(): string {
    return ['Jefatura', 'Ordenanza'].includes(this.auth.user()?.profile || '')
      ? 'Reportes de mi área'
      : this.auth.user()?.profile === 'Reportante'
        ? 'Mis reportes'
        : 'Centro de atención de incidencias';
  }

  get canReport(): boolean {
    return ['Jefatura', 'Ordenanza', 'Reportante'].includes(this.auth.user()?.profile || '');
  }

  get canSeeReports(): boolean {
    return ['Desarrollo Físico', 'Autoridad'].includes(this.auth.user()?.profile || '');
  }

  get dateError(): boolean {
    return !!this.from && !!this.to && this.from > this.to;
  }

  get filtered(): IncidentReport[] {
    if (this.dateError) return [];
    const source = this.data.demoMode ? visibleReports(this.auth.user(), this.reports) : this.reports;
    const locationValue =
      this.location && !this.data.demoMode ? this.data.locationName(this.location) : this.location;
    return source
      .filter(
        (r) =>
          (!this.query ||
            `${r.code} ${r.description}`.toLowerCase().includes(this.query.toLowerCase())) &&
          (!this.category || r.category === this.category) &&
          (!this.location || r.location === locationValue) &&
          (!this.state || r.state === this.state) &&
          (!this.urgency || r.urgency === this.urgency) &&
          (!this.from || r.created.slice(0, 10) >= this.from) &&
          (!this.to || r.created.slice(0, 10) <= this.to),
      )
      .sort(
        (a, b) =>
          (({ Alta: 0, Media: 1, Baja: 2 })[a.priority as 'Alta'] ?? 1) -
            ({ Alta: 0, Media: 1, Baja: 2 }[b.priority as 'Alta'] ?? 1) ||
          b.created.localeCompare(a.created),
      );
  }

  get categories(): string[] {
    if (!this.data.demoMode) return this.data.categories;
    return [...new Set([...this.data.categories, ...this.reports.map((r) => r.category)])];
  }

  get locationIds(): string[] {
    if (!this.data.demoMode) return this.data.locations.map((l) => l.id);
    return [
      ...new Set([...this.data.locations.map((l) => l.id), ...this.reports.map((r) => r.location)]),
    ];
  }

  get editable(): boolean {
    if (!this.selected) return false;
    if (!this.data.demoMode)
      return (
        !['Resuelto', 'Rechazado/Cerrado'].includes(this.selected.state) &&
        ['Mantenimiento', 'Desarrollo Físico'].includes(
          this.auth.user()?.profile || '',
        )
      );
    return canEditReport(this.auth.user(), this.selected);
  }

  get transitions(): string[] {
    return this.selected ? allowedTransitions(this.selected.state) : [];
  }

  count(state: string): number {
    const source = this.data.demoMode ? visibleReports(this.auth.user(), this.reports) : this.reports;
    return source.filter((r) => r.state === state).length;
  }

  total(state: string): number {
    return this.filtered.filter((r) => r.state === state).length;
  }

  percentage(state: string): string {
    return this.filtered.length
      ? ((100 * this.total(state)) / this.filtered.length).toFixed(1)
      : '0';
  }

  breakdown(field: 'category' | 'location'): { name: string; count: number }[] {
    const groups = new Map<string, number>();
    for (const r of this.filtered) {
      const name = field === 'location' ? this.data.locationName(r.location) : r.category;
      groups.set(name, (groups.get(name) || 0) + 1);
    }
    return [...groups].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }

  async ngOnInit(): Promise<void> {
    try {
      if (!this.data.demoMode) {
        this.catalogsLoading = true;
        try {
          await this.data.loadCatalogs();
        } catch {
          this.catalogsError = 'No se pudieron cargar los catálogos para los filtros.';
        } finally {
          this.catalogsLoading = false;
        }
      }
      await this.reload();
      this.timer = setInterval(() => void this.reload(false), 30000);
    } finally {
      this.changeDetector.markForCheck();
    }
  }

  ngOnDestroy(): void {
    clearInterval(this.timer);
    this.releasePhotos();
  }

  async reload(showLoading = true): Promise<void> {
    const requestId = ++this.requestId;
    try {
      if (showLoading) this.loading = true;
      try {
        if (this.data.demoMode) await this.data.seed();
        const reports = await this.data.getAuthorizedReports({
          query: this.query.trim() || undefined,
          category: this.category || undefined,
          location: this.location ? this.data.locationName(this.location) : undefined,
          state: this.state || undefined,
          urgency: this.urgency || undefined,
          from: this.from || undefined,
          to: this.to || undefined,
        });
        if (requestId === this.requestId) {
          this.reports = reports;
          this.message = '';
        }
      } catch (error: any) {
        if (requestId === this.requestId)
          this.message =
            error?.status === 401
              ? 'La sesión expiró (401). Inicia sesión nuevamente.'
              : error?.status === 403
                ? 'Tu perfil no tiene autorización para ver esta bandeja (403).'
                : this.data.demoMode
                  ? 'No se pudo cargar el almacenamiento local. Reintenta actualizar.'
                  : 'No se pudo cargar la bandeja desde la API.';
      } finally {
        if (requestId === this.requestId) this.loading = false;
      }
    } finally {
      this.changeDetector.markForCheck();
    }
  }

  clear(): void {
    this.query = this.category = this.location = this.state = this.urgency = this.from = this.to = '';
    void this.reload();
  }

  filtersChanged(): void {
    if (this.dateError) return;
    clearTimeout(this.filterTimer);
    this.filterTimer = setTimeout(() => void this.reload(), 250);
  }

  async open(report: IncidentReport): Promise<void> {
    this.releasePhotos();
    this.message = '';
    try {
      const detail = this.data.demoMode ? report : await this.data.getAuthorizedReport(report.code);
      this.selected = detail;
      this.nextState = detail.state;
      this.priority = detail.priority || 'Media';
      this.note = '';

      if (this.data.demoMode) {
        this.photos = detail.photos.map((p) => URL.createObjectURL(p));
      } else {
        try {
          const photoDtos = await this.api.listPhotos(detail.code);
          const blobs = await Promise.all(photoDtos.map((p) => this.api.getPhotoBlob(p.url)));
          this.photos = blobs.map((b) => URL.createObjectURL(b));
        } catch {
          this.photos = [];
        }
      }
    } catch (error: any) {
      this.selected = null;
      this.message =
        error?.status === 401
          ? 'La sesión expiró (401). Inicia sesión nuevamente.'
          : error?.status === 403
            ? 'No tienes autorización para abrir este expediente (403).'
            : 'No se pudo cargar el expediente actualizado.';
    }
    this.changeDetector.markForCheck();
  }

  close(): void {
    this.releasePhotos();
    this.selected = null;
    this.changeDetector.markForCheck();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.selected) {
      this.close();
    }
  }

  private releasePhotos(): void {
    this.photos.forEach((p) => URL.revokeObjectURL(p));
    this.photos = [];
  }

  async save(): Promise<void> {
    try {
      if (!this.selected || this.busy) return;
      if (!this.editable || this.note.trim().length < 10) {
        this.message = 'Se requiere competencia y una observación de al menos diez caracteres.';
        return;
      }
      if (this.nextState === this.selected.state && this.priority === this.selected.priority) {
        this.message = 'Selecciona un cambio de estado o prioridad.';
        return;
      }
      this.busy = true;
      try {
        const selected = this.selected;
        const updated = await this.data.updateReport(
          selected.code,
          this.nextState,
          this.note,
          this.priority,
          selected.version,
        );
        await this.reload();
        if (updated) {
          this.selected = updated;
          this.nextState = updated.state;
          this.priority = updated.priority || 'Media';
          this.note = '';
        } else {
          const current = this.reports.find((r) => r.code === selected.code);
          if (current) await this.open(current);
        }
        this.message =
          'Cambio guardado con historial. El seguimiento público mostrará la actualización.';
      } catch (error: any) {
        if (error?.status === 409 && this.selected) {
          const code = this.selected.code;
          try {
            const fresh = await this.data.getAuthorizedReport(code);
            this.selected = fresh;
            this.nextState = fresh.state;
            this.priority = fresh.priority || 'Media';
            this.note = '';
          } catch {
            await this.reload();
          }
          this.message =
            'Otro usuario modificó este expediente. Se recargó la versión actual; revisa el historial y vuelve a aplicar el cambio manualmente si corresponde.';
        } else if (error?.status === 401)
          this.message = 'La sesión expiró (401). Inicia sesión nuevamente.';
        else if (error?.status === 403)
          this.message = 'El servidor rechazó la autorización para modificar este expediente (403).';
        else this.message = error?.error?.error || error?.message || 'No se pudo guardar';
      } finally {
        this.busy = false;
      }
    } finally {
      this.changeDetector.markForCheck();
    }
  }

  async export(): Promise<void> {
    if (!this.canSeeReports || this.dateError) return;
    if (this.data.demoMode) {
      this.documents.csv(this.filtered);
      return;
    }
    try {
      const blob = await this.api.exportCsv({
        query: this.query.trim() || undefined,
        category: this.category || undefined,
        location: this.location ? this.data.locationName(this.location) : undefined,
        state: this.state || undefined,
        urgency: this.urgency || undefined,
        from: this.from || undefined,
        to: this.to || undefined,
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'incidencias.csv';
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      this.message = 'No se pudo descargar el archivo CSV desde la API.';
      this.changeDetector.markForCheck();
    }
  }
}