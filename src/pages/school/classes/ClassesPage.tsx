import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ClassService, type Class } from '../../../services/classes.service'
import { SchoolService, type School } from '../../../services/schools.service'
import { DataTable } from '../../../components/ui/data-table'
import { Modal } from '../../../components/ui/modal'
import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'
import { Label } from '../../../components/ui/label'
import { Badge } from '../../../components/ui/badge'
import { Edit2, Loader2, Plus, Power } from 'lucide-react'

type Mutation = 'school' | 'create' | 'edit' | 'toggle' | null

const sortClasses = (classes: Class[]) =>
    [...classes].sort((a, b) => a.name.localeCompare(b.name))

export default function ClassesPage() {
    const { schoolId } = useParams<{ schoolId: string }>()
    const [school, setSchool] = useState<School | null>(null)
    const [classes, setClasses] = useState<Class[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [mutationError, setMutationError] = useState<string | null>(null)
    const [mutation, setMutation] = useState<Mutation>(null)

    const [isSchoolModalOpen, setIsSchoolModalOpen] = useState(false)
    const [schoolName, setSchoolName] = useState('')
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
    const [newClassName, setNewClassName] = useState('')
    const [classToEdit, setClassToEdit] = useState<Class | null>(null)
    const [editClassName, setEditClassName] = useState('')
    const [classToToggle, setClassToToggle] = useState<Class | null>(null)

    useEffect(() => {
        let isCurrent = true

        const fetchData = async () => {
            setIsLoading(true)
            setError(null)

            if (!schoolId) {
                setError('No se pudo identificar el colegio.')
                setIsLoading(false)
                return
            }

            try {
                const [schoolData, classData] = await Promise.all([
                    SchoolService.getSchoolById(schoolId),
                    ClassService.getClassesBySchool(schoolId)
                ])
                if (isCurrent) {
                    setSchool(schoolData)
                    setClasses(sortClasses(classData))
                }
            } catch (err) {
                console.error('Error loading school classes:', err)
                if (isCurrent) setError('No se pudieron cargar el colegio y las aulas.')
            } finally {
                if (isCurrent) setIsLoading(false)
            }
        }

        fetchData()
        return () => {
            isCurrent = false
        }
    }, [schoolId])

    const handleUpdateSchool = async (event: React.FormEvent) => {
        event.preventDefault()
        const trimmedName = schoolName.trim()
        if (!schoolId || !trimmedName || !school) return

        try {
            setMutation('school')
            setMutationError(null)
            const updatedSchool = await SchoolService.updateSchoolName(schoolId, trimmedName)
            setSchool(updatedSchool)
            setIsSchoolModalOpen(false)
        } catch (err) {
            console.error('Error updating school name:', err)
            setMutationError('No se pudo actualizar el nombre del colegio.')
        } finally {
            setMutation(null)
        }
    }

    const handleCreateClass = async (event: React.FormEvent) => {
        event.preventDefault()
        const trimmedName = newClassName.trim()
        if (!schoolId || !trimmedName) return

        try {
            setMutation('create')
            setMutationError(null)
            const createdClass = await ClassService.createClass(trimmedName, schoolId)
            setClasses(prev => sortClasses([...prev, createdClass]))
            setNewClassName('')
            setIsCreateModalOpen(false)
        } catch (err) {
            console.error('Error creating class:', err)
            setMutationError('No se pudo crear el aula.')
        } finally {
            setMutation(null)
        }
    }

    const handleUpdateClass = async (event: React.FormEvent) => {
        event.preventDefault()
        const trimmedName = editClassName.trim()
        if (!classToEdit || !trimmedName) return

        try {
            setMutation('edit')
            setMutationError(null)
            const updatedClass = await ClassService.updateClass(classToEdit.id, trimmedName)
            setClasses(prev => sortClasses(prev.map(item => item.id === updatedClass.id ? updatedClass : item)))
            setClassToEdit(null)
            setEditClassName('')
        } catch (err) {
            console.error('Error updating class:', err)
            setMutationError('No se pudo actualizar el aula.')
        } finally {
            setMutation(null)
        }
    }

    const handleToggleClass = async () => {
        if (!classToToggle) return

        try {
            setMutation('toggle')
            setMutationError(null)
            const updatedClass = await ClassService.setClassActive(classToToggle.id, !classToToggle.is_active)
            setClasses(prev => prev.map(item => item.id === updatedClass.id
                ? { ...item, is_active: updatedClass.is_active }
                : item))
            setClassToToggle(null)
        } catch (err) {
            console.error('Error changing class state:', err)
            setMutationError(`No se pudo ${classToToggle.is_active ? 'desactivar' : 'activar'} el aula.`)
        } finally {
            setMutation(null)
        }
    }

    const openEditClass = (classItem: Class) => {
        setClassToEdit(classItem)
        setEditClassName(classItem.name)
        setMutationError(null)
    }

    const columns = [
        {
            header: 'Aula',
            accessor: (classItem: Class) => <span className="font-semibold text-gray-900">{classItem.name}</span>
        },
        {
            header: 'Estado',
            accessor: (classItem: Class) => (
                <Badge variant={classItem.is_active ? 'success' : 'default'}>
                    {classItem.is_active ? 'Activa' : 'Inactiva'}
                </Badge>
            )
        },
        {
            header: 'Acciones',
            className: 'text-right',
            accessor: (classItem: Class) => (
                <div className="flex justify-end gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-indigo-600 hover:bg-indigo-50"
                        title="Editar aula"
                        aria-label={`Editar aula ${classItem.name}`}
                        onClick={() => openEditClass(classItem)}
                        disabled={mutation !== null}
                    >
                        <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-gray-500 hover:text-indigo-600"
                        title={classItem.is_active ? 'Desactivar aula' : 'Activar aula'}
                        aria-label={`${classItem.is_active ? 'Desactivar' : 'Activar'} aula ${classItem.name}`}
                        onClick={() => {
                            setClassToToggle(classItem)
                            setMutationError(null)
                        }}
                        disabled={mutation !== null}
                    >
                        <Power className="h-4 w-4" />
                    </Button>
                </div>
            )
        }
    ]

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center p-12" role="status" aria-live="polite">
                <Loader2 className="h-8 w-8 text-indigo-600 animate-spin mb-4" aria-hidden="true" />
                <p className="text-gray-500">Cargando colegio y aulas...</p>
            </div>
        )
    }

    if (error) {
        return <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg text-center" role="alert">{error}</div>
    }

    const isSchoolMutation = mutation === 'school'
    const isCreateMutation = mutation === 'create'
    const isEditMutation = mutation === 'edit'
    const isToggleMutation = mutation === 'toggle'

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold text-gray-900">{school?.name}</h1>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-gray-500 hover:text-indigo-600"
                            title="Editar nombre del colegio"
                            aria-label="Editar nombre del colegio"
                            onClick={() => {
                                setSchoolName(school?.name || '')
                                setMutationError(null)
                                setIsSchoolModalOpen(true)
                            }}
                            disabled={mutation !== null}
                        >
                            <Edit2 className="h-4 w-4" />
                        </Button>
                    </div>
                    <p className="text-sm text-gray-500">Gestión de aulas y su estado de disponibilidad.</p>
                </div>
                <Button
                    onClick={() => {
                        setMutationError(null)
                        setIsCreateModalOpen(true)
                    }}
                    className="flex items-center gap-2"
                    disabled={mutation !== null}
                >
                    <Plus className="h-4 w-4" />
                    Nueva aula
                </Button>
            </div>

            <DataTable columns={columns} data={classes} emptyMessage="No hay aulas registradas para este colegio." />

            <Modal isOpen={isSchoolModalOpen} onClose={() => !isSchoolMutation && setIsSchoolModalOpen(false)} title="Editar colegio">
                <form onSubmit={handleUpdateSchool} className="space-y-6">
                    {mutationError && <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg" role="alert">{mutationError}</div>}
                    <div className="space-y-2">
                        <Label htmlFor="school-name">Nombre del colegio</Label>
                        <Input id="school-name" value={schoolName} onChange={event => setSchoolName(event.target.value)} required autoFocus disabled={isSchoolMutation} />
                    </div>
                    <div className="flex justify-end gap-3">
                        <Button type="button" variant="ghost" onClick={() => setIsSchoolModalOpen(false)} disabled={isSchoolMutation}>Cancelar</Button>
                        <Button type="submit" disabled={isSchoolMutation || !schoolName.trim()}>
                            {isSchoolMutation ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Guardando...</> : 'Guardar cambios'}
                        </Button>
                    </div>
                </form>
            </Modal>

            <Modal isOpen={isCreateModalOpen} onClose={() => !isCreateMutation && setIsCreateModalOpen(false)} title="Nueva aula">
                <form onSubmit={handleCreateClass} className="space-y-6">
                    {mutationError && <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg" role="alert">{mutationError}</div>}
                    <div className="space-y-2">
                        <Label htmlFor="new-class-name">Nombre del aula</Label>
                        <Input id="new-class-name" value={newClassName} onChange={event => setNewClassName(event.target.value)} placeholder="Ej. Infantil 3 años" required autoFocus disabled={isCreateMutation} />
                    </div>
                    <div className="flex justify-end gap-3">
                        <Button type="button" variant="ghost" onClick={() => setIsCreateModalOpen(false)} disabled={isCreateMutation}>Cancelar</Button>
                        <Button type="submit" disabled={isCreateMutation || !newClassName.trim()}>
                            {isCreateMutation ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creando...</> : 'Crear aula'}
                        </Button>
                    </div>
                </form>
            </Modal>

            <Modal isOpen={!!classToEdit} onClose={() => !isEditMutation && setClassToEdit(null)} title="Editar aula">
                <form onSubmit={handleUpdateClass} className="space-y-6">
                    {mutationError && <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg" role="alert">{mutationError}</div>}
                    <div className="space-y-2">
                        <Label htmlFor="edit-class-name">Nombre del aula</Label>
                        <Input id="edit-class-name" value={editClassName} onChange={event => setEditClassName(event.target.value)} required autoFocus disabled={isEditMutation} />
                    </div>
                    <div className="flex justify-end gap-3">
                        <Button type="button" variant="ghost" onClick={() => setClassToEdit(null)} disabled={isEditMutation}>Cancelar</Button>
                        <Button type="submit" disabled={isEditMutation || !editClassName.trim()}>
                            {isEditMutation ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Guardando...</> : 'Guardar cambios'}
                        </Button>
                    </div>
                </form>
            </Modal>

            <Modal
                isOpen={!!classToToggle}
                onClose={() => !isToggleMutation && setClassToToggle(null)}
                title={classToToggle?.is_active ? 'Desactivar aula' : 'Activar aula'}
            >
                <div className="space-y-4">
                    {mutationError && <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg" role="alert">{mutationError}</div>}
                    <p className="text-gray-600">
                        ¿Quieres {classToToggle?.is_active ? 'desactivar' : 'activar'} el aula <strong>{classToToggle?.name}</strong>?
                    </p>
                    <div className="flex justify-end gap-3">
                        <Button type="button" variant="ghost" onClick={() => setClassToToggle(null)} disabled={isToggleMutation}>Cancelar</Button>
                        <Button type="button" onClick={handleToggleClass} disabled={isToggleMutation}>
                            {isToggleMutation ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Guardando...</> : classToToggle?.is_active ? 'Desactivar aula' : 'Activar aula'}
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    )
}
