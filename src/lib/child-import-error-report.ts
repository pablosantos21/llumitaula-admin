import { buildErrorReportTable, type ImportValidationResult } from './child-import.ts';
import { aoaToXlsxBytes, downloadXlsxBytes } from './xlsx-download.ts';

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
    return aoaToXlsxBytes(
        buildErrorReportTable(result),
        IMPORT_ERROR_REPORT_SHEET_NAME,
        [{ wch: 14 }, { wch: 16 }, { wch: 22 }, { wch: 14 }, { wch: 14 }, { wch: 22 }, { wch: 64 }]
    );
}

/** Descarga el reporte de errores en el navegador (solo DOM, sin BD). */
export function downloadErrorReport(result: ImportValidationResult): void {
    const bytes = buildErrorReportBytes(result);
    downloadXlsxBytes(bytes, IMPORT_ERROR_REPORT_FILENAME);
}
