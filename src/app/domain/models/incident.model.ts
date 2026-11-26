// Modelos de datos del sistema: ubicaciones, incidencias, sesion, cuentas y filtros.
// Lugar del campus donde puede ocurrir una incidencia
export interface CampusLocation {
  id: string;
  name: string;
   // Posicion en el esquema del campus
  x: number;
  y: number;
  // Coordenadas para el mapa
  lat: number;
  lng: number;
}
// Una linea del historial de atencion de una incidencia
export interface HistoryEntry {
  date: string;
  state: string;
  note: string;
  actorId?: number;
}
// Reporte de incidencia (modelo principal)
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
  // Datos opcionales de quien reporta, no se muestran en la consulta publica
  reporterName?: string;
  reporterLink?: string;
  sample?: boolean;
  requesterArea?: string;
  ownerId?: number;
  priority?: string;
  responsibleUnit?: string;
  // Sirve para detectar cambios simultaneos
  version?: number;
    // Urgencia percibida por quien reporta (distinta de la prioridad)
  urgency?: string;
  closed?: string;
  isDuplicate?: boolean;
}
// Persona con la sesion iniciada
export interface SessionUser {
  name: string;
  profile: string;
  demo: boolean;
  id?: number;
  area?: string;
}
// Cuenta de usuario (se desactiva, no se elimina)
export interface Account {
  id: number;
  name: string;
  username: string;
  role: string;
  area: string;
  active: boolean;
}
// Elemento de un catalogo (se desactiva, no se elimina)
export interface CatalogItem {
  id: number;
  name: string;
  active: boolean;
}
// Modelos de datos del sistema: ubicaciones, incidencias, sesion, cuentas y filtros.
export interface IncidentFilters {
  query?: string;
  category?: string;
  location?: string;
  state?: string;
  urgency?: string;
  from?: string;
  to?: string;
}