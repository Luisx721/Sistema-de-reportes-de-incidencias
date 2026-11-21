import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (toastService.message(); as msg) {
      <div class="toast" role="status">
        {{ msg }}
      </div>
    }
  `,
})
export class ToastComponent {
  toastService = inject(ToastService);
}
