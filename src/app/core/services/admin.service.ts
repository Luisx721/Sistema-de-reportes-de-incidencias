import { Injectable, signal } from '@angular/core';
import { Account, CatalogItem } from '../models/incident.model';

@Injectable({
  providedIn: 'root',
})
export class AdminService {
  private readonly initialAccounts: Account[] = [
    {
      id: 1,
      name: 'Carlos Menjívar',
      username: 'carlos.menjivar',
      role: 'Administrador',
      area: 'Dirección de Infraestructura',
      active: true,
    },
    {
      id: 2,
      name: 'Sonia Rivas',
      username: 'sonia.rivas',
      role: 'Jefatura',
      area: 'Servicios Generales',
      active: true,
    },
    {
      id: 3,
      name: 'Mauricio Fuentes',
      username: 'mauricio.fuentes',
      role: 'Mantenimiento',
      area: 'Mantenimiento Eléctrico',
      active: true,
    },
    {
      id: 4,
      name: 'Rosa Melgar',
      username: 'rosa.melgar',
      role: 'Ordenanza',
      area: 'Limpieza y Aseo',
      active: true,
    },
    {
      id: 5,
      name: 'Elena Castillo',
      username: 'elena.castillo',
      role: 'Desarrollo Físico',
      area: 'Planificación y Obras',
      active: true,
    },
    {
      id: 6,
      name: 'Walter Orellana',
      username: 'walter.orellana',
      role: 'Autoridad',
      area: 'Decanato FMO-UES',
      active: true,
    },
    {
      id: 7,
      name: 'Jorge Bonilla',
      username: 'jorge.bonilla',
      role: 'Mantenimiento',
      area: 'Fontanería y Obras Menores',
      active: false,
    },
  ];

  private readonly initialCategories: CatalogItem[] = [
    { id: 1, name: 'Mobiliario', active: true },
    { id: 2, name: 'Electricidad', active: true },
    { id: 3, name: 'Agua y saneamiento', active: true },
    { id: 4, name: 'Edificios', active: true },
    { id: 5, name: 'Espacios comunes', active: true },
    { id: 6, name: 'Cerrajería y accesos', active: false },
  ];

  private readonly initialLocations: CatalogItem[] = [
    { id: 1, name: 'Biblioteca', active: true },
    { id: 2, name: 'Edificio de aulas', active: true },
    { id: 3, name: 'Laboratorios', active: true },
    { id: 4, name: 'Administración', active: true },
    { id: 5, name: 'Áreas comunes', active: true },
    { id: 6, name: 'Cancha polideportiva', active: false },
  ];

  private accountsSignal = signal<Account[]>(JSON.parse(JSON.stringify(this.initialAccounts)));
  private categoriesSignal = signal<CatalogItem[]>(JSON.parse(JSON.stringify(this.initialCategories)));
  private locationsSignal = signal<CatalogItem[]>(JSON.parse(JSON.stringify(this.initialLocations)));

  readonly accounts = this.accountsSignal.asReadonly();
  readonly categories = this.categoriesSignal.asReadonly();
  readonly locations = this.locationsSignal.asReadonly();

  // Accounts operations
  saveAccount(data: { id?: number; name: string; username: string; role: string; area: string }): void {
    const list = [...this.accountsSignal()];
    if (data.id) {
      const idx = list.findIndex((a) => a.id === data.id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...data };
      }
    } else {
      const nextId = list.length ? Math.max(...list.map((a) => a.id)) + 1 : 1;
      list.push({
        id: nextId,
        name: data.name,
        username: data.username,
        role: data.role,
        area: data.area,
        active: true,
      });
    }
    this.accountsSignal.set(list);
  }

  setAccountActive(id: number, active: boolean): void {
    const list = this.accountsSignal().map((a) => (a.id === id ? { ...a, active } : a));
    this.accountsSignal.set(list);
  }

  // Catalog operations
  saveCatalogItem(type: 'categories' | 'locations', data: { id?: number; name: string }): void {
    const targetSignal = type === 'categories' ? this.categoriesSignal : this.locationsSignal;
    const list = [...targetSignal()];
    if (data.id) {
      const idx = list.findIndex((i) => i.id === data.id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], name: data.name };
      }
    } else {
      const nextId = list.length ? Math.max(...list.map((i) => i.id)) + 1 : 1;
      list.push({
        id: nextId,
        name: data.name,
        active: true,
      });
    }
    targetSignal.set(list);
  }

  setCatalogItemActive(type: 'categories' | 'locations', id: number, active: boolean): void {
    const targetSignal = type === 'categories' ? this.categoriesSignal : this.locationsSignal;
    const list = targetSignal().map((i) => (i.id === id ? { ...i, active } : i));
    targetSignal.set(list);
  }

  // Backup and Restore
  generateBackup(): void {
    const backupPayload = {
      sistema: 'Sistema de Reportes e Incidencias FMO-UES',
      modulo: 'Administración',
      fechaRespaldo: new Date().toISOString(),
      version: '1.0-demo',
      datos: {
        cuentas: this.accountsSignal(),
        catalogos: {
          categorias: this.categoriesSignal(),
          ubicaciones: this.locationsSignal(),
        },
      },
    };

    const jsonString = JSON.stringify(backupPayload, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateFormatted = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `respaldo_ues_incidencias_${dateFormatted}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  restoreDefaults(): void {
    this.accountsSignal.set(JSON.parse(JSON.stringify(this.initialAccounts)));
    this.categoriesSignal.set(JSON.parse(JSON.stringify(this.initialCategories)));
    this.locationsSignal.set(JSON.parse(JSON.stringify(this.initialLocations)));
  }
}
