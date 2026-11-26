import { Injectable } from '@angular/core';
import { IncidentReport } from '../../domain/models/incident.model';
import { jsPDF } from 'jspdf';
// Servicio para exportar reportes a PDF (individual) y CSV (listado). 
@Injectable({ providedIn: 'root' })
export class DocumentService {
  // Comprobante local sin atribuir firma ni validez institucional
  pdf(report: IncidentReport): void {
    const pdf = new jsPDF({ format: 'letter' });
    let y = 22;
      // Escribe texto con salto de línea automático y crea página nueva si se llena
    const line = (text: string) => {
      for (const row of pdf.splitTextToSize(text, 175)) {
        if (y > 250) {
          pdf.addPage();
          y = 22;
        }
        pdf.text(row, 20, y);
        y += 7;
      }
    };
    pdf.setFontSize(16);
    line('Reportes UES');
    pdf.setFontSize(11);
    // Datos del reporte, seguidos de los espacios para firma y sello
    for (const text of [
      'Comprobante de demostracion',
      'Codigo: ' + report.code,
      'Fecha: ' + report.created,
      'Area solicitante: ' + (report.requesterArea || 'No aplica'),
      'Ubicacion: ' + report.location,
      'Categoria: ' + report.category,
      'Estado: ' + report.state,
      'Descripcion: ' + report.description,
      'Ultima observacion: ' + (report.history.at(-1)?.note || ''),
      '',
      'Firma: ____________________',
      'Sello de recibido: ____________________',
      'No acredita impresion firma ni sello institucional',
    ])
      line(text);
    pdf.save(report.code + '.pdf');
  }
  // Neutralizar formulas antes de exportar contenido escrito por usuarios
  csv(reports: IncidentReport[]): void {
    const cell = (value: string) =>
      '"' + (/^[=+@\-\t\r]/.test(value) ? "'" + value : value).replaceAll('"', '""') + '"';
   // Encabezados + una fila por reporte (fecha de cierre solo si está resuelto o cerrado)
    const rows = [
      [
        'Código',
        'Fecha de registro',
        'Categoría',
        'Ubicación',
        'Área solicitante',
        'Prioridad',
        'Estado',
        'Fecha de cierre',
        'Última observación',
      ],
      ...reports.map((r) => [
        r.code,
        r.created,
        r.category,
        r.location,
        r.requesterArea || '',
        r.priority || 'Sin asignar',
        r.state,
        ['Resuelto', 'Rechazado/Cerrado'].includes(r.state) ? r.history.at(-1)?.date || '' : '',
        r.history.at(-1)?.note || '',
      ]),
    ];
    // El BOM (\uFEFF) hace que Excel muestre bien las tildes
    const url = URL.createObjectURL(
      new Blob(['\uFEFF' + rows.map((r) => r.map(cell).join(',')).join('\r\n')], {
        type: 'text/csv;charset=utf-8',
      }),
    );
     // Descarga el archivo y libera la URL temporal
    const link = document.createElement('a');
    link.href = url;
    link.download = 'incidencias.csv';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
