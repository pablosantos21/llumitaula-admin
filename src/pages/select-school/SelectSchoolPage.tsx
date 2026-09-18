import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { Button } from '../../components/ui/button'
import { Card, CardContent } from '../../components/ui/card'
import { SchoolService, type School } from '../../services/schools.service'
import { LogOut, School as SchoolIcon, Utensils, Loader2, Plus, Trash2, AlertTriangle } from 'lucide-react'
import { Modal } from '../../components/ui/modal'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'

export default function SelectSchoolPage() {
    const { user, logout } = useAuth()

    const navigate = useNavigate()
    const [schools, setSchools] = useState<School[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [newSchoolName, setNewSchoolName] = useState('')
    const [isCreating, setIsCreating] = useState(false)
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
    const [schoolToDelete, setSchoolToDelete] = useState<School | null>(null)
    const [isDeleting, setIsDeleting] = useState(false)

    useEffect(() => {
        const fetchSchools = async () => {
            try {
                const data = await SchoolService.getAllSchools()
                setSchools(data)
            } catch (err) {
                console.error('Error fetching schools:', err)
                setError('No se pudieron cargar los colegios')
            } finally {
                setIsLoading(false)
            }
        }

        fetchSchools()
    }, [])

    const handleSchoolSelect = (schoolId: string) => {
        navigate(`/school/${schoolId}`)
    }

    const handleLogout = async () => {
        await logout()
        navigate('/login')
    }

    const handleCreateSchool = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newSchoolName.trim()) return

        setIsCreating(true)
        try {
            const newSchool = await SchoolService.createSchool(newSchoolName)
            setSchools(prev => [...prev, newSchool])
            setIsModalOpen(false)
            setNewSchoolName('')
        } catch (err) {
            console.error('Error creating school:', err)
        } finally {
            setIsCreating(false)
        }
    }

    const confirmDelete = (e: React.MouseEvent, school: School) => {
        e.stopPropagation()
        setSchoolToDelete(school)
        setIsDeleteModalOpen(true)
    }

    const handleDeleteSchool = async () => {
        if (!schoolToDelete) return

        setIsDeleting(true)
        try {
            await SchoolService.deleteSchool(schoolToDelete.id)
            setSchools(prev => prev.filter(s => s.id !== schoolToDelete.id))
            setIsDeleteModalOpen(false)
            setSchoolToDelete(null)
        } catch (err) {
            console.error('Error deleting school:', err)
        } finally {
            setIsDeleting(false)
        }
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                        <SchoolIcon className="h-6 w-6 text-primary-600" />
                        <h1 className="text-xl font-bold text-gray-900">Catering Admin</h1>
                    </div>
                    <div className="h-6 w-px bg-gray-200" />
                    <Button variant="ghost" size="sm" onClick={() => navigate('/menus')} className="text-gray-600 hover:text-primary-600 hover:bg-primary-50">
                        <Utensils className="h-4 w-4 mr-2" />
                        Gestionar Menús
                    </Button>
                </div>
                <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-600">Hola, {user?.name}</span>
                    <Button variant="ghost" size="sm" onClick={handleLogout} className="text-gray-500">
                        <LogOut className="h-4 w-4 mr-2" />
                        Salir
                    </Button>
                </div>
            </header>

            <main className="flex-1 p-6 max-w-4xl mx-auto w-full">
                <div className="mb-8 text-center">
                    <h2 className="text-3xl font-bold text-gray-900 mb-2">Selecciona un colegio</h2>
                    <p className="text-gray-500">Elige el colegio que quieres gestionar hoy</p>
                </div>

                {isLoading ? (
                    <div className="flex flex-col items-center justify-center p-12">
                        <Loader2 className="h-8 w-8 text-primary-600 animate-spin mb-4" />
                        <p className="text-gray-500">Cargando colegios...</p>
                    </div>
                ) : error ? (
                    <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg text-center">
                        {error}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4">
                        {schools.map((school) => (
                            <Card
                                key={school.id}
                                className="cursor-pointer hover:shadow-sm transition-all group border-gray-200 hover:border-primary-500 hover:bg-primary-50/30"
                                onClick={() => handleSchoolSelect(school.id)}
                            >
                                <CardContent className="p-6 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center text-primary-600 group-hover:bg-primary-600 group-hover:text-white transition-colors">
                                            <SchoolIcon className="h-6 w-6" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-lg text-gray-900">{school.name}</h3>
                                            <p className="text-sm text-gray-500">Haz clic para acceder al panel</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-600 hover:bg-red-50"
                                            onClick={(e) => confirmDelete(e, school)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" className="opacity-0 group-hover:opacity-100 transition-opacity text-primary-600">
                                            Seleccionar
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}

                        {schools.length === 0 && (
                            <div className="text-center p-12 bg-white rounded-lg border border-dashed border-gray-300">
                                <p className="text-gray-500">No se encontraron colegios.</p>
                            </div>
                        )}

                        <Button
                            variant="outline"
                            className="p-8 border-dashed border-2 hover:border-primary-500 hover:bg-primary-50/30 flex flex-col h-auto gap-2"
                            onClick={() => setIsModalOpen(true)}
                        >
                            <Plus className="h-6 w-6 text-primary-600" />
                            <span className="font-semibold text-gray-900">Añadir nuevo colegio</span>
                        </Button>
                    </div>
                )}

                <Modal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    title="Añadir nuevo colegio"
                >
                    <form onSubmit={handleCreateSchool} className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="school-name">Nombre del colegio</Label>
                            <Input
                                id="school-name"
                                value={newSchoolName}
                                onChange={(e) => setNewSchoolName(e.target.value)}
                                placeholder="Ej. Colegio San José"
                                required
                                autoFocus
                            />
                        </div>
                        <div className="flex justify-end gap-3 mt-8">
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => setIsModalOpen(false)}
                                disabled={isCreating}
                            >
                                Cancelar
                            </Button>
                            <Button
                                type="submit"
                                disabled={isCreating || !newSchoolName.trim()}
                                className="bg-primary-600 hover:bg-primary-700 text-white"
                            >
                                {isCreating ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Creando...
                                    </>
                                ) : (
                                    'Crear colegio'
                                )}
                            </Button>
                        </div>
                    </form>
                </Modal>

                <Modal
                    isOpen={isDeleteModalOpen}
                    onClose={() => setIsDeleteModalOpen(false)}
                    title="Eliminar colegio"
                >
                    <div className="space-y-4">
                        <div className="flex items-center gap-3 text-amber-600 bg-amber-50 p-4 rounded-lg border border-amber-100">
                            <AlertTriangle className="h-5 w-5 shrink-0" />
                            <p className="text-sm font-medium">
                                Esta acción no se puede deshacer. Se eliminarán todos los datos asociados al colegio <strong>{schoolToDelete?.name}</strong>.
                            </p>
                        </div>
                        <p className="text-gray-600">
                            ¿Estás seguro de que quieres eliminar este colegio?
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
                                onClick={handleDeleteSchool}
                                disabled={isDeleting}
                            >
                                {isDeleting ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Eliminando...
                                    </>
                                ) : (
                                    'Eliminar colegio'
                                )}
                            </Button>
                        </div>
                    </div>
                </Modal>
            </main>
        </div>
    )
}
