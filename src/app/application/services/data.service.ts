import { IncidentRepository } from '../../infrastructure/incident.repository';
import { AdminService } from './admin.service';
import { AuthService } from './auth.service';
import { allowedTransitions, canEditReport } from '../../domain/policies/permissions';
import { Injectable, inject } from '@angular/core';
import { CampusLocation, IncidentReport, IncidentFilters } from '../../domain/models/incident.model';
import { API_CONFIG } from '../../infrastructure/api-config';
import { ApiClient } from '../../infrastructure/api-client';
import { fromIncidentDto, fromPublicIncidentSummary, fromPublicStatus, toChangeIncident, toCreateIncident } from '../../infrastructure/api-mappers';
import { IncidentCatalogsDto } from '../../infrastructure/api-mappers';

// Servicio central de datos de incidencias.
// Funciona en dos modos: demo (IndexedDB local) y API (backend real).
@Injectable({
  providedIn: 'root',
})
export class DataService {
  // Catálogos descargados de la API (solo se usan fuera del modo demo)
  private apiCatalogs: IncidentCatalogsDto | null = null;
  private repository = inject(IncidentRepository);
  private admin = inject(AdminService);
  private auth = inject(AuthService);
  private api = inject(ApiClient);
  private config = inject(API_CONFIG);
  get demoMode(): boolean { return this.config.demoMode; }

  // Categorías base del modo demo
  private readonly originalCategories: string[] = [
    'Mobiliario',
    'Electricidad',
    'Agua y saneamiento',
    'Edificios',
    'Espacios comunes',
  ];

  // Ubicaciones del campus con sus coordenadas (x, y para el mapa; lat, lng para GPS)
  private readonly originalLocations: CampusLocation[] = [
    { id: 'biblioteca', name: 'Biblioteca', x: 24, y: 27, lat: 13.44115, lng: -88.15905 },
    { id: 'aulas', name: 'Edificio de aulas', x: 68, y: 24, lat: 13.4411, lng: -88.1576 },
    { id: 'laboratorios', name: 'Laboratorios', x: 26, y: 52, lat: 13.4401, lng: -88.1591 },
    { id: 'administracion', name: 'Administración', x: 73, y: 62, lat: 13.44005, lng: -88.1575 },
    { id: 'zonas-comunes', name: 'Áreas comunes', x: 43, y: 79, lat: 13.4396, lng: -88.15835 },
  ];

  private resolveCoordsForLocation(locationText: string): { lat: number; lng: number } {
    const buildingName = locationText.split(' - ')[0]?.trim().toLowerCase() ?? '';
    const match = this.originalLocations.find(
      (loc) =>
        loc.name.toLowerCase() === buildingName ||
        locationText.toLowerCase().startsWith(loc.name.toLowerCase())
    );
    // Respaldo central del campus (nunca 0, 0)
    return match ? { lat: match.lat, lng: match.lng } : { lat: 13.44045, lng: -88.15835 };
  }

  // Catalogos activos compartidos con administracion
  get categories(): string[] {
    if (!this.config.demoMode) return this.apiCatalogs?.categories ?? [];
    return this.admin
      .categories()
      .filter((c) => c.active)
      .map((c) => c.name);
  }

  get urgencies(): string[] {
    if (!this.config.demoMode) return this.apiCatalogs?.urgencies ?? ['Baja', 'Media', 'Alta'];
    return ['Baja', 'Media', 'Alta'];
  }

  // En modo API la ubicación solo trae nombre; en demo se combina con las coordenadas originales
  get locations(): CampusLocation[] {
    if (!this.config.demoMode) {
      return (this.apiCatalogs?.locations ?? []).map((name) => {
        const coords = this.resolveCoordsForLocation(name);
        const buildingName = name.split(' - ')[0]?.trim().toLowerCase() ?? '';
        const orig = this.originalLocations.find((o) => o.name.toLowerCase() === buildingName);
        return {
          id: name,
          name,
          x: orig?.x ?? 50,
          y: orig?.y ?? 50,
          lat: coords.lat,
          lng: coords.lng,
        };
      });
    }
    return this.admin
      .locations()
      .filter((l) => l.active)
      .map((l) => ({
        ...(this.originalLocations[l.id - 1] || {
          id: 'ubicacion-' + l.id,
          x: 50,
          y: 50,
          lat: 13.44045,
          lng: -88.15835,
        }),
        name: l.name,
      }));
  }

