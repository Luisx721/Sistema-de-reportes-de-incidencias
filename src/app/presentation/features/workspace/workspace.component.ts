import { ChangeDetectorRef, Component, HostListener, inject, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../application/services/auth.service';
import { DataService } from '../../../application/services/data.service';
import { DocumentService } from '../../../application/services/document.service';
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
  // Dependencias y estado de la vista

  private changeDetector = inject(ChangeDetectorRef);

  // Servicios de aplicacion
  auth = inject(AuthService);
  data = inject(DataService);
  documents = inject(DocumentService);
  // Estado de presentacion y filtros
  reports: IncidentReport[] = [];
  selected: IncidentReport | null = null;
  photos: string[] = [];
  loading = false;
  busy = false;
  message = '';
  query = '';
  category = '';
  location = '';
  state = '';
  from = '';
  to = '';
  nextState = '';
  priority = 'Media';
  note = '';
  tab = 'bandeja';
  private timer?: ReturnType<typeof setInterval>;
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
    return visibleReports(this.auth.user(), this.reports)
      .filter(
        (r) =>
          (!this.query ||
            `${r.code} ${r.description}`.toLowerCase().includes(this.query.toLowerCase())) &&
          (!this.category || r.category === this.category) &&
          (!this.location || r.location === this.location) &&
          (!this.state || r.state === this.state) &&
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
    return [...new Set([...this.data.categories, ...this.reports.map((r) => r.category)])];
  }
  get locationIds(): string[] {
    return [
      ...new Set([...this.data.locations.map((l) => l.id), ...this.reports.map((r) => r.location)]),
    ];
  }
  get editable(): boolean {
    return !!this.selected && canEditReport(this.auth.user(), this.selected);
  }
  get transitions(): string[] {
    return this.selected ? allowedTransitions(this.selected.state) : [];
  }
  count(state: string): number {
    return visibleReports(this.auth.user(), this.reports).filter((r) => r.state === state).length;
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
  // Carga y actualizacion periodica del mismo almacen local
  async ngOnInit(): Promise<void> {
    try {
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
    try {
      if (showLoading) this.loading = true;
      try {
        await this.data.seed();
        this.reports = await this.data.getReports();
      } catch {
        this.message = 'No se pudo cargar el almacenamiento local. Reintenta actualizar.';
      } finally {
        this.loading = false;
      }
    } finally {
      this.changeDetector.markForCheck();
    }
  }
  clear(): void {
    this.query = this.category = this.location = this.state = this.from = this.to = '';
  }
  open(report: IncidentReport): void {
    this.releasePhotos();
    this.selected = report;
    this.nextState = report.state;
    this.priority = report.priority || 'Media';
    this.note = '';
    this.message = '';
    this.photos = report.photos.map((p) => URL.createObjectURL(p));
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
  // Validaciones antes de confirmar y manejo del resultado persistido
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
        await this.data.updateReport(this.selected.code, this.nextState, this.note, this.priority);
        await this.reload();
        const updated = this.reports.find((r) => r.code === this.selected?.code);
        if (updated) this.open(updated);
        this.message =
          'Cambio guardado con historial. El seguimiento público mostrará la actualización.';
      } catch (error) {
        this.message = error instanceof Error ? error.message : 'No se pudo guardar';
      } finally {
        this.busy = false;
      }
    } finally {
      this.changeDetector.markForCheck();
    }
  }
  export(): void {
    if (this.canSeeReports && !this.dateError) this.documents.csv(this.filtered);
  }
}
