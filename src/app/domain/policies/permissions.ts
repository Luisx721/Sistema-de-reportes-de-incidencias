import { IncidentReport, SessionUser } from '../models/incident.model';

// Indica si la persona puede atender el reporte
export function canEditReport(user: SessionUser | null, report: IncidentReport): boolean {
  // Sin sesión, o con el reporte ya cerrado, no se puede editar
  if (!user || ['Resuelto', 'Rechazado/Cerrado'].includes(report.state)) return false;

  // Unidad que atiende: la asignada o, si no hay, la que corresponde por categoría
  const unit =
    report.responsibleUnit ||
    (['Edificios', 'Espacios comunes'].includes(report.category)
      ? 'Desarrollo Físico'
      : 'Mantenimiento');

  // Solo el perfil técnico de esa unidad puede editar
  return user.profile === unit;
}

// Indica si la persona puede adjuntar evidencia fotográfica desde el expediente interno
export function canUploadIncidentPhotos(user: SessionUser | null, report: IncidentReport): boolean {
  return canEditReport(user, report);
}

// Indica si la persona puede registrar en modalidad asistida por su área
export function canRegisterAssisted(user: SessionUser | null): boolean {
  if (!user) return false;
  return ['Jefatura', 'Ordenanza'].includes(user.profile);
}

// Estados a los que se puede pasar desde el estado actual
export function allowedTransitions(state: string): string[] {
  const transitions: Record<string, string[]> = {
    Recibido: ['En proceso', 'Rechazado/Cerrado'],
    'En proceso': ['En espera de materiales/autorización', 'Resuelto'],
    'En espera de materiales/autorización': ['En proceso'],
  };
  // Los estados cerrados no tienen salida
  return transitions[state] || [];
}

// Devuelve los reportes que cada perfil puede ver
export function visibleReports(
  user: SessionUser | null,
  reports: IncidentReport[],
): IncidentReport[] {
  if (!user) return [];
  // Reportante: solo los suyos
  if (user.profile === 'Reportante') return reports.filter((r) => r.ownerId === user.id);
  // Jefatura y Ordenanza: solo los de su área (solo consulta)
  if (['Jefatura', 'Ordenanza'].includes(user.profile))
    return reports.filter((r) => !!user.area && r.requesterArea === user.area);
  // Mantenimiento, Desarrollo Físico y Autoridad: todos
  if (['Mantenimiento', 'Desarrollo Físico', 'Autoridad'].includes(user.profile)) return reports;
  // Cualquier otro perfil (incluyendo Administrador) no ve expedientes operativos
  return [];
}