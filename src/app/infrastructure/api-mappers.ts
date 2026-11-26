import { IncidentReport } from '../domain/models/incident.model';

export interface HistoryDto { date: string; state: string; note: string; }
export interface IncidentDto {
  code: string; category: string; location: string; description: string; state: string;
  created: string; reference: string | null; priority: string | null;
  responsibleUnit: string | null; version: number; history: HistoryDto[];
}
export interface PublicStatusDto {
  code: string; category: string; location: string; state: string; created: string; history: HistoryDto[];
}
export interface CreateIncidentDto { category: string; location: string; description: string; reference: string | null; }
export interface ChangeIncidentDto { state: string; priority: string; note: string; version: number; }
export interface SessionDto { token: string; name: string; profile: string; area: string | null; expiresAt: string; }
export interface IncidentCatalogsDto { categories: string[]; buildings: string[]; locations: string[]; }

export function toCreateIncident(report: IncidentReport, locationName: string): CreateIncidentDto {
  return { category: report.category, location: locationName, description: report.description,
    reference: report.reference?.trim() || null };
}
export function toChangeIncident(state: string, priority: string, note: string, version: number): ChangeIncidentDto {
  return { state, priority, note: note.trim(), version };
}
export function fromIncidentDto(dto: IncidentDto): IncidentReport {
  return { code: dto.code, category: dto.category, location: dto.location, description: dto.description,
    state: dto.state, created: dto.created, reference: dto.reference ?? '', priority: dto.priority ?? undefined,
    responsibleUnit: dto.responsibleUnit ?? undefined, version: dto.version, history: dto.history.map(h => ({...h})), photos: [], sample: false };
}
export function fromPublicStatus(dto: PublicStatusDto): IncidentReport {
  return { code: dto.code, category: dto.category, location: dto.location, description: '', state: dto.state,
    created: dto.created, history: dto.history.map(h => ({...h})), photos: [], sample: false };
}
