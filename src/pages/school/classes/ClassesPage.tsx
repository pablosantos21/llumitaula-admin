import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../../../contexts/AuthContext'
import { ClassService, type Class } from '../../../services/classes.service'
import { SchoolService, type School } from '../../../services/schools.service'
import { DataTable } from '../../../components/ui/data-table'
import { Modal } from '../../../components/ui/modal'
import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'
import { Label } from '../../../components/ui/label'
import { Badge } from '../../../components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card'
import { Edit2, Loader2, Plus, Power } from 'lucide-react'
import {
    CAPABILITY_OPTIONS,
    CapabilityService,
    type CapabilityKey,
    type CapabilitySetting,
    type SchoolSupervisorAssignment,
} from '../../../services/capabilities.service'

type Mutation = 'school' | 'create' | 'edit' | 'toggle' | 'capability' | 'supervisor-assignment' | null

const sortClasses = (classes: Class[]) =>
    [...classes].sort((a, b) => a.name.localeCompare(b.name))

export default function ClassesPage() {
    const { schoolId } = useParams<{ schoolId: string }>()
    const { user } = useAuth()
    const canManageClasses = user?.role === 'admin'
    const canManageSupervisorAssignments = canManageClasses
    const [school, setSchool] = useState<School | null>(null)
    const [classes, setClasses] = useState<Class[]>([])
    const [capabilitySettings, setCapabilitySettings] = useState<CapabilitySetting[]>([])
    const [supervisorAssignments, setSupervisorAssignments] = useState<SchoolSupervisorAssignment[]>([])
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
                const [schoolData, classData, capabilityData, supervisorData] = await Promise.all([
                    SchoolService.getSchoolById(schoolId),
                    ClassService.getClassesBySchool(schoolId),
                    CapabilityService.getSettings(schoolId),
                    canManageSupervisorAssignments
                        ? CapabilityService.getSchoolSupervisorAssignments(schoolId)
                        : Promise.resolve([]),
                ])
                if (isCurrent) {
                    setSchool(schoolData)
                    setClasses(sortClasses(classData))
                    setCapabilitySettings(capabilityData)
                    setSupervisorAssignments(supervisorData)
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
    }, [schoolId, canManageSupervisorAssignments])

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
            const inheritedSettings = capabilitySettings
                .filter(setting => setting.class_id === null)
                .map(setting => ({
                    ...setting,
                    class_id: createdClass.id,
                    override_value: null,
                    enabled: setting.school_value,
                }))
            setCapabilitySettings(prev => [...prev, ...inheritedSettings])
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

    const saveCapabilityChange = async (change: () => Promise<void>) => {
        if (!schoolId) return

        try {
            setMutation('capability')
            setMutationError(null)
            await change()
            const settings = await CapabilityService.getSettings(schoolId)
            setCapabilitySettings(settings)
        } catch (err) {
            console.error('Error updating school capabilities:', err)
            setMutationError('No se pudo actualizar la capacidad. Vuelve a intentarlo.')
        } finally {
            setMutation(null)
        }
    }

    const saveSupervisorAssignment = async (supervisorId: string, assigned: boolean) => {
        if (!schoolId) return

        try {
            setMutation('supervisor-assignment')
            setMutationError(null)
            await CapabilityService.setSchoolSupervisorAssignment(schoolId, supervisorId, assigned)
            setSupervisorAssignments(await CapabilityService.getSchoolSupervisorAssignments(schoolId))
        } catch (err) {
            console.error('Error updating school supervisor assignment:', err)
            setMutationError('No se pudo actualizar la asignación del supervisor. Vuelve a intentarlo.')
        } finally {
            setMutation(null)
        }
    }

    const getCapabilitySetting = (classId: string | null, capability: CapabilityKey) =>
        capabilitySettings.find(setting => setting.class_id === classId && setting.capability === capability)

    const setClassCapability = (classId: string, capability: CapabilityKey, value: boolean) =>
        saveCapabilityChange(() => CapabilityService.setClassCapability(classId, capability, value))

    const resetClassCapability = (classId: string, capability: CapabilityKey) =>
        saveCapabilityChange(() => CapabilityService.resetClassCapability(classId, capability))

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
            header: 'Capacidades del aula',
            className: 'min-w-[360px]',
            accessor: (classItem: Class) => (
                <div className="space-y-3">
                    {CAPABILITY_OPTIONS.map(option => {
                        const setting = getCapabilitySetting(classItem.id, option.key)
                        if (!setting) return null

                        const isInherited = setting.override_value === null
                        const selectedValue = isInherited
                            ? 'inherit'
                            : setting.override_value
                                ? 'enabled'
                                : 'disabled'

                        return (
                            <div key={option.key} className="rounded-md border border-gray-100 bg-gray-50 p-3">
                                <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                                    <div>
                                        <p className="font-medium text-gray-800">{option.label}</p>
                                        <p className="text-xs text-gray-500">
                                            {isInherited ? 'Heredada del colegio' : 'Configuración propia del aula'}
                                            {' · '}
                                            {setting.enabled ? 'Habilitada' : 'Deshabilitada'}
                                        </p>
                                    </div>
                                    <div className="mt-2 flex items-center gap-2 sm:mt-0">
                                        <select
                                            aria-label={`${option.label} en ${classItem.name}`}
                                            className="h-8 rounded-md border border-gray-300 bg-white px-2 text-xs text-gray-700"
                                            value={selectedValue}
                                            disabled={mutation !== null}
                                            onChange={event => {
                                                if (event.target.value === 'inherit') {
                                                    resetClassCapability(classItem.id, option.key)
                                                } else {
                                                    setClassCapability(classItem.id, option.key, event.target.value === 'enabled')
                                                }
                                            }}
                                        >
                                            <option value="inherit">Heredar colegio</option>
                                            <option value="enabled">Habilitada</option>
                                            <option value="disabled">Deshabilitada</option>
                                        </select>
                                        {!isInherited && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 px-2 text-xs"
                                                onClick={() => resetClassCapability(classItem.id, option.key)}
                                                disabled={mutation !== null}
                                            >
                                                Restablecer
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )
        },
        ...(canManageClasses ? [{
            header: 'Acciones',
            className: 'text-right',
            accessor: (classItem: Class) => (
                <div className="flex justify-end gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-primary-600 hover:bg-primary-50"
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
                        className="h-8 w-8 text-gray-500 hover:text-primary-600"
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
        }] : [])
    ]

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center p-12" role="status" aria-live="polite">
                <Loader2 className="h-8 w-8 text-primary-600 animate-spin mb-4" aria-hidden="true" />
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
    const isCapabilityMutation = mutation === 'capability'
    const isSupervisorAssignmentMutation = mutation === 'supervisor-assignment'

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold text-gray-900">{school?.name}</h1>
                        {canManageClasses && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-gray-500 hover:text-primary-600"
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
                        )}
                    </div>
                    <p className="text-sm text-gray-500">Gestiona las capacidades del colegio y los ajustes de cada aula.</p>
                </div>
                {canManageClasses && (
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
                )}
            </div>

            {mutationError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700" role="alert">
                    {mutationError}
                </div>
            )}

            {(isCapabilityMutation || isSupervisorAssignmentMutation) && (
                <div className="flex items-center gap-2 text-sm text-primary-700" role="status" aria-live="polite">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    {isCapabilityMutation ? 'Guardando cambio de capacidad...' : 'Guardando asignación de supervisor...'}
                </div>
            )}

            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Capacidades del colegio</CardTitle>
                    <CardDescription>
                        Estos valores se aplican a las aulas que heredan la configuración. Cada capacidad se guarda por separado.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    {CAPABILITY_OPTIONS.map(option => {
                        const setting = getCapabilitySetting(null, option.key)
                        if (!setting) return null

                        return (
                            <div key={option.key} className="flex flex-col gap-3 rounded-md border border-gray-100 p-4 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <p className="font-medium text-gray-900">{option.label}</p>
                                    <p className="text-sm text-gray-500">{option.description}</p>
                                    <p className="mt-1 text-xs text-gray-400">
                                        {setting.source === 'default' ? 'Valor predeterminado' : 'Configuración del colegio'}
                                    </p>
                                </div>
                                <label className="inline-flex shrink-0 items-center gap-3 font-medium text-gray-700">
                                    <input
                                        type="checkbox"
                                        className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                        checked={setting.enabled}
                                        aria-label={option.label}
                                        disabled={mutation !== null}
                                        onChange={event => {
                                            if (schoolId) {
                                                void saveCapabilityChange(() => CapabilityService.setSchoolCapability(
                                                    schoolId,
                                                    option.key,
                                                    event.target.checked,
                                                ))
                                            }
                                        }}
                                    />
                                    {setting.enabled ? 'Habilitada' : 'Deshabilitada'}
                                </label>
                            </div>
                        )
                    })}
                </CardContent>
            </Card>

            {canManageSupervisorAssignments && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Supervisores asignados</CardTitle>
                        <CardDescription>
                            Solo los supervisores asignados a este colegio pueden consultar y cambiar sus capacidades.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {supervisorAssignments.length === 0 ? (
                            <p className="text-sm text-gray-500">No hay usuarios con el rol de supervisor.</p>
                        ) : supervisorAssignments.map(supervisor => {
                            const name = supervisor.full_name || `Supervisor ${supervisor.supervisor_id.slice(0, 8)}`

                            return (
                                <label
                                    key={supervisor.supervisor_id}
                                    className="flex flex-col gap-2 rounded-md border border-gray-100 p-4 sm:flex-row sm:items-center sm:justify-between"
                                >
                                    <span>
                                        <span className="block font-medium text-gray-900">{name}</span>
                                        <span className="block text-sm text-gray-500">
                                            {supervisor.assigned ? 'Asignado a este colegio' : 'Sin asignar'}
                                            {!supervisor.active && ' · Usuario inactivo'}
                                        </span>
                                    </span>
                                    <span className="inline-flex items-center gap-3 text-sm font-medium text-gray-700">
                                        <input
                                            type="checkbox"
                                            className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                            checked={supervisor.assigned}
                                            aria-label={supervisor.assigned
                                                ? `Revocar la asignación de ${name} para este colegio`
                                                : `Asignar ${name} a este colegio`}
                                            disabled={mutation !== null || (!supervisor.active && !supervisor.assigned)}
                                            onChange={event => {
                                                void saveSupervisorAssignment(supervisor.supervisor_id, event.target.checked)
                                            }}
                                        />
                                        {supervisor.assigned ? 'Asignado' : 'Asignar'}
                                    </span>
                                </label>
                            )
                        })}
                    </CardContent>
                </Card>
            )}

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
