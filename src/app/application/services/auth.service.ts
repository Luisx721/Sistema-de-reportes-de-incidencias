import { computed, inject, Injectable, signal } from '@angular/core';
import { SessionUser } from '../../domain/models/incident.model';
import { AdminService } from './admin.service';
import { readLocal, writeLocal } from '../../infrastructure/local-storage';
import { API_CONFIG } from '../../infrastructure/api-config';
import { ApiClient } from '../../infrastructure/api-client';

// Servicio de sesion: inicio y cierre de sesion, registro y usuario actual.
// En modo demo la sesion vive en el navegador; en modo real usa un token de la API.
@Injectable({ providedIn: 'root' })
export class AuthService {
  // Dependencias y estado privado de la sesion de demostracion
  private admin = inject(AdminService);
  private api = inject(ApiClient);
  private config = inject(API_CONFIG);
  private current = signal<SessionUser | null>(this.config.demoMode ? this.restore() : null);
  // Se completa cuando termina de recuperarse la sesion (lo espera el guard)
  readonly ready: Promise<void>;
  constructor() {
    // En modo API, si hay token guardado, se valida con el servidor al iniciar
    this.ready = !this.config.demoMode && sessionStorage.getItem('ues-api-token')
      ? this.refreshSession() : Promise.resolve();
  }
   // Usuario actual. En demo toma nombre, perfil y area de la cuenta activa;
  // si la cuenta fue desactivada, devuelve null
  readonly user = computed(() => {
    const session = this.current();
    if (!session || !session.demo || session.profile === 'Reportante') return session;
    const account = this.admin.accounts().find((a) => a.id === session.id && a.active);
    return account
      ? { ...session, name: account.name, profile: account.role, area: account.area }
      : null;
  });
   // Recupera la sesion demo guardada en el navegador
  private restore(): SessionUser | null {
    try {
      return JSON.parse(sessionStorage.getItem('ues-demo-session') || 'null');
    } catch {
      return null;
    }
  }
  // Validacion local para pruebas sin autenticacion de servidor
  async login(username: string, password: string): Promise<boolean> {
        // Modo API: la API valida y devuelve un token; 401 significa datos incorrectos
    if (!this.config.demoMode) {
      try {
        const session = await this.api.login(username.trim(), password);
        sessionStorage.setItem('ues-api-token', session.token);
        this.current.set({
          id: session.userId ?? undefined,
          name: session.name,
          profile: session.profile,
          area: session.area ?? undefined,
          demo: false,
        });
        return true;
      } catch (error: any) {
        if (error?.status === 401) return false;
        throw error;
      }
    }
     // Modo demo: perfil reportante de prueba
    if (username.trim().toLowerCase() === 'reportante@demo.ues' && password === 'DemoUES2026!') {
      this.setSession({
        id: 1000,
        name: 'Reportante de prueba',
        profile: 'Reportante',
        demo: true,
      });
      return true;
    }

    // Modo demo: cuentas internas (deben estar activas y usar la contraseña de demostracion)
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
    // Modo demo: cuentas de la comunidad registradas en el navegador
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
  // Registra una cuenta de la comunidad (solo modo demo) e inicia sesion
  async register(name: string, email: string, password: string): Promise<void> {
    if (!this.config.demoMode) throw new Error('La API todavía no ofrece registro de cuentas.');
    const accounts = readLocal<
      Array<{ id: number; name: string; email: string; password: string }>
    // Validaciones: nombre, correo con formato valido y contrasena de 8 o mas caracteres
      >('ues-community', []);
    if (!name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8)
      throw new Error('Datos de registro invalidos');
    // El correo no puede estar repetido
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
   // Convierte la contraseña en un hash SHA-256 para no guardarla en texto plano
  private async digest(value: string): Promise<string> {
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
    return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Guarda la sesion demo en el navegador
  private setSession(user: SessionUser): void {
    sessionStorage.setItem('ues-demo-session', JSON.stringify(user));
    this.current.set(user);
  }
   // Pide a la API los datos de la sesion; si falla, limpia el token
  async refreshSession(): Promise<void> {
    if (this.config.demoMode) return;
    try {
      const session = await this.api.currentSession();
      this.current.set({
        id: session.userId ?? undefined,
        name: session.name,
        profile: session.profile,
        area: session.area ?? undefined,
        demo: false,
      });
    } catch {
      sessionStorage.removeItem('ues-api-token');
      this.current.set(null);
    }
  }
   // Cierra la sesion (en modo API tambien avisa al servidor)
  async endSession(): Promise<void> {
    if (!this.config.demoMode && sessionStorage.getItem('ues-api-token')) {
      try { await this.api.endSession(); } catch { /* Se limpia el token aunque ya haya expirado. */ }
      sessionStorage.removeItem('ues-api-token');
      this.current.set(null);
      return;
    }
    sessionStorage.removeItem('ues-demo-session');
    this.current.set(null);
  }
   // Devuelve el usuario actual
  getSession(): SessionUser | null {
    return this.user();
  }
}
