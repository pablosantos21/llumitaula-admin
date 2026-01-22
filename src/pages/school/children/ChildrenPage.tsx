import { useState } from 'react'
import { MOCK_CHILDREN } from '../../../mocks/children'
import type { Child } from '../../../mocks/children'
import { DataTable } from '../../../components/ui/data-table'
import { Badge } from '../../../components/ui/badge'
import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'
import { Plus, Search, Filter, Eye, Edit2 } from 'lucide-react'

export default function ChildrenPage() {
    const [searchTerm, setSearchTerm] = useState('')
    const [courseFilter, setCourseFilter] = useState('All')

    const filteredChildren = MOCK_CHILDREN.filter(child => {
        const matchesSearch = child.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            child.class.toLowerCase().includes(searchTerm.toLowerCase())
        const matchesCourse = courseFilter === 'All' || child.course === courseFilter
        return matchesSearch && matchesCourse
    })

    const columns = [
        {
            header: 'Nombre',
            accessor: (child: Child) => (
                <span className="font-semibold text-gray-900">{child.name}</span>
            )
        },
        {
            header: 'Clase',
            accessor: (child: Child) => child.class
        },
        {
            header: 'Curso',
            accessor: (child: Child) => (
                <Badge variant="info">{child.course}</Badge>
            )
        },
        {
            header: 'Observaciones',
            accessor: (child: Child) => (
                <span className="text-xs text-gray-400 max-w-xs truncate block">
                    {child.observations}
                </span>
            )
        },
        {
            header: 'Acciones',
            className: 'text-right',
            accessor: (_child: Child) => (
                <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-indigo-600 hover:bg-indigo-50">
                        <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500">
                        <Edit2 className="h-4 w-4" />
                    </Button>
                </div>
            )
        }
    ]

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Listado de Niños</h1>
                    <p className="text-sm text-gray-500">Consulta y gestiona la información de los alumnos comensales.</p>
                </div>
                <Button className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Inscribir Niño
                </Button>
            </div>

            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                        placeholder="Buscar por nombre o clase..."
                        className="pl-10"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex gap-2">
                    <select
                        className="flex h-10 w-[180px] rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 shadow-sm"
                        value={courseFilter}
                        onChange={(e) => setCourseFilter(e.target.value)}
                    >
                        <option value="All">Todos los cursos</option>
                        <option value="Infantil">Infantil</option>
                        <option value="Primaria">Primaria</option>
                        <option value="ESO">ESO</option>
                    </select>
                    <Button variant="secondary" className="gap-2">
                        <Filter className="h-4 w-4" />
                        Filtros
                    </Button>
                </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-200">
                <DataTable columns={columns} data={filteredChildren} />
            </div>
        </div>
    )
}
