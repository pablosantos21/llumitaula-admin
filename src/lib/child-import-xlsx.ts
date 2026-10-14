import { read, utils } from 'xlsx';
import {
    MAX_IMPORT_ROWS,
    validateChildImportRows,
    validateImportHeaders,
    mapHeaderToField,
    type ExistingChildRef,
    type ImportClassRef,
    type ImportField,
    type ImportRowInput,
    type ImportValidationResult,
} from './child-import.ts';

export type ImportBytes = ArrayBuffer | Uint8Array;

export interface ImportCatalogs {
    classes: readonly ImportClassRef[];
    existingChildren: readonly ExistingChildRef[];
}

export type ImportTableParseResult =
    | { ok: true; headers: unknown[]; rows: ImportRowInput[] }
    | { ok: false; motivo: string; missing: ImportField[] };

export type DryRunTableResult =
    | { ok: true; result: ImportValidationResult }
    | { ok: false; motivo: string; missing: ImportField[] };

const EMPTY_FILE_MOTIVO =
    'El fichero está vacío: la primera hoja no tiene filas. Revisa que la primera fila sea la cabecera (nombre | apellidos | aula).';

const UNREADABLE_FILE_MOTIVO =
    'No se pudo leer el fichero .xlsx: comprueba que sea un Excel válido con los datos en la primera hoja y la primera fila como cabecera.';

function isEffectivelyEmptyHeader(headers: readonly unknown[]): boolean {
    return headers.every((cell) => cell === null || cell === undefined || String(cell).trim() === '');
}

function missingColumnsMotivo(missing: ImportField[]): string {
    return `Faltan las columnas obligatorias: ${missing.join(', ')}. La primera fila debe ser la cabecera con nombre | apellidos | aula.`;
}

function findColumnIndex(headers: readonly unknown[], field: ImportField): number {
    return headers.findIndex((header) => mapHeaderToField(header) === field);
}

function cellAt(row: readonly unknown[], index: number): unknown {
    if (index < 0 || index >= row.length) return '';
    return row[index] ?? '';
}

/**
 * Convierte la primera hoja ya extraída como matriz (primera fila = cabecera)
 * en filas normalizadas listas para el núcleo de validación.
 *
 * No escribe nada: solo reindexa columnas (las extra se ignoran) y conserva
 * el nº de fila real de Excel (cabecera = 1, datos desde 2).
 */
export function parseImportTable(table: readonly unknown[][]): ImportTableParseResult {
    if (table.length === 0) {
        return { ok: false, motivo: EMPTY_FILE_MOTIVO, missing: ['nombre', 'apellidos', 'aula'] };
    }
    const headers = table[0] ?? [];
    if (headers.length === 0 || isEffectivelyEmptyHeader(headers)) {
        return { ok: false, motivo: EMPTY_FILE_MOTIVO, missing: ['nombre', 'apellidos', 'aula'] };
    }

    const { ok, missing } = validateImportHeaders(headers);
    if (!ok) {
        return { ok: false, motivo: missingColumnsMotivo(missing), missing };
    }

    const nombreIdx = findColumnIndex(headers, 'nombre');
    const apellidosIdx = findColumnIndex(headers, 'apellidos');
    const aulaIdx = findColumnIndex(headers, 'aula');

    const dataRows = table.slice(1);
    if (dataRows.length > MAX_IMPORT_ROWS) {
        return {
            ok: false,
            motivo: `El fichero tiene ${dataRows.length} filas y supera el límite de ${MAX_IMPORT_ROWS} filas por fichero: divide el fichero en partes más pequeñas.`,
            missing: [],
        };
    }

    const rows: ImportRowInput[] = dataRows.map((cells, index) => {
        const row = Array.isArray(cells) ? cells : [];
        return {
            excelRowNumber: index + 2,
            nombre: cellAt(row, nombreIdx),
            apellidos: cellAt(row, apellidosIdx),
            aula: cellAt(row, aulaIdx),
        };
    });

    return { ok: true, headers: [...headers], rows };
}

/**
 * Dry-run completo sin escritura: parsea la matriz y la valida con el núcleo
 * puro usando solo el catálogo leído (aulas y alumnos existentes del colegio).
 */
export function dryRunImportTable(
    table: readonly unknown[][],
    catalogs: ImportCatalogs,
): DryRunTableResult {
    const parsed = parseImportTable(table);
    if (!parsed.ok) return parsed;
    const result = validateChildImportRows({
        rows: parsed.rows,
        classes: catalogs.classes,
        existingChildren: catalogs.existingChildren,
    });
    return { ok: true, result };
}

/**
 * Extrae la primera hoja de un libro ya leído como matriz de valores.
 * Se incluye `blankrows: true` a propósito: las filas vacías deben conservar
 * su posición para que el nº_fila_excel siga siendo el real de la hoja.
 */
export function tableFromWorkbook(workbook: unknown): unknown[][] | null {
    if (typeof workbook !== 'object' || workbook === null) return null;
    const sheets = (workbook as { SheetNames?: unknown; Sheets?: unknown }).SheetNames;
    const book = workbook as { Sheets?: Record<string, unknown> };
    if (!Array.isArray(sheets) || sheets.length === 0 || !book.Sheets) return null;
    const firstName = sheets[0];
    if (typeof firstName !== 'string') return null;
    const sheet = book.Sheets[firstName];
    if (sheet === null || sheet === undefined) return null;
    try {
        return utils.sheet_to_json<unknown[]>(sheet, {
            header: 1,
            defval: null,
            blankrows: true,
        }) as unknown[][];
    } catch {
        return null;
    }
}

export function tableFromBytes(bytes: ImportBytes): unknown[][] | null {
    try {
        const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
        const workbook = read(data, { type: 'array' });
        return tableFromWorkbook(workbook);
    } catch {
        return null;
    }
}

/**
 * Parsea los bytes de un .xlsx canónico (primera hoja, primera fila = cabecera).
 */
export function parseImportWorkbookBytes(bytes: ImportBytes): ImportTableParseResult {
    const table = tableFromBytes(bytes);
    if (table === null) {
        return { ok: false, motivo: UNREADABLE_FILE_MOTIVO, missing: [] };
    }
    return parseImportTable(table);
}

/**
 * Dry-run de un fichero .xlsx sin escribir nada en BD. Solo necesita los
 * catálogos ya leídos del colegio objetivo; nunca inserta ni modifica.
 */
export function dryRunImportWorkbookBytes(bytes: ImportBytes, catalogs: ImportCatalogs): DryRunTableResult {
    const parsed = parseImportWorkbookBytes(bytes);
    if (!parsed.ok) return parsed;
    const result = validateChildImportRows({
        rows: parsed.rows,
        classes: catalogs.classes,
        existingChildren: catalogs.existingChildren,
    });
    return { ok: true, result };
}

/**
 * Ayuda para la UI: lee un File del input y ejecuta el dry-run sin escribir.
 */
export async function dryRunImportFile(file: File, catalogs: ImportCatalogs): Promise<DryRunTableResult> {
    const buffer = await file.arrayBuffer();
    return dryRunImportWorkbookBytes(buffer, catalogs);
}
