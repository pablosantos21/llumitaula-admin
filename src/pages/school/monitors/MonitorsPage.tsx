import { useState } from 'react'
import { MOCK_MONITORS } from '../../../mocks/monitors'
import type { Monitor } from '../../../mocks/monitors'
import { DataTable } from '../../../components/ui/data-table'
import { Badge } from '../../../components/ui/badge'
import { Button } from '../../../components/ui/button'
import { Plus, Edit2, UserMinus, UserCheck, Mail } from 'lucide-react'

export default function MonitorsPage() {
    const [monitors] = useState<Monitor[]>(MOCK_MONITORS)

    const columns = [
        {
            header: 'Monitor',
            accessor: (monitor: Monitor) => (
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-bold border border-gray-200">
                        {monitor.name.charAt(0)}
                    </div>
                    <div className="flex flex-col">
                        <span className="font-semibold text-gray-900">{monitor.name}</span>
                        <div className="flex items-center gap-1 text-xs text-gray-400">
                            <Mail className="h-3 w-3" />
                            {monitor.email}
                        </div>
                    </div>
                </div>
            )
        },
        {
            header: 'Clase Asignada',
            accessor: (monitor: Monitor) => monitor.assignedClass
        },
        {
            header: 'Estado',
            accessor: (monitor: Monitor) => (
                <Badge variant={monitor.isActive ? 'success' : 'default'}>
                    {monitor.isActive ? 'Activo' : 'Inactivo'}
                </Badge>
            )
        },
        {
            header: 'Acciones',
            className: 'text-right',
            accessor: (monitor: Monitor) => (
                <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8" title="Editar">
                        <Edit2 className="h-4 w-4" />
                    </Button>
                    {monitor.isActive ? (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-500 hover:text-amber-600 hover:bg-amber-50" title="Desactivar">
                            <UserMinus className="h-4 w-4" />
                        </Button>
                    ) : (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-green-500 hover:text-green-600 hover:bg-green-50" title="Activar">
                            <UserCheck className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            )
        }
    ]

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Personal: Monitores</h1>
                    <p className="text-sm text-gray-500">Gestiona el equipo de monitores asignados a las clases.</p>
                </div>
                <Button className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Nuevo Monitor
                </Button>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                <DataTable columns={columns} data={monitors} />
            </div>
        </div>
    )
}
