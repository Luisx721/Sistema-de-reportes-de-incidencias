import { DocumentService } from '../../../application/services/document.service';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DataService } from '../../../application/services/data.service';
import { ToastService } from '../../../application/services/toast.service';
import { IncidentReport } from '../../../domain/models/incident.model';
import { BadgeComponent } from '../../shared/components/badge/badge.component';

@Component({
  selector: 'app-confirmacion',
  standalone: true,
  imports: [CommonModule, RouterLink, BadgeComponent],
  templateUrl: './confirmacion.component.html',
})
export class ConfirmacionComponent implements OnInit {
  // Dependencias y estado de la vista

  private changeDetector = inject(ChangeDetectorRef);

  documents = inject(DocumentService);
  dataService = inject(DataService);
  private toastService = inject(ToastService);
  private route = inject(ActivatedRoute);

  report: IncidentReport | null = null;
  loading = true;

  async ngOnInit(): Promise<void> {
    try {
      const code = (this.route.snapshot.queryParamMap.get('codigo') || '').toUpperCase();
      if (!code) {
        this.loading = false;
        return;
      }

      try {
        await this.dataService.seed();
        const r = await this.dataService.getReport(code);
        this.report = r || null;
      } catch {
        this.report = null;
      } finally {
        this.loading = false;
      }
    } finally {
      this.changeDetector.markForCheck();
    }
  }

  async copyCode(): Promise<void> {
    try {
      if (!this.report) return;
      try {
        await navigator.clipboard.writeText(this.report.code);
        this.toastService.show('Código copiado.');
      } catch {
        this.toastService.show('Código: ' + this.report.code);
      }
    } finally {
      this.changeDetector.markForCheck();
    }
  }

  printSummary(): void {
    if (this.report) this.documents.pdf(this.report);
  }
}