  // Estados posibles de un reporte (el orden se usa también para los estilos de las insignias)
  readonly states: string[] = [
    'Recibido',
    'En proceso',
    'En espera de materiales/autorización',
    'Resuelto',
    'Rechazado/Cerrado',
  ];

  // Descarga los catálogos desde la API (no hace nada en modo demo)
  async loadCatalogs(): Promise<void> {
    if (this.config.demoMode) return;
    const catalogs = await this.api.getCatalogs();
    this.apiCatalogs = {
      categories: [...catalogs.categories],
      locations: [...catalogs.locations],
      urgencies: catalogs.urgencies ? [...catalogs.urgencies] : ['Baja', 'Media', 'Alta'],
    };
  }

  // Datos de ejemplo: [código, categoría, ubicación, descripción, índice del estado]
  private readonly samples: [string, string, string, string, number][] = [
    [
      'UESDEMO0001',
      'Electricidad',
      'biblioteca',
      'La lámpara del pasillo de la biblioteca no enciende. El área queda oscura al final de la tarde.',
      1,
    ],
    [
      'UESDEMO0002',
      'Mobiliario',
      'aulas',
      'Dos pupitres del salón de clases tienen el respaldo suelto y necesitan revisión.',
      0,
    ],
    [
      'UESDEMO0003',
      'Agua y saneamiento',
      'laboratorios',
      'El grifo del lavamanos presenta una fuga continua de agua después de cerrarlo.',
      2,
    ],
    [
      'UESDEMO0004',
      'Espacios comunes',
      'zonas-comunes',
      'La tapa de una canaleta estaba desplazada en el paso peatonal del área común.',
      3,
    ],
    [
      'UESDEMO0005',
      'Edificios',
      'administracion',
      'Se solicita una revisión de la pintura de la pared en el acceso al edificio.',
      4,
    ],
  ];

  // Consulta pública de un reporte por código; devuelve undefined si no existe
  async getReport(code: string): Promise<IncidentReport | undefined> {
    if (!this.config.demoMode) {
      try { return fromPublicStatus(await this.api.track(code)); }
      catch (error: any) { if (error?.status === 404) return undefined; throw error; }
    }
    return this.repository.transaction<IncidentReport | undefined>('readonly', (s) => s.get(code));
  }

  // Lista pública de reportes (sin login, hasta 100 recientes)
  async getReports(filters: IncidentFilters = {}): Promise<IncidentReport[]> {
    if (!this.config.demoMode) {
      const publicItems = await this.api.listPublicIncidents({
        category: filters.category,
        state: filters.state,
      });
      return publicItems.map((dto) =>
        fromPublicIncidentSummary(dto, this.resolveCoordsForLocation(dto.location))
      );
    }
    return this.repository.transaction<IncidentReport[]>('readonly', (s) => s.getAll());
  }

  // Lista completa para el panel interno con sesión
  async getAuthorizedReports(filters: IncidentFilters = {}): Promise<IncidentReport[]> {
    if (!this.config.demoMode) {
      const profile = this.auth.user()?.profile || '';
      const isGlobalPanel = ['Autoridad', 'Desarrollo Físico'].includes(profile);
      const dtos = isGlobalPanel
        ? await this.api.listPanelIncidents(filters)
        : await this.api.listIncidents(filters);
      return dtos.map(fromIncidentDto);
    }
    return this.repository.transaction<IncidentReport[]>('readonly', (s) => s.getAll());
  }

  // Consulta completa de un reporte individual para usuarios con sesión y permisos
  async getAuthorizedReport(code: string): Promise<IncidentReport> {
    if (this.config.demoMode) {
      const report = await this.getReport(code);
      if (!report) throw new Error('No se encontró el expediente.');
      return report;
    }
    return fromIncidentDto(await this.api.getIncident(code));
  }

