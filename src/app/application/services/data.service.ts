import { IncidentRepository } from '../../infrastructure/incident.repository';
import { AdminService } from './admin.service';
import { AuthService } from './auth.service';
import { allowedTransitions, canEditReport } from '../../domain/policies/permissions';
import { Injectable, inject } from '@angular/core';
import { CampusLocation, IncidentReport } from '../../domain/models/incident.model';

@Injectable({
  providedIn: 'root',
})
export class DataService {
  private repository = inject(IncidentRepository);
  private admin = inject(AdminService);
  private auth = inject(AuthService);
  private readonly originalCategories: string[] = [
    'Mobiliario',
    'Electricidad',
    'Agua y saneamiento',
    'Edificios',
    'Espacios comunes',
  ];

  private readonly originalLocations: CampusLocation[] = [
    { id: 'biblioteca', name: 'Biblioteca', x: 24, y: 27, lat: 13.44115, lng: -88.15905 },
    { id: 'aulas', name: 'Edificio de aulas', x: 68, y: 24, lat: 13.4411, lng: -88.1576 },
    { id: 'laboratorios', name: 'Laboratorios', x: 26, y: 52, lat: 13.4401, lng: -88.1591 },
    { id: 'administracion', name: 'Administración', x: 73, y: 62, lat: 13.44005, lng: -88.1575 },
    { id: 'zonas-comunes', name: 'Áreas comunes', x: 43, y: 79, lat: 13.4396, lng: -88.15835 },
  ];

  // Catalogos activos compartidos con administracion
  get categories(): string[] {
    return this.admin
      .categories()
      .filter((c) => c.active)
      .map((c) => c.name);
  }
  get locations(): CampusLocation[] {
    return this.admin
      .locations()
      .filter((l) => l.active)
      .map((l) => ({
        ...(this.originalLocations[l.id - 1] || {
          id: 'ubicacion-' + l.id,
          x: 50,
          y: 50,
          lat: 0,
          lng: 0,
        }),
        name: l.name,
      }));
  }
  readonly states: string[] = [
    'Recibido',
    'En proceso',
    'En espera de materiales/autorización',
    'Resuelto',
    'Rechazado/Cerrado',
  ];

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

  async getReport(code: string): Promise<IncidentReport | undefined> {
    return this.repository.transaction<IncidentReport | undefined>('readonly', (s) => s.get(code));
  }

  async getReports(): Promise<IncidentReport[]> {
    return this.repository.transaction<IncidentReport[]>('readonly', (s) => s.getAll());
  }

  async saveReport(report: IncidentReport): Promise<IDBValidKey> {
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

    return this.repository.transaction('readwrite', (s) => s.add(report));
  }

  // La transaccion vuelve a leer el expediente para evitar sobrescribir cambios concurrentes
  async updateReport(code: string, state: string, note: string, priority: string): Promise<void> {
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
          if (!report || !canEditReport(user, report))
            throw new Error('No tienes competencia sobre este expediente');
          if (!['Baja', 'Media', 'Alta'].includes(priority))
            throw new Error('Selecciona una prioridad valida');
          if (state !== report.state && !allowedTransitions(report.state).includes(state))
            throw new Error('Transicion no permitida');
          if (note.trim().length < 10)
            throw new Error('La observacion debe tener al menos diez caracteres');
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
          failure = error as Error;
          tx.abort();
        }
      };
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(failure || tx.error || new Error('No se guardo el cambio'));
      tx.onerror = () => reject(tx.error);
    });
  }

  async seed(): Promise<void> {
    for (let i = 0; i < this.samples.length; i++) {
      const [code, category, location, description, stateIndex] = this.samples[i];
      const existing = await this.getReport(code);
      if (existing) continue;

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
        if (error?.name !== 'ConstraintError') {
          console.warn('Error al guardar semilla:', error);
        }
      }
    }
  }

  locationName(id: string): string {
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

  getBadgeClass(state: string): string {
    const idx = this.states.indexOf(state);
    const classes = ['received', 'process', 'wait', 'resolved', 'closed'];
    return classes[idx] || 'received';
  }
}
