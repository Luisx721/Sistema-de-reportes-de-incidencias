import { IncidentReport } from '../domain/models/incident.model';

export interface HistoryDto {
  date: string;
  state: string;
  note: string;
}

export interface IncidentDto {
  code: string;
  category: string;
  location: string;
  description: string;
  state: string;
  created: string;
  reference: string | null;
  priority: string | null;
  responsibleUnit: string | null;
  version: number;
  history: HistoryDto[];
  urgency?: string | null;
  closed?: string | null;
  reporterName?: string | null;
  reporterLink?: string | null;
  isDuplicate?: boolean;
  photoUploadToken?: string | null;
}

export interface PublicStatusDto {
  code: string;
  category: string;
  location: string;
  state: string;
  created: string;
  history: HistoryDto[];
  urgency?: string | null;
  closed?: string | null;
}

export interface PublicIncidentSummaryDto {
  code: string;
  category: string;
  location: string;
  state: string;
  created: string;
  urgency: string | null;
  closed: string | null;
}

export interface CreateIncidentDto {
  category: string;
  location: string;
  description: string;
  reference: string | null;
  urgency?: string | null;
  reporterName?: string | null;
  reporterLink?: string | null;
}

export interface ChangeIncidentDto {
  state: string;
  priority: string;
  note: string;
  version: number;
}

export interface SessionDto {
  token: string;
  name: string;
  profile: string;
  area: string | null;
  expiresAt: string;
  userId?: number | null;
}

export interface IncidentCatalogsDto {
  categories: string[];
  locations: string[];
  urgencies?: string[];
}

export interface PhotoDto {
  id: number;
  fileName: string;
  contentType: string;
  url: string;
  uploadedAt?: string;
}

export function toCreateIncident(
  report: IncidentReport & { urgency?: string; reporterName?: string; reporterLink?: string },
  locationName: string
): CreateIncidentDto {
  return {
    category: report.category,
    location: locationName,
    description: report.description,
    reference: report.reference?.trim() || null,
    urgency: report.urgency || null,
    reporterName: report.reporterName?.trim() || null,
    reporterLink: report.reporterLink?.trim() || null,
  };
}

export function toChangeIncident(
  state: string,
  priority: string,
  note: string,
  version: number
): ChangeIncidentDto {
  return { state, priority, note: note.trim(), version };
}

export function fromIncidentDto(dto: IncidentDto): IncidentReport & {
  urgency?: string;
  closed?: string;
  isDuplicate?: boolean;
  reporterName?: string;
  reporterLink?: string;
} {
  return {
    code: dto.code,
    category: dto.category,
    location: dto.location,
    description: dto.description,
    state: dto.state,
    created: dto.created,
    reference: dto.reference ?? '',
    priority: dto.priority ?? undefined,
    responsibleUnit: dto.responsibleUnit ?? undefined,
    version: dto.version,
    history: dto.history.map((h) => ({ ...h })),
    photos: [],
    sample: false,
    urgency: dto.urgency ?? undefined,
    closed: dto.closed ?? undefined,
    isDuplicate: dto.isDuplicate ?? false,
    reporterName: dto.reporterName ?? undefined,
    reporterLink: dto.reporterLink ?? undefined,
  };
}

export function fromPublicStatus(dto: PublicStatusDto): IncidentReport & {
  urgency?: string;
  closed?: string;
} {
  return {
    code: dto.code,
    category: dto.category,
    location: dto.location,
    description: '',
    state: dto.state,
    created: dto.created,
    history: dto.history.map((h) => ({ ...h })),
    photos: [],
    sample: false,
    urgency: dto.urgency ?? undefined,
    closed: dto.closed ?? undefined,
  };
}

export function fromPublicIncidentSummary(
  dto: PublicIncidentSummaryDto,
  coords?: { lat: number; lng: number }
): IncidentReport {
  return {
    code: dto.code,
    category: dto.category,
    location: dto.location,
    description: '',
    state: dto.state,
    created: dto.created,
    lat: coords?.lat,
    lng: coords?.lng,
    history: [],
    photos: [],
    sample: false,
    urgency: dto.urgency ?? undefined,
    closed: dto.closed ?? undefined,
  };
}