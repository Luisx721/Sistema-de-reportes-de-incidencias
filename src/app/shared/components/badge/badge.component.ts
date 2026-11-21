import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataService } from '../../../core/services/data.service';

@Component({
  selector: 'app-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span class="badge" [ngClass]="badgeClass">{{ state }}</span>
  `,
})
export class BadgeComponent {
  @Input({ required: true }) state = '';
  private dataService = inject(DataService);

  get badgeClass(): string {
    return this.dataService.getBadgeClass(this.state);
  }
}
