import { Component, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { DataService } from '../../core/services/data.service';
import { IncidentReport } from '../../core/models/incident.model';

interface PhotoItem {
  file: File;
  url: string;
}

@Component({
  selector: 'app-reporte',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <main id="contenido" class="wrap main-content">
      <header class="page-heading">
        <p class="eyebrow">NUEVO REPORTE</p>
        <h1>Cuéntanos qué ocurre.</h1>
        <p>
          No necesitas una cuenta. Describe el problema y guarda el código para consultar
          su atención.
        </p>
      </header>

      <div class="form-layout">
        <!-- Formulario de reporte -->
        <form
          id="incident-form"
          class="surface report-form"
          novalidate
          (ngSubmit)="submitReport()"
        >
          <!-- Mensaje de error general -->
          @if (formGeneralError) {
            <div class="form-status" role="alert">
              {{ formGeneralError }}
            </div>
          }

          <!-- 01 Ubicación y categoría -->
          <fieldset>
            <legend>
              <span class="step-number">01</span>
              Ubicación y categoría
            </legend>
            <p class="field-note">Los campos marcados con * son obligatorios.</p>
            <div class="field-grid">
              <div class="field">
                <label for="category">Categoría *</label>
                <select
                  id="category"
                  name="category"
                  [(ngModel)]="category"
                  (ngModelChange)="errors.category = ''"
                  [attr.aria-invalid]="!!errors.category"
                  aria-describedby="category-error"
                  required
                >
                  <option value="">Selecciona una categoría</option>
                  @for (cat of dataService.categories; track cat) {
                    <option [value]="cat">{{ cat }}</option>
                  }
                </select>
                @if (errors.category) {
                  <span class="field-error" id="category-error">{{ errors.category }}</span>
                }
              </div>

              <div class="field">
                <label for="location">Ubicación *</label>
                <select
                  id="location"
                  name="location"
                  [(ngModel)]="location"
                  (ngModelChange)="errors.location = ''"
                  [attr.aria-invalid]="!!errors.location"
                  aria-describedby="location-error"
                  required
                >
                  <option value="">Selecciona una ubicación</option>
                  @for (loc of dataService.locations; track loc.id) {
                    <option [value]="loc.id">{{ loc.name }}</option>
                  }
                </select>
                @if (errors.location) {
                  <span class="field-error" id="location-error">{{ errors.location }}</span>
                }
              </div>
            </div>

            <div class="field">
              <label for="reference">
                Referencia adicional
                <span>Opcional</span>
              </label>
              <input
                id="reference"
                name="reference"
                [(ngModel)]="reference"
                maxlength="200"
                placeholder="Ej. segundo nivel, junto a la entrada principal"
              />
              <p class="field-note">
                Evita incluir nombres, teléfonos o datos personales.
              </p>
            </div>
          </fieldset>

          <!-- 02 Describe el problema -->
          <fieldset>
            <legend>
              <span class="step-number">02</span>
              Describe el problema
            </legend>
            <div class="field">
              <label for="description">¿Qué daño o falla observaste? *</label>
              <textarea
                id="description"
                name="description"
                rows="5"
                minlength="20"
                maxlength="2000"
                [(ngModel)]="description"
                (ngModelChange)="errors.description = ''"
                [attr.aria-invalid]="!!errors.description"
                aria-describedby="description-error"
                required
                placeholder="Ej. La lámpara del pasillo de la biblioteca no enciende y el área queda oscura por la tarde."
              ></textarea>
              <div class="field-meta">
                <span>Mínimo 20 caracteres</span>
                <span id="character-count">{{ description.trim().length }} / 2000</span>
              </div>
              @if (errors.description) {
                <span class="field-error" id="description-error">{{ errors.description }}</span>
              }
            </div>
          </fieldset>

          <!-- 03 Fotografías opcionales -->
          <fieldset>
            <legend>
              <span class="step-number">03</span>
              Fotografías
              <small>Opcional</small>
            </legend>
            <div
              id="dropzone"
              class="upload-zone"
              [class.dragging]="isDragging"
              (dragenter)="onDragEnter($event)"
              (dragover)="onDragOver($event)"
              (dragleave)="onDragLeave($event)"
              (drop)="onDrop($event)"
            >
              <svg
                class="icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.7"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <rect x="3" y="3" width="18" height="18" rx="3" />
                <circle cx="8" cy="8" r="1" />
                <path d="m3 17 5-5 4 4 3-5 6 6" />
              </svg>
              <label for="photos">
                <strong>Selecciona fotografías</strong>
                o arrástralas aquí
              </label>
              <p>Hasta 3 imágenes JPG o PNG · Máximo 5 MB por imagen</p>
              <input
                type="file"
                id="photos"
                accept="image/jpeg,image/png"
                multiple
                (change)="onFileSelected($event)"
                aria-describedby="photo-error"
              />
            </div>
            @if (photoError) {
              <p id="photo-error" class="field-error" role="alert">{{ photoError }}</p>
            }

            @if (photos.length > 0) {
              <div id="photo-previews" class="photo-previews">
                @for (item of photos; track $index) {
                  <div class="photo-preview">
                    <img [src]="item.url" [alt]="'Vista previa: ' + item.file.name" />
                    <button
                      type="button"
                      [attr.aria-label]="'Quitar ' + item.file.name"
                      (click)="removePhoto($index)"
                    >
                      ×
                    </button>
                    <p>{{ item.file.name }}</p>
                  </div>
                }
              </div>
            }
          </fieldset>

          <!-- 04 Identificación opcional -->
          <fieldset>
            <legend>
              <span class="step-number">04</span>
              Sobre ti
              <small>Opcional</small>
            </legend>
            <p class="field-note">
              Puedes dejar estos campos vacíos. No aparecen en la consulta pública.
            </p>
            <div class="field-grid">
              <div class="field">
                <label for="reporter-name">Nombre</label>
                <input
                  id="reporter-name"
                  name="reporterName"
                  [(ngModel)]="reporterName"
                  autocomplete="name"
                  maxlength="100"
                  placeholder="Tu nombre"
                />
              </div>
              <div class="field">
                <label for="reporter-link">Vínculo con la universidad</label>
                <select id="reporter-link" name="reporterLink" [(ngModel)]="reporterLink">
                  <option value="">Prefiero no indicarlo</option>
                  <option value="Estudiante">Estudiante</option>
                  <option value="Docente">Docente</option>
                  <option value="Personal administrativo">Personal administrativo</option>
                  <option value="Ordenanza">Ordenanza</option>
                  <option value="Jefatura">Jefatura</option>
                </select>
              </div>
            </div>
          </fieldset>

          <!-- Acciones del formulario -->
          <div class="form-actions">
            <button type="button" class="button button-quiet" (click)="resetForm()">
              Limpiar formulario
            </button>
            <button type="submit" class="button" id="send-report" [disabled]="isSubmitting">
              @if (isSubmitting) {
                Guardando…
              } @else {
                Enviar reporte
                <svg
                  class="icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.7"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <path d="M5 12h14m-6-6 6 6-6 6" />
                </svg>
              }
            </button>
          </div>
          <p class="local-note">
            Demostración: el reporte se guarda en este navegador. No se envía a la universidad.
          </p>
        </form>

        <!-- Recomendaciones para reportar -->
        <aside class="report-aside">
          <p class="eyebrow">ANTES DE ENVIAR</p>
          <h2>Los detalles importan.</h2>
          <ul class="tips">
            <li>
              <span>1</span>
              <div>
                <strong>Identifica el lugar</strong>
                <p>Selecciona una ubicación y agrega referencias si las necesitas.</p>
              </div>
            </li>
            <li>
              <span>2</span>
              <div>
                <strong>Describe lo que observas</strong>
                <p>Explica el daño y cómo afecta el uso del espacio.</p>
              </div>
            </li>
            <li>
              <span>3</span>
              <div>
                <strong>Conserva tu código</strong>
                <p>Lo necesitarás para revisar el estado y las observaciones.</p>
              </div>
            </li>
          </ul>
          <div class="aside-note">
            <svg
              class="icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.7"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
            <p>La prioridad y la atención serán evaluadas por la unidad responsable.</p>
          </div>
          <a class="text-link" routerLink="/ayuda">
            Ver guía completa
            <svg
              class="icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.7"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M5 12h14m-6-6 6 6-6 6" />
            </svg>
          </a>
        </aside>
      </div>
    </main>
  `,
})
export class ReporteComponent implements OnDestroy {
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
  isDragging = false;

  errors: { category?: string; location?: string; description?: string } = {};

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
        'Puedes adjuntar hasta 3 fotografías. No se agregó esta selección; elige menos imágenes.'
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
    if (this.isSubmitting) return;

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
      // Focus first error
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
      const code =
        'UES' +
        Array.from(bytes, (b) => b.toString(16).padStart(2, '0'))
          .join('')
          .toUpperCase();

      const record: IncidentReport = {
        code,
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
      };

      await this.dataService.saveReport(record);
      this.router.navigate(['/confirmacion'], { queryParams: { codigo: code } });
    } catch (err) {
      this.formGeneralError =
        'No se pudo guardar el reporte en este navegador. Tus datos siguen en el formulario; revisa el espacio disponible o los permisos de almacenamiento e intenta otra vez.';
    } finally {
      this.isSubmitting = false;
    }
  }
}