  // Valida y guarda un reporte nuevo; devuelve su código o llave
  async saveReport(report: IncidentReport): Promise<IDBValidKey> {
    // Validaciones: descripción, fotos (máx. 3, png/jpeg, 5 MB) y catálogos activos
    if (report.description.trim().length < 20 || report.description.length > 2000)
      throw new Error('Descripcion fuera del limite permitido');
    if (
      report.photos.length > 3 ||
      report.photos.some((p) => !['image/png', 'image/jpeg'].includes(p.type) || p.size > 5242880)
    )
      throw new Error('Fotografias no validas');
    if (
      !report.sample &&
      (!this.categories.includes(report.category) ||
        !this.locations.some((l) => l.id === report.location))
    )
      throw new Error('Selecciona un catalogo activo');

    // Modo API: crea el reporte y luego sube las fotos
    if (!this.config.demoMode) {
      const localLocation = this.locations.find((location) => location.id === report.location);
      if (!localLocation) throw new Error('Selecciona una ubicación válida.');

      const created = await this.api.createIncident(toCreateIncident(report, localLocation.name));

      // Subir fotografías adjuntas si existen (máx. 3)
      if (report.photos && report.photos.length > 0) {
        const failedPhotos = await this.uploadReportPhotos(created.code, report.photos);
        if (failedPhotos.length > 0) {
          const err: any = new Error(
            `El reporte ${created.code} se registró, pero no se pudo subir: ${failedPhotos.join(', ')}.`
          );
          err.createdCode = created.code;
          err.failedPhotos = failedPhotos;
          throw err;
        }
      }

      // Marca el reporte como duplicado para avisar al usuario después
      if (created.isDuplicate) {
        sessionStorage.setItem(`ues-dup-${created.code}`, '1');
      }

      // Subir fotografías adjuntas si existen (máx. 3)
      if (report.photos && report.photos.length > 0) {
        const uploadToken = created.photoUploadToken ?? undefined;

        // Si es invitado y el reporte fue marcado como duplicado, el backend no emite token de subida
        if (!this.auth.user() && !uploadToken && created.isDuplicate) {
          return created.code;
        }

        const failedPhotos = await this.uploadReportPhotos(created.code, report.photos, uploadToken);
        if (failedPhotos.length > 0) {
          const err: any = new Error(
            `El reporte ${created.code} se registró, pero no se pudo subir: ${failedPhotos.join(', ')}.`
          );
          err.createdCode = created.code;
          err.failedPhotos = failedPhotos;
          err.photoUploadToken = uploadToken;
          throw err;
        }
      }

      return created.code;
    }

    // Modo demo: guarda en IndexedDB
    return this.repository.transaction('readwrite', (s) => s.add(report));  //Nose si esto va, alguen que lo revise
  }

 // Permite reintentar la subida de fotos fallidas conservando el código y token ya creados
  async uploadReportPhotos(
    code: string,
    photos: (Blob | File)[],
    uploadToken?: string
  ): Promise<string[]> {
    const failedNames: string[] = [];
    for (const photo of photos) {
      try {
        await this.api.uploadPhoto(code, photo, undefined, uploadToken);
      } catch {
        failedNames.push(photo instanceof File ? photo.name : 'fotografía');
      }
    }
    return failedNames;
  }

