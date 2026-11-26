import { readLocal, writeLocal } from '../../infrastructure/local-storage';
import { Injectable, inject, signal } from '@angular/core';
import { Account, CatalogItem } from '../../domain/models/incident.model';
import { API_CONFIG } from '../../infrastructure/api-config';
import { ApiClient } from '../../infrastructure/api-client';

export interface AdminCatalogItem extends CatalogItem {
  areaId?: number;
  areaName?: string;
  buildingId?: number;
  buildingName?: string;
}

@Injectable({
  providedIn: 'root',
})
export class AdminService {
  private config = inject(API_CONFIG);
  private api = inject(ApiClient);

  private readonly initialAccounts: Account[] = [
    { 
      id: 1, 
      name: 'Carlos Menjívar', 
      username: 'carlos.menjivar', 
      role: 'Administrador', 
      area: 'Dirección de Infraestructura', 
      active: true },
    { 
      id: 2, 
      name: 'Sonia Rivas', 
      username: 'sonia.rivas', 
      role: 'Jefatura', 
      area: 'Servicios Generales', 
      active: true },
  ];

  private readonly initialCategories: AdminCatalogItem[] = [
    { 
      id: 1, 
      name: 'Mobiliario', 
      active: true, 
      areaId: 1, 
      areaName: 'Servicios Generales' },
    { 
      id: 2, 
      name: 'Electricidad', 
      active: true, 
      areaId: 1, 
      areaName: 'Mantenimiento' },
  ];

  private readonly initialLocations: AdminCatalogItem[] = [
    { 
      id: 1, 
      name: 'Biblioteca', 
      active: true, 
      buildingId: 1, 
      buildingName: 'Edificio Central' },
    { 
      id: 2, 
      name: 'Edificio de aulas', 
      active: true, 
      buildingId: 1, 
      buildingName: 'Aulas' },
  ];

  private accountsSignal = signal<Account[]>(readLocal('ues-accounts', this.initialAccounts));
  private categoriesSignal = signal<AdminCatalogItem[]>(readLocal('ues-categories', this.initialCategories));
  private locationsSignal = signal<AdminCatalogItem[]>(readLocal('ues-locations', this.initialLocations));
  private areasSignal = signal<{ id: number; name: string; active: boolean }[]>([]);
  private buildingsSignal = signal<{ id: number; name: string; active: boolean }[]>([]);

  readonly accounts = this.accountsSignal.asReadonly();
  readonly categories = this.categoriesSignal.asReadonly();
  readonly locations = this.locationsSignal.asReadonly();
  readonly areas = this.areasSignal.asReadonly();
  readonly buildings = this.buildingsSignal.asReadonly();

  get demoMode(): boolean {
    return this.config.demoMode;
  }

  async loadAll(): Promise<void> {
    if (this.config.demoMode) return;
    const [accounts, categories, locations, areas, buildings] = await Promise.all([
      this.api.getAdminAccounts(),
      this.api.getAdminCategories(true),
      this.api.getAdminLocations(true),
      this.api.getAdminAreas(true),
      this.api.getAdminBuildings(true),
    ]);
    this.accountsSignal.set(accounts);
    this.categoriesSignal.set(categories);
    this.locationsSignal.set(locations);
    this.areasSignal.set(areas);
    this.buildingsSignal.set(buildings);
  }

  async saveAccount(data: {
    id?: number;
    name: string;
    username: string;
    password?: string;
    role: string;
    area: string;
  }): Promise<void> {
    if (!data.name.trim() || !data.username.trim() || !data.area.trim()) {
      throw new Error('Completa los datos de la cuenta');
    }

    if (!this.config.demoMode) {
      if (data.id) {
        const existing = this.accountsSignal().find((a) => a.id === data.id);
        await this.api.updateAdminAccount(data.id, {
          name: data.name.trim(),
          username: data.username.trim(),
          password: data.password?.trim() || undefined,
          role: data.role,
          area: data.area.trim(),
          active: existing?.active ?? true,
        });
      } else {
        if (!data.password?.trim()) {
          throw new Error('Ingresa una contraseña inicial para la nueva cuenta.');
        }
        await this.api.createAdminAccount({
          name: data.name.trim(),
          username: data.username.trim(),
          password: data.password.trim(),
          role: data.role,
          area: data.area.trim(),
          active: true,
        });
      }
      this.accountsSignal.set(await this.api.getAdminAccounts());
      return;
    }

    if (
      this.accountsSignal().some(
        (a) => a.id !== data.id && a.username.toLowerCase() === data.username.trim().toLowerCase(),
      )
    ) {
      throw new Error('El usuario ya existe');
    }
    const list = [...this.accountsSignal()];
    if (data.id) {
      const idx = list.findIndex((a) => a.id === data.id);
      if (idx !== -1) list[idx] = { ...list[idx], ...data };
    } else {
      const nextId = list.length ? Math.max(...list.map((a) => a.id)) + 1 : 1;
      list.push({ id: nextId, name: data.name, username: data.username, role: data.role, area: data.area, active: true });
    }
    writeLocal('ues-accounts', list);
    this.accountsSignal.set(list);
  }

