import { utils, write } from 'xlsx';

/**
 * Convierte una matriz de valores (AOA) a bytes Uint8Array de un archivo .xlsx.
 */
export function aoaToXlsxBytes(
    table: unknown[][],
    sheetName: string = 'Sheet1',
    colWidths?: Array<{ wch: number }>
): Uint8Array {
    const workbook = utils.book_new();
    const sheet = utils.aoa_to_sheet(table);
    if (colWidths) {
        sheet['!cols'] = colWidths;
    }
    utils.book_append_sheet(workbook, sheet, sheetName);
    const output = write(workbook, { type: 'array', bookType: 'xlsx' }) as unknown;
    if (output instanceof Uint8Array) return output;
    return new Uint8Array(output as ArrayBuffer);
}

/**
 * Descarga en el navegador los bytes de un archivo .xlsx (solo DOM, sin escritura en BD).
 */
export function downloadXlsxBytes(bytes: Uint8Array, filename: string): void {
    // Copia exacta de la vista: `write({type:'array'})` puede devolver un
    // Uint8Array sobre un ArrayBuffer mayor, y `bytes.buffer` arrastraría
    // basura al Blob y corrompería el .xlsx.
    const exactCopy = bytes.slice();
    const blob = new Blob([exactCopy.buffer as ArrayBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
}
