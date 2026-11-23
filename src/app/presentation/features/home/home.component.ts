import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DataService } from '../../../application/services/data.service';
import { IncidentReport } from '../../../domain/models/incident.model';
import { BadgeComponent } from '../../shared/components/badge/badge.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink, BadgeComponent],
  templateUrl: './home.component.html',
})
export class HomeComponent implements OnInit {
  // Dependencias y estado de la vista

  private changeDetector = inject(ChangeDetectorRef);

  dataService = inject(DataService);
  recentReports: IncidentReport[] = [];
  loading = true;
  error = false;

  async ngOnInit(): Promise<void> {
    try {
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
    } finally {
      this.changeDetector.markForCheck();
    }
  }
}
