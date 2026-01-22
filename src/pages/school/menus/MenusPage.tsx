import { useState } from 'react'
import { MOCK_MENUS } from '../../../mocks/menus'
import type { Menu } from '../../../mocks/menus'
import { DataTable } from '../../../components/ui/data-table'
import { Badge } from '../../../components/ui/badge'
import { Button } from '../../../components/ui/button'
import { Plus, Edit2, Trash2, Calendar } from 'lucide-react'

export default function MenusPage() {
    const [menus] = useState<Menu[]>(MOCK_MENUS)

    const getTypeBadgeVariant = (type: Menu['type']) => {
        switch (type) {
            case 'normal': return 'info'
            case 'sin-gluten': return 'warning'
            case 'vegetariano': return 'success'
            case 'halal': return 'default'
            default: return 'default'
        }
    }

    const columns = [
        {
            header: 'Nombre del Menú',
            accessor: (menu: Menu) => (
                <div className="flex flex-col">
                    <span className="font-semibold text-gray-900">{menu.name}</span>
                    <span className="text-xs text-gray-400">ID: {menu.id}</span>
                </div>
            )
        },
        {
            header: 'Vigencia',
            accessor: (menu: Menu) => (
                <div className="flex items-center gap-2 text-xs">
                    <Calendar className="h-3 w-3 text-gray-400" />
                    <span>{menu.startDate} al {menu.endDate}</span>
                </div>
            )
        },
        {
            header: 'Tipo',
            accessor: (menu: Menu) => (
                <Badge variant={getTypeBadgeVariant(menu.type)}>
                    {menu.type.replace('-', ' ')}
                </Badge>
            )
        },
        {
            header: 'Estado',
            accessor: (menu: Menu) => (
                <Badge variant={menu.isActive ? 'success' : 'default'}>
                    {menu.isActive ? 'Activo' : 'Inactivo'}
                </Badge>
            )
        },
        {
            header: 'Acciones',
            className: 'text-right',
            accessor: (_menu: Menu) => (
                <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50">
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            )
        }
    ]

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Gestión de Menús</h1>
                    <p className="text-sm text-gray-500">Configura los diferentes tipos de dietas y calendarios escolares.</p>
                </div>
                <Button className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Nuevo Menú
                </Button>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-200">
                <DataTable columns={columns} data={menus} />
            </div>
        </div>
    )
}
