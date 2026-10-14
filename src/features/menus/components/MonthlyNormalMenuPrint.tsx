import { useEffect, useState } from 'react'
import { Loader2, Printer, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MenuService } from '@/services/menus.service'
import { buildMonthlyPrintModel } from '../utils/monthly-print-model'
import { formatDate } from '../utils/date-utils'

interface MonthlyNormalMenuPrintProps {
    month: Date
    onClose: () => void
}

const monthName = (year: number, month: number) => new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(new Date(year, month, 1))

export function MonthlyNormalMenuPrint({ month, onClose }: MonthlyNormalMenuPrintProps) {
    const year = month.getFullYear()
    const monthIndex = month.getMonth()
    const title = `Menú Normal - ${monthName(year, monthIndex)}`
    const [model, setModel] = useState<ReturnType<typeof buildMonthlyPrintModel> | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        const previousTitle = document.title
        document.title = title
        let cancelled = false
        const start = formatDate(new Date(year, monthIndex, 1))
        const end = formatDate(new Date(year, monthIndex + 1, 0))
        const restoreTitle = () => { document.title = previousTitle }
        MenuService.getMonthlyPrintAssignments(start, end)
            .then(assignments => {
                if (!cancelled) setModel(buildMonthlyPrintModel(year, monthIndex, assignments))
            })
            .catch(() => { if (!cancelled) setError('No se pudo cargar el menú del mes. Inténtalo de nuevo.') })
            .finally(() => { if (!cancelled) setIsLoading(false) })
        window.addEventListener('afterprint', restoreTitle)
        return () => {
            cancelled = true
            window.removeEventListener('afterprint', restoreTitle)
            restoreTitle()
        }
    }, [monthIndex, title, year])

    const print = () => {
        document.title = title
        window.print()
    }

    return (
        <div className="print-preview-overlay fixed inset-0 z-50 overflow-y-auto bg-gray-100 p-4 sm:p-8" role="dialog" aria-modal="true" aria-label="Vista previa del menú normal">
            <div className="print-preview-toolbar mx-auto mb-4 flex max-w-4xl items-center justify-between rounded-lg bg-white p-3 shadow">
                <h2 className="font-semibold text-gray-900">Vista previa de impresión</h2>
                <div className="flex gap-2">
                    <Button onClick={print} disabled={!model || isLoading}><Printer className="mr-2 h-4 w-4" />Imprimir / Guardar PDF</Button>
                    <Button variant="ghost" onClick={onClose} aria-label="Cerrar vista previa"><X className="h-4 w-4" /></Button>
                </div>
            </div>
            {isLoading ? <div className="mx-auto flex max-w-4xl items-center justify-center bg-white p-16 text-gray-600"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Cargando menú…</div> : error ? <p role="alert" className="mx-auto max-w-4xl rounded bg-white p-8 text-red-700">{error}</p> : model && (
                <article className="print-sheet mx-auto max-w-4xl bg-white px-8 py-10 text-gray-900 shadow-lg">
                    <header className="mb-6 border-b border-gray-300 pb-4 text-center">
                        <h1 className="text-2xl font-bold">Menú Normal</h1>
                        <p className="mt-1 text-lg capitalize">{monthName(year, monthIndex)}</p>
                    </header>
                    <table className="w-full border-collapse text-sm">
                        <thead><tr className="border-b-2 border-gray-500 text-left"><th className="w-28 py-2 pr-3">Día</th><th className="py-2">Menú</th></tr></thead>
                        <tbody>{model.days.map(day => (
                            <tr key={day.date} className="print-day border-b border-gray-200 align-top">
                                <th scope="row" className="py-2 pr-3 text-left font-semibold">{new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric' }).format(new Date(`${day.date}T12:00:00`))}</th>
                                <td className="py-2">{day.notice ? <span className="italic text-gray-500">{day.notice}</span> : <dl className="grid grid-cols-1 gap-x-5 gap-y-0.5 sm:grid-cols-2">{day.base.map(dish => <div key={dish.label} className="flex gap-1"><dt className="font-semibold">{dish.label}:</dt><dd>{dish.value}</dd></div>)}</dl>}</td>
                            </tr>
                        ))}</tbody>
                    </table>
                    <footer className="mt-6 border-t border-gray-300 pt-2 text-right text-xs text-gray-500">Generado el {new Intl.DateTimeFormat('es-ES', { dateStyle: 'long', timeStyle: 'short' }).format(new Date())}</footer>
                </article>
            )}
        </div>
    )
}
