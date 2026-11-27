import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { API_CONFIG } from './api-config';
import {
  ChangeIncidentDto,
  CreateIncidentDto,
  IncidentCatalogsDto,
  IncidentDto,
  PhotoDto,
  PublicIncidentSummaryDto,
  PublicStatusDto,
  SessionDto,
} from './api-mappers';

@Injectable({ providedIn: 'root' })
export class ApiClient {
  private http = inject(HttpClient);
  private config = inject(API_CONFIG);

  private get base(): string {
    return this.config.baseUrl.replace(/\/$/, '');
  }

  private get headers(): HttpHeaders {
    const token = sessionStorage.getItem('ues-api-token');
    return token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : new HttpHeaders();
  }

  login(username: string, password: string): Promise<SessionDto> {
    return firstValueFrom(
      this.http.post<SessionDto>(`${this.base}/api/sesiones`, { username, password })
    );
  }

  currentSession(): Promise<SessionDto> {
    return firstValueFrom(
      this.http.get<SessionDto>(`${this.base}/api/sesiones/actual`, { headers: this.headers })
    );
  }

  endSession(): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(`${this.base}/api/sesiones/actual`, { headers: this.headers })
    );
  }

  createIncident(body: CreateIncidentDto): Promise<IncidentDto> {
    return firstValueFrom(
      this.http.post<IncidentDto>(`${this.base}/api/incidencias`, body, { headers: this.headers })
    );
  }

  uploadPhoto(code: string, file: File | Blob, fileName?: string): Promise<PhotoDto> {
    const formData = new FormData();
    formData.append('foto', file, fileName || (file instanceof File ? file.name : 'evidencia.jpg'));
    return firstValueFrom(
      this.http.post<PhotoDto>(
        `${this.base}/api/incidencias/${encodeURIComponent(code)}/fotos`,
        formData,
        { headers: this.headers }
      )
    );
  }

  listPhotos(code: string): Promise<PhotoDto[]> {
    return firstValueFrom(
      this.http.get<PhotoDto[]>(
        `${this.base}/api/incidencias/${encodeURIComponent(code)}/fotos`,
        { headers: this.headers }
      )
    );
  }

  getCatalogs(): Promise<IncidentCatalogsDto> {
    return firstValueFrom(this.http.get<IncidentCatalogsDto>(`${this.base}/api/catalogos`));
  }

  track(code: string): Promise<PublicStatusDto> {
    return firstValueFrom(
      this.http.get<PublicStatusDto>(`${this.base}/api/seguimiento/${encodeURIComponent(code)}`)
    );
  }

  listPublicIncidents(
    filters: {
      category?: string;
      state?: string;
    } = {}
  ): Promise<PublicIncidentSummaryDto[]> {
    const params = Object.fromEntries(
      Object.entries(filters).filter(([, value]) => !!value?.trim())
    ) as Record<string, string>;
    return firstValueFrom(
      this.http.get<PublicIncidentSummaryDto[]>(`${this.base}/api/incidencias/publicas`, {
        params,
      })
    );
  }

  listIncidents(
    filters: {
      query?: string;
      category?: string;
      location?: string;
      state?: string;
      from?: string;
      to?: string;
      urgency?: string;
    } = {}
  ): Promise<IncidentDto[]> {
    const params = Object.fromEntries(
      Object.entries(filters).filter(([, value]) => !!value)
    ) as Record<string, string>;
    return firstValueFrom(
      this.http.get<IncidentDto[]>(`${this.base}/api/incidencias`, {
        headers: this.headers,
        params,
      })
    );
  }

  getIncident(code: string): Promise<IncidentDto> {
    return firstValueFrom(
      this.http.get<IncidentDto>(`${this.base}/api/incidencias/${encodeURIComponent(code)}`, {
        headers: this.headers,
      })
    );
  }

  changeIncident(code: string, change: ChangeIncidentDto): Promise<IncidentDto> {
    return firstValueFrom(
      this.http.put<IncidentDto>(
        `${this.base}/api/incidencias/${encodeURIComponent(code)}`,
        change,
        { headers: this.headers }
      )
    );
  }

  exportCsv(filters: {
    query?: string;
    category?: string;
    location?: string;
    state?: string;
    from?: string;
    to?: string;
    urgency?: string;
  } = {}): Promise<Blob> {
    const params = Object.fromEntries(
      Object.entries(filters).filter(([, value]) => !!value)
    ) as Record<string, string>;
    return firstValueFrom(
      this.http.get(`${this.base}/api/incidencias/exportar`, {
        headers: this.headers,
        params,
        responseType: 'blob',
      })
    );
  }

  getPhotoBlob(photoUrl: string): Promise<Blob> {
    const url = photoUrl.startsWith('http') ? photoUrl : `${this.base}${photoUrl}`;
    return firstValueFrom(
      this.http.get(url, { headers: this.headers, responseType: 'blob' })
    );
  }

  getAdminAccounts(): Promise<{ id: number; name: string; username: string; role: string; area: string; active: boolean }[]> {
    return firstValueFrom(
      this.http.get<{ id: number; name: string; username: string; role: string; area: string; active: boolean }[]>(
        `${this.base}/api/administracion/cuentas`,
        { headers: this.headers }
      )
    );
  }

  createAdminAccount(input: { name: string; username: string; password?: string; role: string; area: string; active?: boolean }) {
    return firstValueFrom(
      this.http.post<{ id: number; name: string; username: string; role: string; area: string; active: boolean }>(
        `${this.base}/api/administracion/cuentas`,
        input,
        { headers: this.headers }
      )
    );
  }

  updateAdminAccount(id: number, input: { name: string; username: string; password?: string; role: string; area: string; active?: boolean }) {
    return firstValueFrom(
      this.http.put<{ id: number; name: string; username: string; role: string; area: string; active: boolean }>(
        `${this.base}/api/administracion/cuentas/${id}`,
        input,
        { headers: this.headers }
      )
    );
  }

  setAdminAccountActive(id: number, active: boolean) {
    return firstValueFrom(
      this.http.patch<{ active: boolean }>(
        `${this.base}/api/administracion/cuentas/${id}/estado`,
        { active },
        { headers: this.headers }
      )
    );
  }

  getAdminCategories(all = true) {
    return firstValueFrom(
      this.http.get<{ id: number; name: string; description?: string; areaId: number; areaName: string; active: boolean }[]>(
        `${this.base}/api/administracion/categorias?all=${all}`,
        { headers: this.headers }
      )
    );
  }

  createAdminCategory(input: { name: string; areaId: number; description?: string; active?: boolean }) {
    return firstValueFrom(
      this.http.post<{ id: number; name: string; description?: string; areaId: number; areaName: string; active: boolean }>(
        `${this.base}/api/administracion/categorias`,
        input,
        { headers: this.headers }
      )
    );
  }

  updateAdminCategory(id: number, input: { name: string; areaId: number; description?: string; active?: boolean }) {
    return firstValueFrom(
      this.http.put<{ id: number; name: string; description?: string; areaId: number; areaName: string; active: boolean }>(
        `${this.base}/api/administracion/categorias/${id}`,
        input,
        { headers: this.headers }
      )
    );
  }

  setAdminCategoryActive(id: number, active: boolean) {
    return firstValueFrom(
      this.http.patch<{ active: boolean }>(
        `${this.base}/api/administracion/categorias/${id}/estado`,
        { active },
        { headers: this.headers }
      )
    );
  }

  getAdminLocations(all = true) {
    return firstValueFrom(
      this.http.get<{ id: number; name: string; type?: string; buildingId: number; buildingName: string; active: boolean }[]>(
        `${this.base}/api/administracion/ubicaciones?all=${all}`,
        { headers: this.headers }
      )
    );
  }

  createAdminLocation(input: { name: string; buildingId: number; type?: string; active?: boolean }) {
    return firstValueFrom(
      this.http.post<{ id: number; name: string; type?: string; buildingId: number; buildingName: string; active: boolean }>(
        `${this.base}/api/administracion/ubicaciones`,
        input,
        { headers: this.headers }
      )
    );
  }

  updateAdminLocation(id: number, input: { name: string; buildingId: number; type?: string; active?: boolean }) {
    return firstValueFrom(
      this.http.put<{ id: number; name: string; type?: string; buildingId: number; buildingName: string; active: boolean }>(
        `${this.base}/api/administracion/ubicaciones/${id}`,
        input,
        { headers: this.headers }
      )
    );
  }

  setAdminLocationActive(id: number, active: boolean) {
    return firstValueFrom(
      this.http.patch<{ active: boolean }>(
        `${this.base}/api/administracion/ubicaciones/${id}/estado`,
        { active },
        { headers: this.headers }
      )
    );
  }

  getAdminBuildings(all = true) {
    return firstValueFrom(
      this.http.get<{ id: number; name: string; active: boolean }[]>(
        `${this.base}/api/administracion/edificios?all=${all}`,
        { headers: this.headers }
      )
    );
  }

  getAdminAreas(all = true) {
    return firstValueFrom(
      this.http.get<{ id: number; name: string; type?: string; responsible: boolean; active: boolean }[]>(
        `${this.base}/api/administracion/areas?all=${all}`,
        { headers: this.headers }
      )
    );
  }

}