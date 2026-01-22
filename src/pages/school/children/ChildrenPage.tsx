import { useState } from 'react'
import { MOCK_CHILDREN } from '../../../mocks/children'
import type { Child } from '../../../mocks/children'
import { DataTable } from '../../../components/ui/data-table'
import { Badge } from '../../../components/ui/badge'
import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'
import { Plus, Search, Filter, Eye, Edit2, Tag } from 'lucide-react'
import { HealthTagsModal } from './components/HealthTagsModal'
import { EditChildModal } from './components/EditChildModal'

export default function ChildrenPage() {
    const [children, setChildren] = useState<Child[]>(MOCK_CHILDREN)
    const [searchTerm, setSearchTerm] = useState('')
    const [courseFilter, setCourseFilter] = useState('All')
    const [isTagsModalOpen, setIsTagsModalOpen] = useState(false)
    const [editingChild, setEditingChild] = useState<Child | null>(null)

    const filteredChildren = children.filter(child => {
        const matchesSearch = child.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            child.class.toLowerCase().includes(searchTerm.toLowerCase())
        const matchesCourse = courseFilter === 'All' || child.course === courseFilter
        return matchesSearch && matchesCourse
    })

    const handleSaveChild = (updatedChild: Child) => {
        setChildren(prev => prev.map(c => c.id === updatedChild.id ? updatedChild : c))
    }

    const columns = [
        {
            header: 'Nombre',
            accessor: (child: Child) => (
                <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-700 font-bold text-xs">
                        {child.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <span className="font-semibold text-gray-900">{child.name}</span>
                </div>
            )
        },
        {
            header: 'Clase',
            accessor: (child: Child) => (
                <div className="flex flex-col">
                    <span className="text-sm font-medium text-gray-700">{child.class}</span>
                    <span className="text-xs text-gray-400">{child.course}</span>
                </div>
            )
        },
        {
            header: 'Salud',
            accessor: (child: Child) => (
                <div className="flex flex-wrap gap-1 max-w-md">
                    {child.health && child.health.length > 0 ? (
                        child.health.map((tag) => (
                            <Badge key={tag} variant="warning" className="text-[10px] px-2 py-0">
                                {tag}
                            </Badge>
                        ))
                    ) : (
                        <span className="text-xs text-gray-400 italic">Sin restricciones</span>
                    )}
                </div>
            )
        },
        {
            header: 'Acciones',
            className: 'text-right',
            accessor: (child: Child) => (
                <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-indigo-600 hover:bg-indigo-50">
                        <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-gray-500 hover:text-indigo-600"
                        onClick={() => setEditingChild(child)}
                    >
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
                <div className="flex gap-2">
                    <Button variant="secondary" className="flex items-center gap-2" onClick={() => setIsTagsModalOpen(true)}>
                        <Tag className="h-4 w-4" />
                        Gestionar Etiquetas
                    </Button>
                    <Button className="flex items-center gap-2">
                        <Plus className="h-4 w-4" />
                        Inscribir Niño
                    </Button>
                </div>
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

            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                <DataTable columns={columns} data={filteredChildren} />
            </div>

            <HealthTagsModal
                isOpen={isTagsModalOpen}
                onClose={() => setIsTagsModalOpen(false)}
            />

            <EditChildModal
                isOpen={!!editingChild}
                onClose={() => setEditingChild(null)}
                child={editingChild}
                onSave={handleSaveChild}
            />
        </div>
    )
}
