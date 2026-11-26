import { Injectable, signal } from '@angular/core';
//Servicio para mostrar un mensaje temporal (toast) en pantalla.
@Injectable({
  providedIn: 'root',
})
export class ToastService {
  private toastMessage = signal<string | null>(null);
  private timer: any = null;
  // Los componentes solo pueden leer el mensaje, no modificarlo
  readonly message = this.toastMessage.asReadonly();
  // Muestra el mensaje y lo oculta solo después de durationMs (5 s por defecto)
  show(text: string, durationMs = 5000): void {
     // Si ya había un toast activo, se reinicia el temporizador
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.toastMessage.set(text);
    this.timer = setTimeout(() => {
      this.toastMessage.set(null);
      this.timer = null;
    }, durationMs);
  }
 // Oculta el mensaje de inmediato
  hide(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.toastMessage.set(null);
  }
}
