import { tableFromBytes } from './child-import-xlsx.ts';
import { aoaToXlsxBytes, downloadXlsxBytes } from './xlsx-download.ts';

/**
 * Plantilla .xlsx de ejemplo para la importación masiva de alumnos (#20).
 *
 * Contenido en español: las 3 columnas canónicas (nombre | apellidos | aula)
 * más una 4ª columna de comentarios que el importador ignora (columna extra).
 * Incluye filas válidas y ejemplos de error comentados para que el personal
 * del colegio vea qué corregir antes de subir su propio fichero.
 *
 * No escribe nada en BD: solo construye bytes .xlsx en memoria.
 */

export const IMPORT_TEMPLATE_FILENAME = 'plantilla-alumnos.xlsx';

export const IMPORT_TEMPLATE_SHEET_NAME = 'alumnos';

export const IMPORT_TEMPLATE_COMMENT_HEADER = 'comentario (se ignora al importar)';

const COMMENT_EXAMPLE_VALID_1 =
    'Ejemplo válido: se importaría. Sustituye esta fila por tus datos.';
const COMMENT_EXAMPLE_VALID_2 =
    'Ejemplo válido: cambia «Aula A1» por un aula real de tu colegio.';
const COMMENT_ERROR_MISSING_NAME = 'Ejemplo de error: falta el nombre (es obligatorio).';
const COMMENT_ERROR_MISSING_LASTNAME = 'Ejemplo de error: faltan los apellidos (son obligatorios).';
const COMMENT_ERROR_UNKNOWN_CLASS =
    'Ejemplo de error: el aula no existe en el colegio (corrige el nombre del aula).';
const COMMENT_ERROR_DUPLICATE =
    'Ejemplo de error: duplicado dentro del fichero (igual que la fila 2, se omite).';

const FALLBACK_AULA = 'Aula A1';
const UNKNOWN_AULA_EXAMPLE = 'Aula Ejemplo Inexistente';

/**
 * Matriz de valores (AOA) de la plantilla, primera fila = cabecera.
 * La 4ª columna es solo ayuda y se ignora al importar.
 *
 * Las filas buenas usan aulas reales del colegio cuando se conocen (para que
 * la plantilla previsualice en verde tal cual se descarga); si no se pasan,
 * se usa un nombre de ejemplo y el comentario avisa de que hay que cambiarlo.
 */
export function buildImportTemplateTable(aulasDelColegio: readonly string[] = []): unknown[][] {
    const aulaBuena1 = aulasDelColegio[0] ?? FALLBACK_AULA;
    const aulaBuena2 = aulasDelColegio[1] ?? aulaBuena1;
    const usaEjemplos = aulasDelColegio.length === 0;
    return [
        ['nombre', 'apellidos', 'aula', IMPORT_TEMPLATE_COMMENT_HEADER],
        ['Lucía', 'Fernández Ruiz', aulaBuena1, COMMENT_EXAMPLE_VALID_1],
        [
            'Marco',
            'Polo Vidal',
            aulaBuena2,
            usaEjemplos ? COMMENT_EXAMPLE_VALID_2 : 'Ejemplo válido: sustituye esta fila por tus datos.',
        ],
        ['', 'López Serrano', aulaBuena1, COMMENT_ERROR_MISSING_NAME],
        ['Julia', '', aulaBuena1, COMMENT_ERROR_MISSING_LASTNAME],
        ['Pedro', 'Gómez Sanz', UNKNOWN_AULA_EXAMPLE, COMMENT_ERROR_UNKNOWN_CLASS],
        ['Lucía', 'Fernández Ruiz', aulaBuena1, COMMENT_ERROR_DUPLICATE],
    ];
}

/**
 * Construye los bytes del .xlsx de la plantilla en memoria.
 * Se verifica con `read` en el script manual de #20 (round-trip).
 */
export function buildImportTemplateBytes(aulasDelColegio: readonly string[] = []): Uint8Array {
    return aoaToXlsxBytes(
        buildImportTemplateTable(aulasDelColegio),
        IMPORT_TEMPLATE_SHEET_NAME,
        [{ wch: 16 }, { wch: 22 }, { wch: 14 }, { wch: 64 }]
    );
}

/** Relee la plantilla generada como matriz (verificación manual, sin BD). */
export function readImportTemplateBytes(bytes: Uint8Array): unknown[][] | null {
    return tableFromBytes(bytes);
}

/** Descarga la plantilla en el navegador (solo DOM, sin escritura en BD). */
export function downloadImportTemplate(aulasDelColegio: readonly string[] = []): void {
    const bytes = buildImportTemplateBytes(aulasDelColegio);
    downloadXlsxBytes(bytes, IMPORT_TEMPLATE_FILENAME);
}
