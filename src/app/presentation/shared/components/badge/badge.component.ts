import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataService } from '../../../../application/services/data.service';

@Component({
  selector: 'app-badge',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './badge.component.html',
})
export class BadgeComponent {
  // Dependencias y estado de la vista

  @Input({ required: true }) state = '';
  private dataService = inject(DataService);

  get badgeClass(): string {
    return this.dataService.getBadgeClass(this.state);
  }
}
