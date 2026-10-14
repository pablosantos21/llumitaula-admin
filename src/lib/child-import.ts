export const MAX_IMPORT_ROWS = 1000;

export interface ImportClassRef {
    id: string;
    name: string;
}

export interface ExistingChildRef {
    first_name: string;
    last_name: string;
    class_id: string;
}

export interface ImportRowInput {
    excelRowNumber: number;
    nombre: unknown;
    apellidos: unknown;
    aula: unknown;
}

export type ImportField = 'nombre' | 'apellidos' | 'aula';

export interface RowFieldError {
    campo: ImportField | 'fila';
    valorOriginal: string;
    motivo: string;
}

export type RowVerdict =
    | {
          excelRowNumber: number;
          estado: 'ok';
          nombre: string;
          apellidos: string;
          aula: string;
          classId: string;
      }
    | {
          excelRowNumber: number;
          estado: 'error';
          nombre: string;
          apellidos: string;
          aula: string;
          errores: RowFieldError[];
      }
    | {
          excelRowNumber: number;
          estado: 'duplicado';
          nombre: string;
          apellidos: string;
          aula: string;
          motivo: string;
      }
    | { excelRowNumber: number; estado: 'vacia' };

export interface ImportSummary {
    total: number;
    listos: number;
    conError: number;
    duplicados: number;
    vacias: number;
}

export interface ImportValidationResult {
    verdicts: RowVerdict[];
    summary: ImportSummary;
    excedeLimite: boolean;
    mensajeLimite: string;
}

export interface ErrorReportRow {
    filaExcel: number;
    nombre: string;
    apellidos: string;
    aula: string;
    campo: ImportField | 'fila';
    valorOriginal: string;
    motivo: string;
}

export interface ImportInsertRow {
    excelRowNumber: number;
    first_name: string;
    last_name: string;
    class_id: string;
}

export const ERROR_REPORT_HEADERS = [
    'n_fila_excel',
    'nombre',
    'apellidos',
    'aula',
    'campo',
    'valor_original',
    'motivo_error',
] as const;