  // La transaccion vuelve a leer el expediente para evitar sobrescribir cambios concurrentes
  async updateReport(code: string, state: string, note: string, priority: string, version?: number): Promise<IncidentReport | void> {
    if (!this.config.demoMode) {
      // Modo API: la versión sirve para detectar cambios hechos por otra persona
      if (version === undefined) throw new Error('El expediente no incluye una versión válida. Recárgalo antes de guardar.');
      return fromIncidentDto(await this.api.changeIncident(code, toChangeIncident(state, priority, note, version)));
    }
    // Modo demo: actualiza dentro de una transacción de IndexedDB
    const user = this.auth.user();
    const db = await this.repository.openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('reports', 'readwrite');
      const store = tx.objectStore('reports');
      const req = store.get(code);
      let failure: Error | undefined;
      req.onsuccess = () => {
        const report = req.result as IncidentReport;
        try {
          // Validaciones de permisos, prioridad, transición de estado y observación
          if (!report || !canEditReport(user, report))
            throw new Error('No tienes competencia sobre este expediente');
          if (!['Baja', 'Media', 'Alta'].includes(priority))
            throw new Error('Selecciona una prioridad valida');
          if (state !== report.state && !allowedTransitions(report.state).includes(state))
            throw new Error('Transicion no permitida');
          if (note.trim().length < 10)
            throw new Error('La observacion debe tener al menos diez caracteres');
          // Guarda el cambio y agrega una entrada al historial
          store.put({
            ...report,
            priority,
            state,
            history: [
              ...report.history,
              { state, note: note.trim(), date: new Date().toISOString(), actorId: user!.id },
            ],
          });
        } catch (error) {
          // Cancela la transacción y guarda el error para rechazarlo al final
          failure = error as Error;
          tx.abort();
        }
      };
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(failure || tx.error || new Error('No se guardo el cambio'));
      tx.onerror = () => reject(tx.error);
    });
  }

  // Carga los reportes de ejemplo si todavía no existen
  async seed(): Promise<void> {
    for (let i = 0; i < this.samples.length; i++) {
      const [code, category, location, description, stateIndex] = this.samples[i];
      const existing = await this.getReport(code);
      if (existing) continue;
      // Historial: siempre inicia en "Recibido" y, si aplica, agrega el estado final
      const created = new Date(Date.UTC(2026, 10, 3 + i, 14)).toISOString();
      const history = [
        {
          date: created,
          state: this.states[0],
          note: 'Reporte de ejemplo recibido para su evaluación.',
        },
      ];
      if (stateIndex !== 0) {
        history.push({
          date: new Date(Date.UTC(2026, 10, 8, 14)).toISOString(),
          state: this.states[stateIndex],
          note:
            stateIndex === 1
              ? 'La unidad responsable inspeccionó el lugar e inició la atención.'
              : stateIndex === 2
                ? 'Se solicitó el repuesto necesario. La atención está en espera de materiales.'
                : stateIndex === 3
                  ? 'Se colocó y aseguró la tapa. El paso peatonal quedó habilitado.'
                  : 'Tras la inspección no se identificó un daño de infraestructura que requiera intervención.',
        });
      }

      try {
        await this.saveReport({
          code,
          category,
          location,
          description,
          state: this.states[stateIndex],
          created,
          history,
          photos: [],
          reference: '',
          sample: true,
          requesterArea: i % 2 ? 'Limpieza y Aseo' : 'Servicios Generales',
          priority: ['Media', 'Alta', 'Baja'][i % 3],
        });
      } catch (error: any) {
        // ConstraintError significa que el ejemplo ya existe, se ignora
        if (error?.name !== 'ConstraintError') {
          console.warn('Error al guardar semilla:', error);
        }
      }
    }
  }

  // Devuelve el nombre legible de una ubicación a partir de su id
  locationName(id: string): string {
    if (this.locations.some(location => location.name === id)) return id;
    const original = this.originalLocations.find((l) => l.id === id);
    const key = original
      ? this.originalLocations.indexOf(original) + 1
      : Number(id.replace('ubicacion-', ''));
    return this.admin.locations().find((l) => l.id === key)?.name || original?.name || id;
  }

  formatDate(date: string | Date): string {
    if (!date) return '';
    try {
      return new Intl.DateTimeFormat('es-SV', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'America/El_Salvador',
      }).format(new Date(date));
    } catch {
      return String(date);
    }
  }

  // Devuelve la clase CSS de la insignia según el estado
  getBadgeClass(state: string): string {
    const idx = this.states.indexOf(state);
    const classes = ['received', 'process', 'wait', 'resolved', 'closed'];
    return classes[idx] || 'received';
  }
}