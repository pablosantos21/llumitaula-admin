import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { MonitorService, type Monitor } from '../../../services/monitors.service'
import { DataTable } from '../../../components/ui/data-table'
import { Button } from '../../../components/ui/button'
import { Plus, Edit2, UserMinus, Loader2 } from 'lucide-react'
import { Modal } from '../../../components/ui/modal'
import { Input } from '../../../components/ui/input'
import { Label } from '../../../components/ui/label'

export default function MonitorsPage() {
    const { schoolId } = useParams<{ schoolId: string }>()
    const [monitors, setMonitors] = useState<Monitor[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [newFirstName, setNewFirstName] = useState('')
    const [newLastName, setNewLastName] = useState('')
    const [newCode, setNewCode] = useState('')

    // Delete modal state
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
    const [monitorToDelete, setMonitorToDelete] = useState<Monitor | null>(null)
    const [isDeleting, setIsDeleting] = useState(false)

    // Edit modal state
    const [isEditModalOpen, setIsEditModalOpen] = useState(false)
    const [monitorToEdit, setMonitorToEdit] = useState<Monitor | null>(null)
    const [editFirstName, setEditFirstName] = useState('')
    const [editLastName, setEditLastName] = useState('')
    const [editCode, setEditCode] = useState('')

    useEffect(() => {
        const fetchMonitors = async () => {
            if (!schoolId) return

            try {
                setIsLoading(true)
                const data = await MonitorService.getMonitorsBySchool(schoolId)
                setMonitors(data)
            } catch (err) {
                console.error('Error loading monitors:', err)
                setError('No se pudieron cargar los monitores')
            } finally {
                setIsLoading(false)
            }
        }

        fetchMonitors()
    }, [schoolId])

    const handleCreateMonitor = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!schoolId || !newFirstName.trim() || !newLastName.trim() || !newCode.trim()) return

        try {
            setIsSubmitting(true)
            const newMonitor = await MonitorService.createMonitor(
                {
                    first_name: newFirstName,
                    last_name: newLastName,
                    code: newCode
                },
                schoolId
            )
            setMonitors(prev => [...prev, newMonitor].sort((a, b) => a.first_name.localeCompare(b.first_name)))
            setIsModalOpen(false)
            setNewFirstName('')
            setNewLastName('')
            setNewCode('')
        } catch (err) {
            console.error('Error creating monitor:', err)
            // Error handling could be improved with a toast
        } finally {
            setIsSubmitting(false)
        }
    }

    const confirmDelete = (monitor: Monitor) => {
        setMonitorToDelete(monitor)
        setIsDeleteModalOpen(true)
    }

    const handleDeleteMonitor = async () => {
        if (!monitorToDelete) return

        try {
            setIsDeleting(true)
            await MonitorService.deleteMonitor(monitorToDelete.id)
            setMonitors(prev => prev.filter(m => m.id !== monitorToDelete.id))
            setIsDeleteModalOpen(false)
            setMonitorToDelete(null)
        } catch (err) {
            console.error('Error deleting monitor:', err)
        } finally {
            setIsDeleting(false)
        }
    }

    const startEdit = (monitor: Monitor) => {
        console.log(monitor)
        setMonitorToEdit(monitor)
        setEditFirstName(monitor.first_name)
        setEditLastName(monitor.last_name)
        setEditCode(String(monitor.code))
        setIsEditModalOpen(true)
    }

    const handleUpdateMonitor = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!monitorToEdit || !editFirstName.trim() || !editLastName.trim() || !editCode.trim()) return

        try {
            setIsSubmitting(true)
            const updatedMonitor = await MonitorService.updateMonitor(monitorToEdit.id, {
                first_name: editFirstName,
                last_name: editLastName,
                code: editCode
            })
            setMonitors(prev => prev.map(m => m.id === updatedMonitor.id ? updatedMonitor : m).sort((a, b) => a.first_name.localeCompare(b.first_name)))
            setIsEditModalOpen(false)
            setMonitorToEdit(null)
        } catch (err) {
            console.error('Error updating monitor:', err)
        } finally {
            setIsSubmitting(false)
        }
    }

    const columns = [
        {
            header: 'Monitor',
            accessor: (monitor: Monitor) => (
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold border border-indigo-100">
                        {monitor.first_name.charAt(0)}
                    </div>
                    <div>
                        <div className="font-semibold text-gray-900">{monitor.first_name} {monitor.last_name}</div>
                        <div className="text-xs text-gray-500">Añadido el {new Date(monitor.created_at).toLocaleDateString()}</div>
                    </div>
                </div>
            )
        },
        {
            header: 'Código Acceso',
            accessor: (monitor: Monitor) => (
                <code className="px-2 py-1 bg-gray-100 rounded text-sm font-mono text-indigo-600">
                    {monitor.code}
                </code>
            )
        },
        {
            header: 'Acciones',
            className: 'text-right',
            accessor: (_monitor: Monitor) => (
                <div className="flex justify-end gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="Editar"
                        onClick={() => startEdit(_monitor)}
                    >
                        <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                        title="Eliminar"
                        onClick={() => confirmDelete(_monitor)}
                    >
                        <UserMinus className="h-4 w-4" />
                    </Button>
                </div>
            )
        }
    ]

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center p-12">
                <Loader2 className="h-8 w-8 text-indigo-600 animate-spin mb-4" />
                <p className="text-gray-500">Cargando monitores...</p>
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
                    <h1 className="text-2xl font-bold text-gray-900">Personal: Monitores</h1>
                    <p className="text-sm text-gray-500">Gestión de monitores y sus códigos de acceso al comedor.</p>
                </div>
                <Button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Nuevo Monitor
                </Button>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                <DataTable columns={columns} data={monitors} />
                {monitors.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                        No hay monitores registrados para este colegio.
                    </div>
                )}
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title="Añadir nuevo monitor"
            >
                <form onSubmit={handleCreateMonitor} className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="first-name">Nombre</Label>
                            <Input
                                id="first-name"
                                value={newFirstName}
                                onChange={(e) => setNewFirstName(e.target.value)}
                                placeholder="Ej. Ana"
                                required
                                autoFocus
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="last-name">Apellidos</Label>
                            <Input
                                id="last-name"
                                value={newLastName}
                                onChange={(e) => setNewLastName(e.target.value)}
                                placeholder="Ej. García López"
                                required
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="code">Código de Acceso</Label>
                        <Input
                            id="code"
                            value={newCode}
                            onChange={(e) => setNewCode(e.target.value)}
                            placeholder="Ej. 1234"
                            required
                        />
                        <p className="text-xs text-gray-500">Este código será el que use el monitor para entrar a su panel.</p>
                    </div>
                    <div className="flex justify-end gap-3 mt-8">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setIsModalOpen(false)}
                            disabled={isSubmitting}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            disabled={isSubmitting || !newFirstName.trim() || !newLastName.trim() || !newCode.trim()}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Creando...
                                </>
                            ) : (
                                'Crear monitor'
                            )}
                        </Button>
                    </div>
                </form>
            </Modal>

            <Modal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                title="Eliminar monitor"
            >
                <div className="space-y-4">
                    <p className="text-gray-600">
                        ¿Estás seguro de que quieres eliminar al monitor <strong>{monitorToDelete?.first_name} {monitorToDelete?.last_name}</strong>?
                        Esta acción no se puede deshacer.
                    </p>
                    <div className="flex justify-end gap-3 mt-8">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setIsDeleteModalOpen(false)}
                            disabled={isDeleting}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="button"
                            variant="danger"
                            onClick={handleDeleteMonitor}
                            disabled={isDeleting}
                        >
                            {isDeleting ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Eliminando...
                                </>
                            ) : (
                                'Eliminar monitor'
                            )}
                        </Button>
                    </div>
                </div>
            </Modal>

            <Modal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                title="Editar monitor"
            >
                <form onSubmit={handleUpdateMonitor} className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="edit-first-name">Nombre</Label>
                            <Input
                                id="edit-first-name"
                                value={editFirstName}
                                onChange={(e) => setEditFirstName(e.target.value)}
                                placeholder="Ej. Ana"
                                required
                                autoFocus
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-last-name">Apellidos</Label>
                            <Input
                                id="edit-last-name"
                                value={editLastName}
                                onChange={(e) => setEditLastName(e.target.value)}
                                placeholder="Ej. García López"
                                required
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="edit-code">Código de Acceso</Label>
                        <Input
                            id="edit-code"
                            value={editCode}
                            onChange={(e) => setEditCode(e.target.value)}
                            placeholder="Ej. 1234"
                            required
                        />
                        <p className="text-xs text-gray-500">Este código será el que use el monitor para entrar a su panel.</p>
                    </div>
                    <div className="flex justify-end gap-3 mt-8">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setIsEditModalOpen(false)}
                            disabled={isSubmitting}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            disabled={isSubmitting || !editFirstName.trim() || !editLastName.trim() || !editCode.trim()}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Guardando...
                                </>
                            ) : (
                                'Guardar cambios'
                            )}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    )
}
