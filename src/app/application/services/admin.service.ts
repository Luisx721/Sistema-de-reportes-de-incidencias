import { readLocal, writeLocal } from '../../infrastructure/local-storage';
import { Injectable, signal } from '@angular/core';
import { Account, CatalogItem } from '../../domain/models/incident.model';

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

  private accountsSignal = signal<Account[]>(readLocal('ues-accounts', this.initialAccounts));
  private categoriesSignal = signal<CatalogItem[]>(
    readLocal('ues-categories', this.initialCategories),
  );
  private locationsSignal = signal<CatalogItem[]>(
    readLocal('ues-locations', this.initialLocations),
  );

  readonly accounts = this.accountsSignal.asReadonly();
  readonly categories = this.categoriesSignal.asReadonly();
  readonly locations = this.locationsSignal.asReadonly();

  // Validaciones y operaciones de cuentas
  saveAccount(data: {
    id?: number;
    name: string;
    username: string;
    role: string;
    area: string;
  }): void {
    if (!data.name.trim() || !data.username.trim() || !data.area.trim())
      throw new Error('Completa los datos de la cuenta');
    if (
      this.accountsSignal().some(
        (a) => a.id !== data.id && a.username.toLowerCase() === data.username.trim().toLowerCase(),
      )
    )
      throw new Error('El usuario ya existe');
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
    writeLocal('ues-accounts', list);
    this.accountsSignal.set(list);
  }

  setAccountActive(id: number, active: boolean): void {
    const list = this.accountsSignal().map((a) => (a.id === id ? { ...a, active } : a));
    writeLocal('ues-accounts', list);
    this.accountsSignal.set(list);
  }

  // Validaciones y operaciones de catalogos
  saveCatalogItem(type: 'categories' | 'locations', data: { id?: number; name: string }): void {
    const targetSignal = type === 'categories' ? this.categoriesSignal : this.locationsSignal;
    if (
      !data.name.trim() ||
      targetSignal().some(
        (i) => i.id !== data.id && i.name.toLowerCase() === data.name.trim().toLowerCase(),
      )
    )
      throw new Error('Nombre vacio o duplicado');
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
    writeLocal('ues-' + type, list);
    targetSignal.set(list);
  }

  setCatalogItemActive(type: 'categories' | 'locations', id: number, active: boolean): void {
    const targetSignal = type === 'categories' ? this.categoriesSignal : this.locationsSignal;
    const list = targetSignal().map((i) => (i.id === id ? { ...i, active } : i));
    writeLocal('ues-' + type, list);
    targetSignal.set(list);
  }

  // Exportacion y reinicio de datos administrativos
  restoreDefaults(): void {
    for (const [key, value] of Object.entries({
      accounts: this.initialAccounts,
      categories: this.initialCategories,
      locations: this.initialLocations,
    }))
      writeLocal('ues-' + key, value);
    this.accountsSignal.set(JSON.parse(JSON.stringify(this.initialAccounts)));
    this.categoriesSignal.set(JSON.parse(JSON.stringify(this.initialCategories)));
    this.locationsSignal.set(JSON.parse(JSON.stringify(this.initialLocations)));
  }
}
