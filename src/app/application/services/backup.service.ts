import { inject, Injectable } from '@angular/core';
import { IncidentRepository } from '../../infrastructure/incident.repository';
import { IncidentReport } from '../../domain/models/incident.model';

@Injectable({ providedIn: 'root' })
export class BackupService {
  private repository = inject(IncidentRepository);
  private keys = ['ues-accounts', 'ues-categories', 'ues-locations', 'ues-community'];
  // Serializacion de fotografias para conservar los archivos fuera de IndexedDB
  async download(): Promise<void> {
    const reports = await this.repository.transaction<IncidentReport[]>('readonly', (s) =>
      s.getAll(),
    );
    const encoded = await Promise.all(
      reports.map(async (r) => ({
        ...r,
        photos: await Promise.all(
          r.photos.map(
            (p) =>
              new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(String(reader.result));
                reader.onerror = () => reject(reader.error);
                reader.readAsDataURL(p);
              }),
          ),
        ),
      })),
    );
    const settings = Object.fromEntries(this.keys.map((k) => [k, localStorage.getItem(k)]));
    const url = URL.createObjectURL(
      new Blob([JSON.stringify({ version: 1, reports: encoded, settings })], {
        type: 'application/json',
      }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = 'respaldo-completo-ues.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  // Validar todo el archivo antes de reemplazar los datos locales
  async restore(file: File): Promise<void> {
    if (file.size > 100 * 1024 * 1024) throw new Error('El respaldo supera 100 MiB');
    const content = JSON.parse(await file.text());
    if (content.version !== 1 || !Array.isArray(content.reports) || !content.settings)
      throw new Error('Formato de respaldo no valido');
    const codes = new Set<string>();
    const reports: IncidentReport[] = content.reports.map((r: any) => {
      if (
        typeof r.code !== 'string' ||
        codes.has(r.code) ||
        typeof r.description !== 'string' ||
        r.description.length < 20 ||
        typeof r.category !== 'string' ||
        typeof r.location !== 'string' ||
        !Array.isArray(r.history) ||
        !r.history.length ||
        !Array.isArray(r.photos) ||
        r.photos.length > 3
      )
        throw new Error('Expediente no valido');
      const states = [
        'Recibido',
        'En proceso',
        'En espera de materiales/autorización',
        'Resuelto',
        'Rechazado/Cerrado',
      ];
      if (
        !states.includes(r.state) ||
        !Number.isFinite(Date.parse(r.created)) ||
        r.history.some(
          (h: any) =>
            !states.includes(h.state) ||
            typeof h.note !== 'string' ||
            !Number.isFinite(Date.parse(h.date)),
        ) ||
        r.history.at(-1).state !== r.state
      )
        throw new Error('Historial no valido');
      codes.add(r.code);
      return {
        ...r,
        photos: r.photos.map((value: string) => {
          if (typeof value !== 'string' || !/^data:image\/(png|jpeg);base64,/.test(value))
            throw new Error('Fotografia no valida');
          const bytes = Uint8Array.from(atob(value.split(',')[1]), (c) => c.charCodeAt(0));
          if (bytes.length > 5242880) throw new Error('Fotografia demasiado grande');
          return new Blob([bytes], { type: value.slice(5, value.indexOf(';')) });
        }),
      };
    });
    for (const key of this.keys) {
      const value = content.settings[key];
      if (value !== null && (typeof value !== 'string' || !Array.isArray(JSON.parse(value))))
        throw new Error('Configuracion no valida');
      if (value !== null) {
        const rows = JSON.parse(value);
        if (rows.some((r: any) => !Number.isFinite(r.id) || typeof r.name !== 'string'))
          throw new Error('Catalogo o cuenta no valido');
        if (
          key === 'ues-accounts' &&
          rows.some(
            (r: any) =>
              typeof r.username !== 'string' ||
              typeof r.area !== 'string' ||
              ![
                'Administrador',
                'Jefatura',
                'Ordenanza',
                'Mantenimiento',
                'Desarrollo Físico',
                'Autoridad',
              ].includes(r.role) ||
              typeof r.active !== 'boolean',
          )
        )
          throw new Error('Cuenta no valida');
        if (
          ['ues-categories', 'ues-locations'].includes(key) &&
          rows.some((r: any) => typeof r.active !== 'boolean')
        )
          throw new Error('Catalogo no valido');
        if (
          key === 'ues-community' &&
          rows.some((r: any) => typeof r.email !== 'string' || typeof r.password !== 'string')
        )
          throw new Error('Cuenta comunitaria no valida');
      }
    }
    const previous = Object.fromEntries(this.keys.map((k) => [k, localStorage.getItem(k)]));
    try {
      for (const key of this.keys) {
        const v = content.settings[key];
        v === null ? localStorage.removeItem(key) : localStorage.setItem(key, v);
      }
      const db = await this.repository.openDatabase();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('reports', 'readwrite');
        const store = tx.objectStore('reports');
        store.clear();
        reports.forEach((r) => store.add(r));
        tx.oncomplete = () => resolve();
        tx.onerror = tx.onabort = () => reject(tx.error || new Error('No se pudo restaurar'));
      });
    } catch (error) {
      for (const key of this.keys) {
        const v = previous[key];
        v === null ? localStorage.removeItem(key) : localStorage.setItem(key, v);
      }
      throw error;
    }
    sessionStorage.removeItem('ues-demo-session');
  }
}
