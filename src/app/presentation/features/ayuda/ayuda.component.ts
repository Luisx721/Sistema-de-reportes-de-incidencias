import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminService } from '../../../application/services/admin.service';
import { DataService } from '../../../application/services/data.service';

@Component({
  selector: 'app-ayuda',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './ayuda.component.html',
})
export class AyudaComponent implements OnInit {
  private changeDetector = inject(ChangeDetectorRef);
  dataService = inject(DataService);
  private adminService = inject(AdminService);

  loading = false;
  error = '';

  get activeCategories(): { name: string; areaName?: string }[] {
    if (this.dataService.demoMode) {
      return this.adminService
        .categories()
        .filter((c) => c.active)
        .map((c) => ({ name: c.name, areaName: c.areaName }));
    }
    const adminByName = new Map(
      this.adminService.categories().map((c) => [c.name.toLowerCase(), c.areaName])
    );
    return this.dataService.categories.map((name) => ({
      name,
      areaName: adminByName.get(name.toLowerCase()),
    }));
  }

  async ngOnInit(): Promise<void> {
    if (this.dataService.demoMode) return;
    this.loading = true;
    try {
      await this.dataService.loadCatalogs();
    } catch {
      this.error = 'No se pudieron cargar las categorías activas desde la API.';
    } finally {
      this.loading = false;
      this.changeDetector.markForCheck();
    }
  }
}