import { Injectable } from '@angular/core';
@Injectable({ providedIn: 'root' })
export class IncidentRepository {
  // Conexion y transacciones del adaptador local
  private dbPromise: Promise<IDBDatabase> | null = null;

  openDatabase(): Promise<IDBDatabase> {
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

  async transaction<T>(
    mode: IDBTransactionMode,
    action: (store: IDBObjectStore) => IDBRequest<T>,
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
}
