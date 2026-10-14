import { utils, write } from 'xlsx';
import { buildErrorReportTable, type ImportValidationResult } from './child-import.ts';

/**
 * Adaptador fino .xlsx del reporte de errores (#21).
 *
 * La tabla pura (cabecera + líneas + resumen) vive en `child-import.ts`;
 * aquí solo se convierte a bytes .xlsx y se descarga en el navegador.
 * No escribe nada en BD.
 */

export const IMPORT_ERROR_REPORT_FILENAME = 'reporte-errores-alumnos.xlsx';

export const IMPORT_ERROR_REPORT_SHEET_NAME = 'errores';

/** Construye los bytes del .xlsx del reporte a partir del resultado validado. */
export function buildErrorReportBytes(result: ImportValidationResult): Uint8Array {
    const table = buildErrorReportTable(result);
    const workbook = utils.book_new();
    const sheet = utils.aoa_to_sheet(table);
    sheet['!cols'] = [{ wch: 14 }, { wch: 16 }, { wch: 22 }, { wch: 14 }, { wch: 14 }, { wch: 22 }, { wch: 64 }];
    utils.book_append_sheet(workbook, sheet, IMPORT_ERROR_REPORT_SHEET_NAME);
    const output = write(workbook, { type: 'array', bookType: 'xlsx' }) as unknown;
    if (output instanceof Uint8Array) return output;
    return new Uint8Array(output as ArrayBuffer);
}

/** Descarga el reporte de errores en el navegador (solo DOM, sin BD). */
export function downloadErrorReport(result: ImportValidationResult): void {
    const bytes = buildErrorReportBytes(result);
    // Copia exacta de la vista: `write({type:'array'})` puede devolver un
    // Uint8Array sobre un ArrayBuffer mayor, y `bytes.buffer` arrastraría
    // basura al Blob y corrompería el .xlsx (igual que en la plantilla).
    const exactCopy = bytes.slice();
    const blob = new Blob([exactCopy.buffer as ArrayBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = IMPORT_ERROR_REPORT_FILENAME;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
}