  async setAccountActive(id: number, active: boolean): Promise<void> {
    if (!this.config.demoMode) {
      await this.api.setAdminAccountActive(id, active);
      this.accountsSignal.set(await this.api.getAdminAccounts());
      return;
    }
    const list = this.accountsSignal().map((a) => (a.id === id ? { ...a, active } : a));
    writeLocal('ues-accounts', list);
    this.accountsSignal.set(list);
  }

  async saveCatalogItem(
    type: 'categories' | 'locations',
    data: { id?: number; name: string; areaId?: number; buildingId?: number }
  ): Promise<void> {
    if (!data.name.trim()) throw new Error('Nombre vacío.');

    if (!this.config.demoMode) {
      if (type === 'categories') {
        const areaId = data.areaId || this.areasSignal()[0]?.id || 1;
        const existing = this.categoriesSignal().find((c) => c.id === data.id);
        if (data.id) {
          await this.api.updateAdminCategory(data.id, { name: data.name.trim(), areaId, active: existing?.active ?? true });
        } else {
          await this.api.createAdminCategory({ name: data.name.trim(), areaId, active: true });
        }
        this.categoriesSignal.set(await this.api.getAdminCategories(true));
      } else {
        const buildingId = data.buildingId || this.buildingsSignal()[0]?.id || 1;
        const existing = this.locationsSignal().find((l) => l.id === data.id);
        if (data.id) {
          await this.api.updateAdminLocation(data.id, { name: data.name.trim(), buildingId, active: existing?.active ?? true });
        } else {
          await this.api.createAdminLocation({ name: data.name.trim(), buildingId, active: true });
        }
        this.locationsSignal.set(await this.api.getAdminLocations(true));
      }
      return;
    }

    const targetSignal = type === 'categories' ? this.categoriesSignal : this.locationsSignal;
    if (
      targetSignal().some(
        (i) => i.id !== data.id && i.name.toLowerCase() === data.name.trim().toLowerCase(),
      )
    ) {
      throw new Error('Nombre vacío o duplicado');
    }
    const list = [...targetSignal()];
    if (data.id) {
      const idx = list.findIndex((i) => i.id === data.id);
      if (idx !== -1) list[idx] = { ...list[idx], name: data.name };
    } else {
      const nextId = list.length ? Math.max(...list.map((i) => i.id)) + 1 : 1;
      list.push({ id: nextId, name: data.name, active: true });
    }
    writeLocal('ues-' + type, list);
    targetSignal.set(list);
  }

  async setCatalogItemActive(type: 'categories' | 'locations', id: number, active: boolean): Promise<void> {
    if (!this.config.demoMode) {
      if (type === 'categories') {
        await this.api.setAdminCategoryActive(id, active);
        this.categoriesSignal.set(await this.api.getAdminCategories(true));
      } else {
        await this.api.setAdminLocationActive(id, active);
        this.locationsSignal.set(await this.api.getAdminLocations(true));
      }
      return;
    }
    const targetSignal = type === 'categories' ? this.categoriesSignal : this.locationsSignal;
    const list = targetSignal().map((i) => (i.id === id ? { ...i, active } : i));
    writeLocal('ues-' + type, list);
    targetSignal.set(list);
  }

  restoreDefaults(): void {
    for (const [key, value] of Object.entries({
      accounts: this.initialAccounts,
      categories: this.initialCategories,
      locations: this.initialLocations,
    })) {
      writeLocal('ues-' + key, value);
    }
    this.accountsSignal.set(JSON.parse(JSON.stringify(this.initialAccounts)));
    this.categoriesSignal.set(JSON.parse(JSON.stringify(this.initialCategories)));
    this.locationsSignal.set(JSON.parse(JSON.stringify(this.initialLocations)));
  }
}