import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { API_CONFIG } from './api-config';
import { ChangeIncidentDto, CreateIncidentDto, IncidentCatalogsDto, IncidentDto, PublicStatusDto, SessionDto } from './api-mappers';

@Injectable({providedIn:'root'})
export class ApiClient {
  private http = inject(HttpClient);
  private config = inject(API_CONFIG);
  private get base(): string { return this.config.baseUrl.replace(/\/$/, ''); }
  private get headers(): HttpHeaders {
    const token = sessionStorage.getItem('ues-api-token');
    return token ? new HttpHeaders({Authorization: `Bearer ${token}`}) : new HttpHeaders();
  }
  login(username: string, password: string): Promise<SessionDto> {
    return firstValueFrom(this.http.post<SessionDto>(`${this.base}/api/sesiones`, {username, password}));
  }
  currentSession(): Promise<SessionDto> {
    return firstValueFrom(this.http.get<SessionDto>(`${this.base}/api/sesiones/actual`, {headers:this.headers}));
  }
  endSession(): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${this.base}/api/sesiones/actual`, {headers:this.headers}));
  }
  createIncident(body: CreateIncidentDto): Promise<IncidentDto> {
    return firstValueFrom(this.http.post<IncidentDto>(`${this.base}/api/incidencias`, body));
  }
  getCatalogs(): Promise<IncidentCatalogsDto> {
    return firstValueFrom(this.http.get<IncidentCatalogsDto>(`${this.base}/api/catalogos`));
  }
  track(code: string): Promise<PublicStatusDto> {
    return firstValueFrom(this.http.get<PublicStatusDto>(`${this.base}/api/seguimiento/${encodeURIComponent(code)}`));
  }
  listIncidents(filters: {query?:string; category?:string; location?:string; state?:string; from?:string; to?:string} = {}): Promise<IncidentDto[]> {
    const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => !!value)) as Record<string,string>;
    return firstValueFrom(this.http.get<IncidentDto[]>(`${this.base}/api/incidencias`, {headers:this.headers, params}));
  }
  getIncident(code: string): Promise<IncidentDto> {
    return firstValueFrom(this.http.get<IncidentDto>(`${this.base}/api/incidencias/${encodeURIComponent(code)}`, {headers:this.headers}));
  }
  changeIncident(code: string, change: ChangeIncidentDto): Promise<IncidentDto> {
    return firstValueFrom(this.http.put<IncidentDto>(`${this.base}/api/incidencias/${encodeURIComponent(code)}`, change, {headers:this.headers}));
  }
}
