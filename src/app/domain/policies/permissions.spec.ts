import { allowedTransitions, canEditReport, visibleReports } from './permissions';
import { IncidentReport, SessionUser } from '../models/incident.model';
const report: IncidentReport = {
  code: 'TEST0001',
  category: 'Electricidad',
  location: 'biblioteca',
  description: 'Luminaria de prueba dañada',
  state: 'Recibido',
  created: '2026-11-23',
  history: [],
  photos: [],
  requesterArea: 'Biblioteca',
  ownerId: 10,
};
const user = (profile: string): SessionUser => ({
  id: 10,
  name: 'Prueba',
  profile,
  demo: true,
  area: 'Biblioteca',
});
describe('Competencias de demostracion', () => {
  it('permite la atencion de la unidad y rechaza los demas perfiles', () => {
    expect(canEditReport(user('Mantenimiento'), report)).toBe(true);
    for (const role of [
      'Administrador',
      'Autoridad',
      'Reportante',
      'Ordenanza',
      'Jefatura',
      'Desarrollo Físico',
    ])
      expect(canEditReport(user(role), report)).toBe(false);
  });
  it('no permite reabrir expedientes cerrados', () => {
    for (const state of ['Resuelto', 'Rechazado/Cerrado']) {
      expect(allowedTransitions(state)).toEqual([]);
      expect(canEditReport(user('Mantenimiento'), { ...report, state })).toBe(false);
    }
  });
  it('limita la consulta por area e identidad de cuenta', () => {
    expect(
      visibleReports(user('Jefatura'), [report, { ...report, requesterArea: 'Otra' }]),
    ).toEqual([report]);
    expect(visibleReports(user('Reportante'), [report, { ...report, ownerId: 11 }])).toEqual([
      report,
    ]);
    expect(visibleReports(null, [report])).toEqual([]);
  });
  it('mantiene las transiciones conservadoras documentadas', () => {
    expect(allowedTransitions('Recibido')).toEqual(['En proceso', 'Rechazado/Cerrado']);
    expect(allowedTransitions('En espera de materiales/autorización')).toEqual(['En proceso']);
  });
});
