import { Injectable, signal } from '@angular/core';
import { SessionUser } from '../models/incident.model';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly storageKey = 'ues-demo-session';
  private currentUser = signal<SessionUser | null>(this.readInitialSession());

  readonly user = this.currentUser.asReadonly();

  private readInitialSession(): SessionUser | null {
    try {
      const data = sessionStorage.getItem(this.storageKey);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  startSession(user: { name: string; profile?: string }): void {
    const session: SessionUser = {
      name: user.name,
      profile: user.profile || 'reportante',
      demo: true,
    };
    try {
      sessionStorage.setItem(this.storageKey, JSON.stringify(session));
    } catch {
      // storage unavailable or quota error
    }
    this.currentUser.set(session);
  }

  endSession(): void {
    try {
      sessionStorage.removeItem(this.storageKey);
    } catch {
      // storage unavailable
    }
    this.currentUser.set(null);
  }

  getSession(): SessionUser | null {
    return this.currentUser();
  }
}
