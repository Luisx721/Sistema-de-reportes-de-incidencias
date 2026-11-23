import { computed, inject, Injectable, signal } from '@angular/core';
import { SessionUser } from '../../domain/models/incident.model';
import { AdminService } from './admin.service';
import { readLocal, writeLocal } from '../../infrastructure/local-storage';

@Injectable({ providedIn: 'root' })
export class AuthService {
  // Dependencias y estado privado de la sesion de demostracion
  private admin = inject(AdminService);
  private current = signal<SessionUser | null>(this.restore());
  readonly user = computed(() => {
    const session = this.current();
    if (!session || session.profile === 'Reportante') return session;
    const account = this.admin.accounts().find((a) => a.id === session.id && a.active);
    return account
      ? { ...session, name: account.name, profile: account.role, area: account.area }
      : null;
  });
  private restore(): SessionUser | null {
    try {
      return JSON.parse(sessionStorage.getItem('ues-demo-session') || 'null');
    } catch {
      return null;
    }
  }
  // Validacion local para pruebas sin autenticacion de servidor
  async login(username: string, password: string): Promise<boolean> {
    if (username.trim().toLowerCase() === 'reportante@demo.ues' && password === 'DemoUES2026!') {
      this.setSession({
        id: 1000,
        name: 'Reportante de prueba',
        profile: 'Reportante',
        demo: true,
      });
      return true;
    }
    const account = this.admin
      .accounts()
      .find((a) => a.username.toLowerCase() === username.trim().toLowerCase());
    if (account) {
      if (!account.active || password !== 'DemoUES2026!') return false;
      this.setSession({
        id: account.id,
        name: account.name,
        profile: account.role,
        area: account.area,
        demo: true,
      });
      return true;
    }
    const digest = await this.digest(password);
    const accounts = readLocal<
      Array<{ id: number; name: string; email: string; password: string }>
    >('ues-community', []);
    const publicAccount = accounts.find(
      (a) => a.email === username.trim().toLowerCase() && a.password === digest,
    );
    if (!publicAccount) return false;
    this.setSession({
      id: publicAccount.id,
      name: publicAccount.name,
      profile: 'Reportante',
      demo: true,
    });
    return true;
  }
  async register(name: string, email: string, password: string): Promise<void> {
    const accounts = readLocal<
      Array<{ id: number; name: string; email: string; password: string }>
    >('ues-community', []);
    if (!name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8)
      throw new Error('Datos de registro invalidos');
    if (
      email.trim().toLowerCase() === 'reportante@demo.ues' ||
      accounts.some((a) => a.email === email.trim().toLowerCase())
    )
      throw new Error('El correo ya esta registrado');
    const account = {
      id: Date.now(),
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password: await this.digest(password),
    };
    writeLocal('ues-community', [...accounts, account]);
    await this.login(email, password);
  }
  private async digest(value: string): Promise<string> {
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
    return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('');
  }
  private setSession(user: SessionUser): void {
    sessionStorage.setItem('ues-demo-session', JSON.stringify(user));
    this.current.set(user);
  }
  endSession(): void {
    sessionStorage.removeItem('ues-demo-session');
    this.current.set(null);
  }
  getSession(): SessionUser | null {
    return this.user();
  }
}
