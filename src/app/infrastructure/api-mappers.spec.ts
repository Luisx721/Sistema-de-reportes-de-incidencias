import { toCreateIncident } from './api-mappers';
import { IncidentReport } from '../domain/models/incident.model';

describe('toCreateIncident', () => {
  it('preserves the exact category and location values from the API catalogs', () => {
    const report = {
      category: 'Edificios',
      location: 'Edificio de Prueba - Aula 1',
      description: 'La puerta del aula requiere revisión técnica.',
      reference: '  Entrada principal  ',
    } as IncidentReport;
    expect(toCreateIncident(report, report.location)).toEqual({
      category: 'Edificios',
      location: 'Edificio de Prueba - Aula 1',
      description: report.description,
      reference: 'Entrada principal',
      reporterName: null,
      reporterLink: null,
      urgency: null,
    });
  });
});