export function normalizeText(value: unknown): string {
    if (value === null || value === undefined) return '';
    return String(value)
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

function toDisplayText(value: unknown): string {
    if (value === null || value === undefined) return '';
    return String(value).trim();
}

function toRawText(value: unknown): string {
    if (value === null || value === undefined) return '';
    return String(value);
}

export function mapHeaderToField(header: unknown): ImportField | null {
    const normalized = normalizeText(header);
    if (normalized === 'nombre') return 'nombre';
    if (normalized === 'apellidos') return 'apellidos';
    if (normalized === 'aula') return 'aula';
    return null;
}

export function validateImportHeaders(headers: readonly unknown[]): {
    ok: boolean;
    missing: ImportField[];
} {
    const found = new Set<ImportField>();
    for (const header of headers) {
        const field = mapHeaderToField(header);
        if (field !== null) found.add(field);
    }
    const missing = (['nombre', 'apellidos', 'aula'] as const).filter((field) => !found.has(field));
    return { ok: missing.length === 0, missing };
}

function duplicateKey(nombre: string, apellidos: string, aula: string): string {
    return `${normalizeText(nombre)}|${normalizeText(apellidos)}|${normalizeText(aula)}`;
}

export function validateChildImportRows(args: {
    rows: readonly ImportRowInput[];
    classes: readonly ImportClassRef[];
    existingChildren: readonly ExistingChildRef[];
}): ImportValidationResult {
    const { rows, classes, existingChildren } = args;

    const classByNormalizedName = new Map<string, ImportClassRef>();
    const classNameById = new Map<string, string>();
    for (const cls of classes) {
        const key = normalizeText(cls.name);
        if (!classByNormalizedName.has(key)) classByNormalizedName.set(key, cls);
        if (!classNameById.has(cls.id)) classNameById.set(cls.id, cls.name);
    }

    const existingKeys = new Set<string>();
    for (const child of existingChildren) {
        // El llamante pasa solo aulas y alumnos del colegio objetivo; si un
        // class_id no está en el catálogo se usa el propio id para no colapsar
        // claves de colegios distintos en un falso duplicado.
        const className = classNameById.get(child.class_id) ?? child.class_id;
        existingKeys.add(duplicateKey(child.first_name, child.last_name, className));
    }

    const seenKeys = new Set<string>();
    const verdicts: RowVerdict[] = [];

    for (const input of rows) {
        const nombre = toDisplayText(input.nombre);
        const apellidos = toDisplayText(input.apellidos);
        const aula = toDisplayText(input.aula);
        const rawNombre = toRawText(input.nombre);
        const rawApellidos = toRawText(input.apellidos);
        const rawAula = toRawText(input.aula);

        if (nombre === '' && apellidos === '' && aula === '') {
            verdicts.push({ excelRowNumber: input.excelRowNumber, estado: 'vacia' });
            continue;
        }

        const errores: RowFieldError[] = [];
        if (nombre === '') {
            errores.push({
                campo: 'nombre',
                valorOriginal: rawNombre,
                motivo: 'El nombre es obligatorio: indica el nombre del alumno.',
            });
        }
        if (apellidos === '') {
            errores.push({
                campo: 'apellidos',
                valorOriginal: rawApellidos,
                motivo: 'Los apellidos son obligatorios: indica los apellidos del alumno.',
            });
        }
        if (aula === '') {
            errores.push({
                campo: 'aula',
                valorOriginal: rawAula,
                motivo: 'El aula es obligatoria: indica el aula del alumno.',
            });
        }
        if (errores.length > 0) {
            verdicts.push({
                excelRowNumber: input.excelRowNumber,
                estado: 'error',
                nombre,
                apellidos,
                aula,
                errores,
            });
            continue;
        }

        const matchedClass = classByNormalizedName.get(normalizeText(aula));
        if (!matchedClass) {
            verdicts.push({
                excelRowNumber: input.excelRowNumber,
                estado: 'error',
                nombre,
                apellidos,
                aula,
                errores: [
                    {
                        campo: 'aula',
                        valorOriginal: rawAula,
                        motivo: `El aula "${aula}" no existe en este colegio: corrige el nombre del aula.`,
                    },
                ],
            });
            continue;
        }

        const key = duplicateKey(nombre, apellidos, aula);
        if (seenKeys.has(key)) {
            verdicts.push({
                excelRowNumber: input.excelRowNumber,
                estado: 'duplicado',
                nombre,
                apellidos,
                aula,
                motivo: `El alumno "${nombre} ${apellidos}" del aula "${aula}" está duplicado en el fichero: se omite esta fila.`,
            });
            continue;
        }
        seenKeys.add(key);

        if (existingKeys.has(key)) {
            verdicts.push({
                excelRowNumber: input.excelRowNumber,
                estado: 'duplicado',
                nombre,
                apellidos,
                aula,
                motivo: `El alumno "${nombre} ${apellidos}" del aula "${aula}" ya existe en este colegio: se omite sin sobrescribir.`,
            });
            continue;
        }

        verdicts.push({
            excelRowNumber: input.excelRowNumber,
            estado: 'ok',
            nombre,
            apellidos,
            aula,
            classId: matchedClass.id,
        });
    }

    // Las filas vacías se ignoran en silencio: no cuentan en el total.
    const summary: ImportSummary = { total: 0, listos: 0, conError: 0, duplicados: 0, vacias: 0 };
    for (const v of verdicts) {
        if (v.estado === 'vacia') summary.vacias += 1;
        else if (v.estado === 'ok') {
            summary.total += 1;
            summary.listos += 1;
        } else if (v.estado === 'error') {
            summary.total += 1;
            summary.conError += 1;
        } else {
            summary.total += 1;
            summary.duplicados += 1;
        }
    }

    const excedeLimite = rows.length > MAX_IMPORT_ROWS;
    return {
        verdicts,
        summary,
        excedeLimite,
        mensajeLimite: excedeLimite
            ? `El fichero tiene ${rows.length} filas y supera el límite de ${MAX_IMPORT_ROWS} filas por fichero: divide el fichero en partes más pequeñas.`
            : '',
    };
}

export function buildErrorReportRows(result: ImportValidationResult): ErrorReportRow[] {
    const report: ErrorReportRow[] = [];
    for (const verdict of result.verdicts) {
        if (verdict.estado === 'error') {
            for (const error of verdict.errores) {
                report.push({
                    filaExcel: verdict.excelRowNumber,
                    nombre: verdict.nombre,
                    apellidos: verdict.apellidos,
                    aula: verdict.aula,
                    campo: error.campo,
                    valorOriginal: error.valorOriginal,
                    motivo: error.motivo,
                });
            }
        } else if (verdict.estado === 'duplicado') {
            report.push({
                filaExcel: verdict.excelRowNumber,
                nombre: verdict.nombre,
                apellidos: verdict.apellidos,
                aula: verdict.aula,
                campo: 'fila',
                valorOriginal: `${verdict.nombre} ${verdict.apellidos} / ${verdict.aula}`,
                motivo: verdict.motivo,
            });
        }
    }
    return report;
}

/**
 * Paso 3 (#21): selección parcial insert-only.
 *
 * Devuelve solo las filas con veredicto ok listas para insertar, con el
 * payload ya mapeado a columnas de `children`. Las filas con error,
 * duplicadas o vacías nunca se incluyen: el llamante no debe escribir nada
 * más. No muta la entrada.
 */
export function collectRowsToInsert(verdicts: readonly RowVerdict[]): ImportInsertRow[] {
    const toInsert: ImportInsertRow[] = [];
    for (const verdict of verdicts) {
        if (verdict.estado !== 'ok') continue;
        toInsert.push({
            excelRowNumber: verdict.excelRowNumber,
            first_name: verdict.nombre,
            last_name: verdict.apellidos,
            class_id: verdict.classId,
        });
    }
    return toInsert;
}

/**
 * Tabla pura del reporte de errores descargable (#21): cabecera canónica en
 * español + una línea por error (una fila con 2 errores = 2 líneas) con el
 * nº_fila_excel real + bloque resumen total/listos/con error/duplicados.
 *
 * Devuelve una matriz AOA lista para el adaptador xlsx; no toca BD ni DOM.
 */
export function buildErrorReportTable(result: ImportValidationResult): unknown[][] {
    const table: unknown[][] = [[...ERROR_REPORT_HEADERS]];
    for (const line of buildErrorReportRows(result)) {
        table.push([
            line.filaExcel,
            line.nombre,
            line.apellidos,
            line.aula,
            line.campo,
            line.valorOriginal,
            line.motivo,
        ]);
    }
    table.push([]);
    table.push(['resumen', '', '', '', '', '', '']);
    table.push(['total', result.summary.total, '', '', '', '', '']);
    table.push(['listos para importar', result.summary.listos, '', '', '', '', '']);
    table.push(['con error', result.summary.conError, '', '', '', '', '']);
    table.push(['duplicados (se omiten sin escribir)', result.summary.duplicados, '', '', '', '', '']);
    return table;
}
