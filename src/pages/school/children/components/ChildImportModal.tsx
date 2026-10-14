import { useRef, useState } from 'react'
import { CheckCircle2, Download, FileSpreadsheet, Loader2, RotateCcw, Upload } from 'lucide-react'
import { Modal } from '../../../../components/ui/modal'
import { Button } from '../../../../components/ui/button'
import { DataTable } from '../../../../components/ui/data-table'
import type { Class } from '../../../../services/classes.service'
import type { Child } from '../../../../services/children.service'
import { ChildService } from '../../../../services/children.service'
import {
    dryRunImportFile,
    type ImportCatalogs,
} from '../../../../lib/child-import-xlsx'
import type { ImportValidationResult, RowVerdict } from '../../../../lib/child-import'
import { downloadImportTemplate } from '../../../../lib/child-import-template'
import { downloadErrorReport } from '../../../../lib/child-import-error-report'
import { insertImportOkRows, type ImportWriteResult } from '../../../../lib/child-import-write'
import { cn } from '../../../../lib/utils'

interface ChildImportModalProps {
    isOpen: boolean
    onClose: () => void
    classes: Class[]
    existingChildren: Child[]
    onImported: () => Promise<void>
}

type Step = 'subir' | 'previsualizar' | 'resultado'

type PreviewEstado = 'ok' | 'error' | 'duplicado'

interface PreviewRow {
    key: string
    excelRowNumber: number
    nombre: string
    apellidos: string
    aula: string
    estado: PreviewEstado
    motivo: string
}

function verdictToPreviewRow(verdict: RowVerdict): PreviewRow | null {
    if (verdict.estado === 'vacia') return null
    const base = {
        key: `fila-${verdict.excelRowNumber}`,
        excelRowNumber: verdict.excelRowNumber,
        nombre: verdict.nombre,
        apellidos: verdict.apellidos,
        aula: verdict.aula,
    }
    if (verdict.estado === 'ok') {
        return { ...base, estado: 'ok', motivo: 'Lista para importar.' }
    }
    if (verdict.estado === 'duplicado') {
        return { ...base, estado: 'duplicado', motivo: verdict.motivo }
    }
    return {
        ...base,
        estado: 'error',
        motivo: verdict.errores.map((e) => e.motivo).join(' '),
    }
}

const ESTADO_STYLE: Record<PreviewEstado, { label: string; className: string }> = {
    ok: { label: 'Lista', className: 'bg-green-100 text-green-800' },
    error: { label: 'Con error', className: 'bg-red-100 text-red-800' },
    duplicado: { label: 'Duplicada', className: 'bg-amber-100 text-amber-800' },
}

