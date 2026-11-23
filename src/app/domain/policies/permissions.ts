import { IncidentReport, SessionUser } from '../models/incident.model';

// Politica provisional de demostracion pendiente de validacion institucional D uno
export function canEditReport(user: SessionUser | null, report: IncidentReport): boolean {
  if (!user || ['Resuelto', 'Rechazado/Cerrado'].includes(report.state)) return false;
  const unit =
    report.responsibleUnit ||
    (['Edificios', 'Espacios comunes'].includes(report.category)
      ? 'Desarrollo Físico'
      : 'Mantenimiento');
  return user.profile === unit;
}
export function allowedTransitions(state: string): string[] {
  const transitions: Record<string, string[]> = {
    Recibido: ['En proceso', 'Rechazado/Cerrado'],
    'En proceso': ['En espera de materiales/autorización', 'Resuelto'],
    'En espera de materiales/autorización': ['En proceso'],
  };
  return transitions[state] || [];
}
export function visibleReports(
  user: SessionUser | null,
  reports: IncidentReport[],
): IncidentReport[] {
  if (!user) return [];
  if (user.profile === 'Reportante') return reports.filter((r) => r.ownerId === user.id);
  if (['Jefatura', 'Ordenanza'].includes(user.profile))
    return reports.filter((r) => !!user.area && r.requesterArea === user.area);
  if (['Mantenimiento', 'Desarrollo Físico', 'Autoridad'].includes(user.profile)) return reports;
  return [];
}
