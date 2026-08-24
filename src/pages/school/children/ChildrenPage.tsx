import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ChildService, type Child } from '../../../services/children.service'
import { ClassService, type Class } from '../../../services/classes.service'
import { AllergenService, type Allergen } from '../../../services/allergens.service'
import { DataTable } from '../../../components/ui/data-table'
import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'
import { Plus, Search, Eye, Edit2, Loader2, Trash2 } from 'lucide-react'
import { EditChildModal } from './components/EditChildModal'
import { AddChildModal } from './components/AddChildModal'
import { DeleteChildModal } from './components/DeleteChildModal'

export default function ChildrenPage() {
    const { schoolId } = useParams<{ schoolId: string }>()
    const [children, setChildren] = useState<Child[]>([])
    const [searchTerm, setSearchTerm] = useState('')
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [editingChild, setEditingChild] = useState<Child | null>(null)
    const [deletingChild, setDeletingChild] = useState<Child | null>(null)
    const [isAddModalOpen, setIsAddModalOpen] = useState(false)
    const [classes, setClasses] = useState<Class[]>([])
    const [allergens, setAllergens] = useState<Allergen[]>([])
    const [isSaving, setIsSaving] = useState(false)

    useEffect(() => {
        const fetchData = async () => {
            if (!schoolId) return
            try {
                setIsLoading(true)
                const [childrenData, classesData, allergensData] = await Promise.all([
                    ChildService.getChildrenBySchool(schoolId),
                    ClassService.getClassesBySchool(schoolId),
                    AllergenService.getAll()
                ])
                setChildren(childrenData)
                setClasses(classesData)
                setAllergens(allergensData)
            } catch (err) {
                console.error('Error fetching data:', err)
                setError('No se pudieron cargar los datos')
            } finally {
                setIsLoading(false)
            }
        }
        fetchData()
    }, [schoolId])

    const filteredChildren = children.filter(child => {
        const fullName = `${child.first_name} ${child.last_name}`.toLowerCase()
        const className = child.classes?.name.toLowerCase() || ''
        const search = searchTerm.toLowerCase()
        return fullName.includes(search) || className.includes(search)
    })

    const activeClasses = Array.from(new Map(
        classes
            .filter(cls => cls.is_active)
            .map(cls => [cls.id, cls] as const)
    ).values())
    const editClasses = editingChild
        ? Array.from(new Map([
            ...activeClasses,
            ...classes.filter(cls => cls.id === editingChild.class_id && !cls.is_active)
        ].map(cls => [cls.id, cls])).values())
        : activeClasses

    const handleCreateChild = async (newChildData: { first_name: string; last_name: string; class_id: string; allergenIds: string[] }) => {
        try {
            setIsSaving(true)
            const { allergenIds, ...childData } = newChildData
            const created = await ChildService.createChild(childData)
            if (allergenIds.length > 0) {
                await ChildService.setChildAllergens(created.id, allergenIds)
            }
            if (schoolId) {
                const updatedChildren = await ChildService.getChildrenBySchool(schoolId)
                setChildren(updatedChildren)
            }
        } catch (err) {
            console.error('Error creating child:', err)
        } finally {
            setIsSaving(false)
        }
    }

    const handleUpdateChild = async (updatedChild: Child, allergenIds: string[]) => {
        try {
            setIsSaving(true)
            const { id, first_name, last_name, class_id } = updatedChild
            const updates = { first_name, last_name, class_id }
            await ChildService.updateChild(id, updates)
            await ChildService.setChildAllergens(id, allergenIds)
            if (schoolId) {
                const updatedChildren = await ChildService.getChildrenBySchool(schoolId)
                setChildren(updatedChildren)
            }
        } catch (err) {
            console.error('Error updating child:', err)
        } finally {
            setIsSaving(false)
        }
    }

    const handleDeleteChild = async (id: string) => {
        try {
            setIsSaving(true)
            await ChildService.deleteChild(id)
            setChildren(prev => prev.filter(c => c.id !== id))
            setDeletingChild(null)
        } catch (err) {
            console.error('Error deleting child:', err)
        } finally {
            setIsSaving(false)
        }
    }

    const columns = [
        {
            header: 'Nombre',
            accessor: (child: Child) => (
                <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-700 font-bold text-xs">
                        {child.first_name[0]}{child.last_name[0]}
                    </div>
                    <span className="font-semibold text-gray-900">{child.first_name} {child.last_name}</span>
                </div>
            )
        },
        {
            header: 'Clase',
            accessor: (child: Child) => (
                <span className="text-sm font-medium text-gray-700">{child.classes?.name || 'Sin asignar'}</span>
            )
        },
        {
            header: 'Menú Especial',
            accessor: (child: Child) => {
                const hasAllergens = child.child_allergens && child.child_allergens.length > 0
                return (
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${hasAllergens ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-500'}`}>
                        {hasAllergens ? `Sí (${child.child_allergens!.length})` : 'No'}
                    </span>
                )
            }
        },
        {
            header: 'Fecha de Alta',
            accessor: (child: Child) => (
                <span className="text-xs text-gray-500">
                    {new Date(child.created_at).toLocaleDateString()}
                </span>
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
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-gray-400 hover:text-red-600"
                        onClick={() => setDeletingChild(child)}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            )
        }
    ]

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center p-12">
                <Loader2 className="h-8 w-8 text-indigo-600 animate-spin mb-4" />
                <p className="text-gray-500">Cargando alumnos...</p>
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
                    <h1 className="text-2xl font-bold text-gray-900">Listado de Niños</h1>
                    <p className="text-sm text-gray-500">Consulta y gestiona la información de los alumnos comensales.</p>
                </div>
                <div className="flex gap-2">
                    <Button
                        className="flex items-center gap-2"
                        onClick={() => setIsAddModalOpen(true)}
                    >
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
            </div>

            <DataTable
                columns={columns}
                data={filteredChildren}
            />

            <EditChildModal
                isOpen={!!editingChild}
                onClose={() => setEditingChild(null)}
                child={editingChild}
                classes={editClasses}
                allergens={allergens}
                isLoading={isSaving}
                onSave={handleUpdateChild}
            />

            <AddChildModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                classes={activeClasses}
                allergens={allergens}
                isLoading={isSaving}
                onSave={handleCreateChild}
            />

            <DeleteChildModal
                isOpen={!!deletingChild}
                onClose={() => setDeletingChild(null)}
                child={deletingChild}
                isLoading={isSaving}
                onConfirm={handleDeleteChild}
            />
        </div>
    )
}
