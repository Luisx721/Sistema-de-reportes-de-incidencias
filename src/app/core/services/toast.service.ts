import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class ToastService {
  private toastMessage = signal<string | null>(null);
  private timer: any = null;

  readonly message = this.toastMessage.asReadonly();

  show(text: string, durationMs = 5000): void {
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.toastMessage.set(text);
    this.timer = setTimeout(() => {
      this.toastMessage.set(null);
      this.timer = null;
    }, durationMs);
  }

  hide(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.toastMessage.set(null);
  }
}
