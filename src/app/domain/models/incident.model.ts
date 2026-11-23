export interface CampusLocation {
  id: string;
  name: string;
  x: number;
  y: number;
  lat: number;
  lng: number;
}

export interface HistoryEntry {
  date: string;
  state: string;
  note: string;
  actorId?: number;
}

export interface IncidentReport {
  code: string;
  category: string;
  location: string;
  description: string;
  state: string;
  created: string;
  history: HistoryEntry[];
  photos: (Blob | File)[];
  reference?: string;
  reporterName?: string;
  reporterLink?: string;
  sample?: boolean;
  requesterArea?: string;
  ownerId?: number;
  priority?: string;
  responsibleUnit?: string;
}

export interface SessionUser {
  name: string;
  profile: string;
  demo: boolean;
  id?: number;
  area?: string;
}

export interface Account {
  id: number;
  name: string;
  username: string;
  role: string;
  area: string;
  active: boolean;
}

export interface CatalogItem {
  id: number;
  name: string;
  active: boolean;
}
