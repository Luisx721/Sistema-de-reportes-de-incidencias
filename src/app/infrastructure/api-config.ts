import { InjectionToken } from '@angular/core';

export interface ApiConfig { baseUrl: string; demoMode: boolean; }
export const API_CONFIG = new InjectionToken<ApiConfig>('API_CONFIG', {
  providedIn: 'root', factory: () => ({
    baseUrl: 'http://localhost:5080',
    // Switch explícito para el prototipo local; ausencia o cualquier otro valor usa la API.
    demoMode: typeof localStorage !== 'undefined' && localStorage.getItem('ues-api-mode') === 'demo',
  }),
});
