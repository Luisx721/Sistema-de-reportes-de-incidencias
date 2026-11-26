import { inject, Injectable } from '@angular/core';
import { IncidentRepository } from '../../infrastructure/incident.repository';
import { IncidentReport } from '../../domain/models/incident.model';
// Servicio de respaldo: descarga todos los datos en un archivo JSON y los restaura.
@Injectable({ providedIn: 'root' })
export class BackupService {
  private repository = inject(IncidentRepository);
  // Datos guardados en el navegador que se incluyen en el respaldo
  private keys = ['ues-accounts', 'ues-categories', 'ues-locations', 'ues-community'];
  // Serializacion de fotografias para conservar los archivos fuera de IndexedDB
  // Genera y descarga el archivo de respaldo
  async download(): Promise<void> {
    const reports = await this.repository.transaction<IncidentReport[]>('readonly', (s) =>
      s.getAll(),
    );
     // Convierte cada fotografia a texto (data URL) para poder guardarla en el JSON
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
     // Cuentas y catalogos guardados en el navegador
    const settings = Object.fromEntries(this.keys.map((k) => [k, localStorage.getItem(k)]));
    // Crea el archivo y lo descarga con un enlace temporal
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
     // Limite de tamaño y formato general del archivo
    if (file.size > 100 * 1024 * 1024) throw new Error('El respaldo supera 100 MiB');
    const content = JSON.parse(await file.text());
    if (content.version !== 1 || !Array.isArray(content.reports) || !content.settings)
      throw new Error('Formato de respaldo no valido');
    const codes = new Set<string>();
     // Valida cada reporte: codigo unico, descripcion, categoria, ubicacion, historial y maximo 3 fotos
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
     // Estados permitidos
        const states = [
        'Recibido',
        'En proceso',
        'En espera de materiales/autorización',
        'Resuelto',
        'Rechazado/Cerrado',
      ];
        // El estado, las fechas y el historial deben ser validos y el ultimo estado debe coincidir
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
         // Fotografias: solo PNG o JPG, de maximo 5 MiB; se convierten de nuevo a archivo
        photos: r.photos.map((value: string) => {
          if (typeof value !== 'string' || !/^data:image\/(png|jpeg);base64,/.test(value))
            throw new Error('Fotografia no valida');
          const bytes = Uint8Array.from(atob(value.split(',')[1]), (c) => c.charCodeAt(0));
          if (bytes.length > 5242880) throw new Error('Fotografia demasiado grande');
          return new Blob([bytes], { type: value.slice(5, value.indexOf(';')) });
        }),
      };
    });
     // Valida cuentas, catalogos y cuentas de la comunidad
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
     // Copia de los datos actuales por si hay que deshacer
    const previous = Object.fromEntries(this.keys.map((k) => [k, localStorage.getItem(k)]));
    try {
            // Reemplaza los datos guardados en el navegador
      for (const key of this.keys) {
        const v = content.settings[key];
        v === null ? localStorage.removeItem(key) : localStorage.setItem(key, v);
      }
       // Reemplaza todos los reportes en una sola transaccion
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
    // Si algo falla, se devuelven los datos anteriores
      for (const key of this.keys) {
        const v = previous[key];
        v === null ? localStorage.removeItem(key) : localStorage.setItem(key, v);
      }
      throw error;
    }
     // Al terminar se cierra la sesion demo
    sessionStorage.removeItem('ues-demo-session');
  }
}
