import { AuthService } from '../../../application/services/auth.service';
import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { DataService } from '../../../application/services/data.service';
import { IncidentReport } from '../../../domain/models/incident.model';

interface PhotoItem {
  file: File;
  url: string;
}

@Component({
  selector: 'app-reporte',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './reporte.component.html',
})
export class ReporteComponent implements OnDestroy, OnInit {
  // Dependencias y estado de la vista

  private changeDetector = inject(ChangeDetectorRef);

  auth = inject(AuthService);
  assisted = false;
  dataService = inject(DataService);
  private router = inject(Router);

  category = '';
  location = '';
  reference = '';
  description = '';
  reporterName = '';
  reporterLink = '';

  photos: PhotoItem[] = [];
  photoError = '';
  formGeneralError = '';
  isSubmitting = false;
  catalogsLoading = !this.dataService.demoMode;
  catalogsError = '';
  isDragging = false;

  errors: { category?: string; location?: string; description?: string } = {};

  async ngOnInit(): Promise<void> {
    if (this.dataService.demoMode) return;
    try { await this.dataService.loadCatalogs(); }
    catch { this.catalogsError = 'No se pudieron cargar las categorías y ubicaciones de la API. Reintenta para volver a consultar.'; }
    finally { this.catalogsLoading = false; this.changeDetector.markForCheck(); }
  }

  async retryCatalogs(): Promise<void> {
    this.catalogsLoading = true; this.catalogsError = ''; this.changeDetector.markForCheck();
    try { await this.dataService.loadCatalogs(); }
    catch { this.catalogsError = 'No se pudieron cargar las categorías y ubicaciones de la API. Reintenta para volver a consultar.'; }
    finally { this.catalogsLoading = false; this.changeDetector.markForCheck(); }
  }

  ngOnDestroy(): void {
    this.clearPhotoUrls();
  }

  private clearPhotoUrls(): void {
    this.photos.forEach((p) => URL.revokeObjectURL(p.url));
  }

  onDragEnter(e: DragEvent): void {
    e.preventDefault();
    this.isDragging = true;
  }

  onDragOver(e: DragEvent): void {
    e.preventDefault();
    this.isDragging = true;
  }

  onDragLeave(e: DragEvent): void {
    e.preventDefault();
    this.isDragging = false;
  }

  onDrop(e: DragEvent): void {
    e.preventDefault();
    this.isDragging = false;
    if (e.dataTransfer?.files) {
      this.handleFiles(e.dataTransfer.files);
    }
  }

  onFileSelected(e: Event): void {
    const input = e.target as HTMLInputElement;
    if (input.files) {
      this.handleFiles(input.files);
      input.value = '';
    }
  }

  private handleFiles(fileList: FileList): void {
    const incoming = Array.from(fileList);
    const errors: string[] = [];
    const valid: File[] = [];

    for (const f of incoming) {
      if (!['image/jpeg', 'image/png'].includes(f.type)) {
        errors.push(`${f.name}: solo JPG y PNG.`);
        continue;
      }
      if (f.size > 5 * 1024 * 1024) {
        errors.push(`${f.name}: supera 5 MB.`);
        continue;
      }
      valid.push(f);
    }

    if (this.photos.length + valid.length > 3) {
      errors.push(
        'Puedes adjuntar hasta 3 fotografías. No se agregó esta selección; elige menos imágenes.',
      );
    } else {
      for (const file of valid) {
        this.photos.push({
          file,
          url: URL.createObjectURL(file),
        });
      }
    }

    this.photoError = errors.join(' ');
    if (this.photos.length && !this.dataService.demoMode) {
      this.photoError = [this.photoError, 'La API todavía no tiene carga de archivos; estas fotos solo se conservan como vista previa y no se enviarán al servidor.'].filter(Boolean).join(' ');
    }
  }

  removePhoto(index: number): void {
    URL.revokeObjectURL(this.photos[index].url);
    this.photos.splice(index, 1);
    this.photoError = '';
  }

  resetForm(): void {
    this.clearPhotoUrls();
    this.photos = [];
    this.category = '';
    this.location = '';
    this.reference = '';
    this.description = '';
    this.reporterName = '';
    this.reporterLink = '';
    this.errors = {};
    this.photoError = '';
    this.formGeneralError = '';
  }

  async submitReport(): Promise<void> {
    try {
      if (this.isSubmitting) return;
      if (!this.dataService.demoMode && (this.catalogsLoading || this.catalogsError || !this.dataService.categories.length || !this.dataService.locations.length)) return;

      this.errors = {
        category: !this.dataService.categories.includes(this.category)
          ? 'Selecciona una categoría.'
          : '',
        location: !this.dataService.locations.some((l) => l.id === this.location)
          ? 'Selecciona una ubicación.'
          : '',
        description:
          this.description.trim().length < 20
            ? 'Describe el problema con al menos 20 caracteres.'
            : '',
      };

      if (this.errors.category || this.errors.location || this.errors.description) {
        // Enfocar el primer campo invalido sin descartar los datos validos
        const firstId = this.errors.category
          ? 'category'
          : this.errors.location
            ? 'location'
            : 'description';
        document.getElementById(firstId)?.focus();
        return;
      }

      this.isSubmitting = true;
      this.formGeneralError = '';

      try {
        const date = new Date().toISOString();
        const bytes = crypto.getRandomValues(new Uint8Array(6));
        const localCode =
          'UES' +
          Array.from(bytes, (b) => b.toString(16).padStart(2, '0'))
            .join('')
            .toUpperCase();

        const record: IncidentReport = {
          code: localCode,
          created: date,
          state: this.dataService.states[0],
          category: this.category,
          location: this.location,
          reference: this.reference.trim(),
          description: this.description.trim(),
          reporterName: this.reporterName.trim(),
          reporterLink: this.reporterLink,
          photos: this.photos.map((p) => p.file),
          history: [
            {
              date,
              state: this.dataService.states[0],
              note: 'Reporte registrado. Pendiente de evaluación por la unidad responsable.',
            },
          ],
          sample: false,
          ownerId: this.auth.user()?.id,
          requesterArea:
            this.assisted && ['Jefatura', 'Ordenanza'].includes(this.auth.user()?.profile || '')
              ? this.auth.user()?.area
              : undefined,
        };

        const code = await this.dataService.saveReport(record) as string;
        this.router.navigate(['/confirmacion'], { queryParams: { codigo: code } });
      } catch (err) {
        const status = (err as any)?.status;
        this.formGeneralError = status === 400
          ? 'La API rechazó algunos datos del reporte (400). Revísalos e intenta de nuevo.'
          : status === 409
            ? 'El reporte entró en conflicto con un registro existente (409). Intenta de nuevo.'
            : status === 0
              ? 'No se pudo conectar con la API. Tus datos siguen en el formulario.'
              : 'No se pudo guardar el reporte. Tus datos siguen en el formulario.';
      } finally {
        this.isSubmitting = false;
      }
    } finally {
      this.changeDetector.markForCheck();
    }
  }
}
