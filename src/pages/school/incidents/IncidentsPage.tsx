import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { IncidentService, type Incident } from '../../../services/incidents.service'
import { DataTable } from '../../../components/ui/data-table'
import { Button } from '../../../components/ui/button'
import { Calendar, MessageSquare, Loader2 } from 'lucide-react'

export default function IncidentsPage() {
    const { schoolId } = useParams<{ schoolId: string }>()
    const [incidents, setIncidents] = useState<Incident[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const fetchIncidents = async () => {
            if (!schoolId) return
            try {
                setIsLoading(true)
                const data = await IncidentService.getIncidentsBySchool(schoolId)
                setIncidents(data)
            } catch (err) {
                console.error('Error fetching incidents:', err)
                setError('No se pudieron cargar las incidencias')
            } finally {
                setIsLoading(false)
            }
        }
        fetchIncidents()
    }, [schoolId])

    const columns = [
        {
            header: 'Niño/a',
            accessor: (incident: Incident) => (
                <span className="font-semibold text-gray-900">
                    {incident.children ? `${incident.children.first_name} ${incident.children.last_name}` : 'Desconocido'}
                </span>
            )
        },
        {
            header: 'Fecha',
            accessor: (incident: Incident) => (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Calendar className="h-3.5 w-3.5 text-gray-400" />
                    <span>{new Date(incident.created_at).toLocaleDateString()}</span>
                </div>
            )
        },
        {
            header: 'Descripción',
            accessor: (incident: Incident) => (
                <div className="flex items-center gap-2 text-gray-500 max-w-md">
                    <MessageSquare className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="truncate" title={incident.description}>{incident.description}</span>
                </div>
            )
        },
        {
            header: 'Acciones',
            className: 'text-right',
            accessor: () => (
                <div className="flex justify-end">
                    <Button variant="ghost" size="sm" className="text-primary-600">
                        Ver detalle
                    </Button>
                </div>
            )
        }
    ]

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center p-12">
                <Loader2 className="h-8 w-8 text-primary-600 animate-spin mb-4" />
                <p className="text-gray-500">Cargando incidencias...</p>
            </div>
        )
    }

    if (error) {
        return (
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg text-center">
                {error}
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Registro de Incidencias</h1>
                    <p className="text-sm text-gray-500">Histórico de avisos registrados por los monitores.</p>
                </div>
            </div>

            <DataTable
                columns={columns}
                data={incidents}
                emptyMessage="No hay incidencias registradas para este colegio."
            />
        </div>
    )
}
