import { collectRowsToInsert, type ImportInsertRow, type RowVerdict } from './child-import.ts';

export interface ImportWriteResult {
    insertados: number;
    fallidos: { excelRowNumber: number; motivo: string }[];
}

export type CreateChildFn = (child: {
    first_name: string;
    last_name: string;
    class_id: string;
}) => Promise<unknown>;

/**
 * Adaptador fino de escritura (#21): inserta solo las filas ok de una en una.
 *
 * Política parcial insert-only: nunca update ni delete, nunca escribe filas
 * con error/duplicadas/vacías (se filtran con `collectRowsToInsert`). Si una
 * inserción falla, se registra y se sigue con la siguiente para no bloquear
 * a las buenas. No valida: el llamante pasa los veredictos del dry-run ya
 * confirmado por el usuario.
 */
export async function insertImportOkRows(
    verdicts: readonly RowVerdict[],
    createChild: CreateChildFn,
): Promise<ImportWriteResult> {
    const toInsert: ImportInsertRow[] = collectRowsToInsert(verdicts);
    const result: ImportWriteResult = { insertados: 0, fallidos: [] };
    for (const row of toInsert) {
        try {
            await createChild({
                first_name: row.first_name,
                last_name: row.last_name,
                class_id: row.class_id,
            });
            result.insertados += 1;
        } catch (error) {
            result.fallidos.push({
                excelRowNumber: row.excelRowNumber,
                motivo:
                    error instanceof Error && error.message
                        ? `No se pudo importar la fila ${row.excelRowNumber}: ${error.message}`
                        : `No se pudo importar la fila ${row.excelRowNumber}.`,
            });
        }
    }
    return result;
}