export function ChildImportModal({ isOpen, onClose, classes, existingChildren, onImported }: ChildImportModalProps) {
    const [step, setStep] = useState<Step>('subir')
    const [fileName, setFileName] = useState<string | null>(null)
    const [preview, setPreview] = useState<ImportValidationResult | null>(null)
    const [parseError, setParseError] = useState<string | null>(null)
    const [isProcessing, setIsProcessing] = useState(false)
    const [isConfirming, setIsConfirming] = useState(false)
    const [confirmError, setConfirmError] = useState<string | null>(null)
    const [writeResult, setWriteResult] = useState<{ insertados: number; omitidos: number; conError: number; fallidos: ImportWriteResult['fallidos'] } | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const resetToUpload = () => {
        setStep('subir')
        setFileName(null)
        setPreview(null)
        setParseError(null)
        setIsProcessing(false)
        setIsConfirming(false)
        setConfirmError(null)
        setWriteResult(null)
        if (fileInputRef.current) fileInputRef.current.value = ''
    }

    const handleClose = () => {
        resetToUpload()
        onClose()
    }

    const buildCatalogs = (): ImportCatalogs => ({
        classes: classes.map((cls) => ({ id: cls.id, name: cls.name })),
        existingChildren: existingChildren.map((child) => ({
            first_name: child.first_name,
            last_name: child.last_name,
            class_id: child.class_id,
        })),
    })

    const aulaNames = classes.map((cls) => cls.name)

    const handleFileSelected = async (file: File | undefined) => {
        if (!file) return
        const isXlsx = /\.xlsx$/i.test(file.name)
        if (!isXlsx) {
            setParseError('El fichero debe ser un Excel .xlsx: descarga la plantilla y vuelve a intentarlo.')
            setFileName(file.name)
            setPreview(null)
            return
        }
        setFileName(file.name)
        setParseError(null)
        setPreview(null)
        setWriteResult(null)
        setConfirmError(null)
        setIsProcessing(true)
        try {
            // Dry-run en cliente: solo lee el fichero y los catálogos ya
            // cargados. Nunca escribe en la base de datos.
            const dryRun = await dryRunImportFile(file, buildCatalogs())
            if (!dryRun.ok) {
                setParseError(dryRun.motivo)
                setPreview(null)
                return
            }
            setPreview(dryRun.result)
            setStep('previsualizar')
        } catch {
            setParseError('No se pudo leer el fichero .xlsx: comprueba que sea un Excel válido.')
            setPreview(null)
        } finally {
            setIsProcessing(false)
        }
    }

    const handleConfirmImport = async () => {
        if (!preview || isConfirming) return
        // Confirmación explícita: solo aquí se escribe, y solo las filas ok
        // (parcial insert-only; errores y duplicados nunca se escriben).
        if (preview.summary.listos === 0 || preview.excedeLimite) return
        setIsConfirming(true)
        setConfirmError(null)
        try {
            const write = await insertImportOkRows(preview.verdicts, (child) =>
                ChildService.createChild(child),
            )
            await onImported()
            setWriteResult({
                insertados: write.insertados,
                omitidos: preview.summary.duplicados,
                conError: preview.summary.conError,
                fallidos: write.fallidos,
            })
            setStep('resultado')
        } catch {
            setConfirmError('No se pudo completar la importación: inténtalo de nuevo.')
        } finally {
            setIsConfirming(false)
        }
    }

    // El reporte siempre incluye cabecera + resumen, así que se ofrece
    // aunque no haya filas con error (resume total/listos).
    const canDownloadReport = preview !== null

    const previewRows: PreviewRow[] = preview
        ? preview.verdicts.flatMap((verdict) => {
            const row = verdictToPreviewRow(verdict)
            return row ? [row] : []
        })
        : []

    const errorOnlyRows = previewRows.filter((row) => row.estado === 'error')

    const columns = [
        {
            header: 'Fila Excel',
            accessor: (row: PreviewRow) => (
                <span className="font-mono text-xs font-semibold text-gray-900">{row.excelRowNumber}</span>
            ),
        },
        {
            header: 'Nombre',
            accessor: (row: PreviewRow) => <span className="text-gray-900">{row.nombre || '—'}</span>,
        },
        {
            header: 'Apellidos',
            accessor: (row: PreviewRow) => <span className="text-gray-900">{row.apellidos || '—'}</span>,
        },
        {
            header: 'Aula',
            accessor: (row: PreviewRow) => <span className="text-gray-900">{row.aula || '—'}</span>,
        },
        {
            header: 'Estado',
            accessor: (row: PreviewRow) => (
                <span
                    className={cn(
                        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                        ESTADO_STYLE[row.estado].className,
                    )}
                >
                    {ESTADO_STYLE[row.estado].label}
                </span>
            ),
        },
        {
            header: 'Motivo',
            accessor: (row: PreviewRow) => (
                <span className="block max-w-md whitespace-normal text-xs text-gray-600">{row.motivo}</span>
            ),
        },
    ]

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title="Importar alumnos desde Excel" size="6xl">
            <div className="space-y-6">
                <ol className="flex items-center gap-2 text-xs font-medium" aria-label="Pasos de la importación">
                    <li
                        className={cn(
                            'flex items-center gap-2 rounded-full px-3 py-1.5',
                            step === 'subir' ? 'bg-primary-600 text-white' : 'bg-primary-50 text-primary-700',
                        )}
                        aria-current={step === 'subir' ? 'step' : undefined}
                    >
                        <span className="font-bold">1</span> Subir
                    </li>
                    <li aria-hidden="true" className="h-px w-6 bg-gray-200" />
                    <li
                        className={cn(
                            'flex items-center gap-2 rounded-full px-3 py-1.5',
                            step === 'previsualizar' ? 'bg-primary-600 text-white' : step === 'resultado' ? 'bg-primary-50 text-primary-700' : 'bg-gray-100 text-gray-500',
                        )}
                        aria-current={step === 'previsualizar' ? 'step' : undefined}
                    >
                        <span className="font-bold">2</span> Previsualizar
                    </li>
                    <li aria-hidden="true" className="h-px w-6 bg-gray-200" />
                    <li
                        className={cn(
                            'flex items-center gap-2 rounded-full px-3 py-1.5',
                            step === 'resultado' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-500',
                        )}
                        aria-current={step === 'resultado' ? 'step' : undefined}
                    >
                        <span className="font-bold">3</span> Confirmar
                    </li>
                </ol>

                {step === 'subir' && (
                    <div className="space-y-4">
                        <p className="text-sm text-gray-600">
                            Sube un fichero <strong>.xlsx</strong> cuya primera hoja tenga como primera fila la
                            cabecera <strong>nombre | apellidos | aula</strong>. Las columnas extra se ignoran, las
                            filas vacías no cuentan y el límite es de <strong>1000 filas</strong>. En este paso no se
                            escribe nada en la base de datos.
                        </p>
                        <div className="flex flex-wrap gap-2">
                            <Button type="button" variant="secondary" onClick={() => downloadImportTemplate(aulaNames)}>
                                <Download className="h-4 w-4" />
                                Descargar plantilla .xlsx
                            </Button>
                            <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isProcessing}>
                                <Upload className="h-4 w-4" />
                                {fileName ? 'Elegir otro fichero' : 'Elegir fichero .xlsx'}
                            </Button>
                        </div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                            className="hidden"
                            aria-label="Fichero .xlsx para importar"
                            onChange={(e) => void handleFileSelected(e.target.files?.[0])}
                        />
                        {fileName && (
                            <p className="flex items-center gap-2 text-sm text-gray-700">
                                <FileSpreadsheet className="h-4 w-4 text-primary-600" />
                                {fileName}
                            </p>
                        )}
                        {isProcessing && (
                            <p className="flex items-center gap-2 text-sm text-gray-500" role="status">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Leyendo y validando el fichero (sin escribir nada)...
                            </p>
                        )}
                        {parseError && (
                            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
                                {parseError}
                            </div>
                        )}
                    </div>
                )}

                {step === 'previsualizar' && preview && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-center">
                                <p className="text-2xl font-bold text-gray-900">{preview.summary.total}</p>
                                <p className="text-xs font-medium text-gray-500">Total</p>
                            </div>
                            <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-center">
                                <p className="text-2xl font-bold text-green-800">{preview.summary.listos}</p>
                                <p className="text-xs font-medium text-green-700">Listos</p>
                            </div>
                            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-center">
                                <p className="text-2xl font-bold text-red-800">{preview.summary.conError}</p>
                                <p className="text-xs font-medium text-red-700">Con error</p>
                            </div>
                            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-center">
                                <p className="text-2xl font-bold text-amber-800">{preview.summary.duplicados}</p>
                                <p className="text-xs font-medium text-amber-700">Duplicados</p>
                            </div>
                        </div>

                        <p className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
                            Previsualización de <strong>{fileName}</strong>: todavía no se ha escrito nada en la base
                            de datos. Si recargas la lista de alumnos verás que no cambia. Solo al pulsar
                            <strong> Confirmar importación</strong> se insertan las filas listas.
                        </p>

                        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                            Se importarán solo las <strong>{preview.summary.listos} filas listas</strong>. Las filas
                            con error y las duplicadas no se escriben; los alumnos que ya existen se omiten sin
                            sobrescribirse.
                        </p>

                        {confirmError && (
                            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
                                {confirmError}
                            </div>
                        )}

                        {preview.excedeLimite && (
                            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
                                {preview.mensajeLimite}
                            </div>
                        )}

                        <DataTable
                            columns={columns}
                            data={previewRows}
                            emptyMessage="El fichero no tiene filas con datos."
                        />

                        {errorOnlyRows.length > 0 && (
                            <p className="text-xs text-gray-500">
                                {errorOnlyRows.length} {errorOnlyRows.length === 1 ? 'fila necesita' : 'filas necesitan'} corrección
                                (nº de fila real del Excel + motivo en español). Las filas duplicadas se omiten sin
                                necesidad de corrección.
                            </p>
                        )}

                        <div className="flex flex-wrap justify-between gap-2 border-t border-gray-100 pt-4">
                            <Button type="button" variant="ghost" onClick={resetToUpload} disabled={isConfirming}>
                                <RotateCcw className="h-4 w-4" />
                                Elegir otro fichero
                            </Button>
                            <div className="flex flex-wrap gap-2">
                                {canDownloadReport && (
                                    <Button type="button" variant="secondary" onClick={() => preview && downloadErrorReport(preview)} disabled={isConfirming}>
                                        <Download className="h-4 w-4" />
                                        Reporte de errores (.xlsx)
                                    </Button>
                                )}
                                <Button
                                    type="button"
                                    onClick={() => void handleConfirmImport()}
                                    disabled={isConfirming || preview.summary.listos === 0 || preview.excedeLimite}
                                    title={preview.summary.listos === 0 ? 'No hay filas listas para importar' : `Confirmar la importación de ${preview.summary.listos} alumnos`}
                                >
                                    {isConfirming ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Importando...
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle2 className="h-4 w-4" />
                                            Confirmar importación ({preview.summary.listos})
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {step === 'resultado' && preview && writeResult && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                            <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-center">
                                <p className="text-2xl font-bold text-green-800">{writeResult.insertados}</p>
                                <p className="text-xs font-medium text-green-700">Insertados</p>
                            </div>
                            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-center">
                                <p className="text-2xl font-bold text-amber-800">{writeResult.omitidos}</p>
                                <p className="text-xs font-medium text-amber-700">Omitidos (duplicados)</p>
                            </div>
                            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-center">
                                <p className="text-2xl font-bold text-red-800">{writeResult.conError}</p>
                                <p className="text-xs font-medium text-red-700">Con error</p>
                            </div>
                        </div>

                        <p className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800" role="status">
                            Importación completada: <strong>{writeResult.insertados}</strong> alumnos insertados,{' '}
                            <strong>{writeResult.omitidos}</strong> omitidos y{' '}
                            <strong>{writeResult.conError}</strong> con error. La lista de alumnos ya se ha
                            recargado.
                        </p>

                        {writeResult.fallidos.length > 0 && (
                            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
                                <p className="font-semibold">No se pudieron escribir {writeResult.fallidos.length} filas:</p>
                                <ul className="mt-1 list-disc pl-5">
                                    {writeResult.fallidos.map((f) => (
                                        <li key={f.excelRowNumber}>{f.motivo}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <div className="flex flex-wrap justify-between gap-2 border-t border-gray-100 pt-4">
                            <Button type="button" variant="ghost" onClick={resetToUpload}>
                                <RotateCcw className="h-4 w-4" />
                                Importar otro fichero
                            </Button>
                            <div className="flex flex-wrap gap-2">
                                {canDownloadReport && (
                                    <Button type="button" variant="secondary" onClick={() => preview && downloadErrorReport(preview)}>
                                        <Download className="h-4 w-4" />
                                        Reporte de errores (.xlsx)
                                    </Button>
                                )}
                                <Button type="button" onClick={handleClose}>
                                    Cerrar
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    )
}
