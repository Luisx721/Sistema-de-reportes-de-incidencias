import { Injectable } from '@angular/core';
import { CampusLocation, IncidentReport } from '../models/incident.model';

@Injectable({
  providedIn: 'root',
})
export class DataService {
  readonly categories: string[] = [
    'Mobiliario',
    'Electricidad',
    'Agua y saneamiento',
    'Edificios',
    'Espacios comunes',
  ];

  readonly locations: CampusLocation[] = [
    { id: 'biblioteca', name: 'Biblioteca', x: 24, y: 27, lat: 13.44115, lng: -88.15905 },
    { id: 'aulas', name: 'Edificio de aulas', x: 68, y: 24, lat: 13.4411, lng: -88.1576 },
    { id: 'laboratorios', name: 'Laboratorios', x: 26, y: 52, lat: 13.4401, lng: -88.1591 },
    { id: 'administracion', name: 'Administración', x: 73, y: 62, lat: 13.44005, lng: -88.1575 },
    { id: 'zonas-comunes', name: 'Áreas comunes', x: 43, y: 79, lat: 13.4396, lng: -88.15835 },
  ];

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

  private dbPromise: Promise<IDBDatabase> | null = null;

  private openDatabase(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        if (typeof indexedDB === 'undefined') {
          reject(new Error('IndexedDB no está disponible en este entorno.'));
          return;
        }
        const req = indexedDB.open('ues-incidencias-demo', 1);
        req.onupgradeneeded = () => {
          req.result.createObjectStore('reports', { keyPath: 'code' });
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => {
          this.dbPromise = null;
          reject(req.error);
        };
      });
    }
    return this.dbPromise;
  }

  private async transaction<T>(
    mode: IDBTransactionMode,
    action: (store: IDBObjectStore) => IDBRequest<T>
  ): Promise<T> {
    const db = await this.openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('reports', mode);
      const req = action(tx.objectStore('reports'));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error || req.error);
      tx.onabort = () => reject(tx.error || new Error('Transacción abortada.'));
    });
  }

  async getReport(code: string): Promise<IncidentReport | undefined> {
    return this.transaction<IncidentReport | undefined>('readonly', (s) => s.get(code));
  }

  async getReports(): Promise<IncidentReport[]> {
    return this.transaction<IncidentReport[]>('readonly', (s) => s.getAll());
  }

  async saveReport(report: IncidentReport): Promise<IDBValidKey> {
    return this.transaction('readwrite', (s) => s.add(report));
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
        });
      } catch (error: any) {
        if (error?.name !== 'ConstraintError') {
          console.warn('Error al guardar semilla:', error);
        }
      }
    }
  }

  locationName(id: string): string {
    return this.locations.find((l) => l.id === id)?.name || id;
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
