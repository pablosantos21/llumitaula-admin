import { useState } from 'react'
import { MOCK_INCIDENTS } from '../../../mocks/incidents'
import type { Incident } from '../../../mocks/incidents'
import { DataTable } from '../../../components/ui/data-table'
import { Badge } from '../../../components/ui/badge'
import { Button } from '../../../components/ui/button'
import { Calendar, Filter, MessageSquare, AlertCircle } from 'lucide-react'

export default function IncidentsPage() {
    const [incidents] = useState<Incident[]>(MOCK_INCIDENTS)

    const getSeverityVariant = (severity: Incident['severity']) => {
        switch (severity) {
            case 'alta': return 'error'
            case 'media': return 'warning'
            case 'baja': return 'info'
            default: return 'default'
        }
    }

    const getTypeLabel = (type: Incident['type']) => {
        return type.charAt(0).toUpperCase() + type.slice(1)
    }

    const columns = [
        {
            header: 'Niño/a',
            accessor: (incident: Incident) => (
                <span className="font-semibold text-gray-900">{incident.childName}</span>
            )
        },
        {
            header: 'Fecha',
            accessor: (incident: Incident) => (
                <div className="flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 text-gray-400" />
                    <span>{incident.date}</span>
                </div>
            )
        },
        {
            header: 'Tipo',
            accessor: (incident: Incident) => (
                <span className="text-gray-600 font-medium">{getTypeLabel(incident.type)}</span>
            )
        },
        {
            header: 'Gravedad',
            accessor: (incident: Incident) => (
                <Badge variant={getSeverityVariant(incident.severity)}>
                    {incident.severity}
                </Badge>
            )
        },
        {
            header: 'Comentario',
            accessor: (incident: Incident) => (
                <div className="flex items-center gap-2 text-gray-500 max-w-xs truncate">
                    <MessageSquare className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="truncate">{incident.comment}</span>
                </div>
            )
        },
        {
            header: 'Acciones',
            className: 'text-right',
            accessor: (_incident: Incident) => (
                <div className="flex justify-end">
                    <Button variant="ghost" size="sm" className="text-indigo-600">
                        Ver detalle
                    </Button>
                </div>
            )
        }
    ]

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Registro de Incidencias</h1>
                    <p className="text-sm text-gray-500">Histórico de alertas dietéticas y de comportamiento.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-red-50 rounded-lg">
                        <AlertCircle className="h-6 w-6 text-red-600" />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500 font-medium">Alertas Críticas</p>
                        <p className="text-2xl font-bold text-gray-900">1</p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-indigo-50 rounded-lg">
                        <Calendar className="h-6 w-6 text-indigo-600" />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500 font-medium">Esta semana</p>
                        <p className="text-2xl font-bold text-gray-900">3</p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-gray-50 rounded-lg text-gray-600">
                        <Filter className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                        <Button variant="outline" size="sm" className="w-full">Filtrar Histórico</Button>
                    </div>
                </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-200">
                <DataTable columns={columns} data={incidents} />
            </div>
        </div>
    )
}
