import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { Button } from '../../components/ui/button'
import { Card, CardContent, CardFooter } from '../../components/ui/card'
import { MOCK_SCHOOLS } from '../../mocks/schools'
import { LogOut, School as SchoolIcon, MapPin } from 'lucide-react'

export default function SelectSchoolPage() {
    const { user, logout } = useAuth()
    const navigate = useNavigate()

    const handleSchoolSelect = (schoolId: string) => {
        navigate(`/school/${schoolId}/menus`)
    }

    const handleLogout = async () => {
        await logout()
        navigate('/login')
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center gap-2">
                    <SchoolIcon className="h-6 w-6 text-indigo-600" />
                    <h1 className="text-xl font-bold text-gray-900">Catering Admin</h1>
                </div>
                <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-600">Hola, {user?.name}</span>
                    <Button variant="ghost" size="sm" onClick={handleLogout} className="text-gray-500">
                        <LogOut className="h-4 w-4 mr-2" />
                        Salir
                    </Button>
                </div>
            </header>

            <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
                <div className="mb-8 text-center">
                    <h2 className="text-3xl font-bold text-gray-900 mb-2">Selecciona un colegio</h2>
                    <p className="text-gray-500">Elige el colegio que quieres gestionar hoy</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {MOCK_SCHOOLS.map((school) => (
                        <Card
                            key={school.id}
                            className="cursor-pointer hover:shadow-md transition-shadow group overflow-hidden border-transparent ring-1 ring-gray-200 hover:ring-indigo-500"
                            onClick={() => handleSchoolSelect(school.id)}
                        >
                            <div className="h-40 overflow-hidden bg-gray-200 relative">
                                <img
                                    src={school.image}
                                    alt={school.name}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-4">
                                    <h3 className="text-white font-bold text-lg">{school.name}</h3>
                                </div>
                            </div>
                            <CardContent className="pt-4">
                                <div className="flex items-center text-gray-500 text-sm">
                                    <MapPin className="h-4 w-4 mr-1.5" />
                                    {school.location}
                                </div>
                            </CardContent>
                            <CardFooter className="pt-0">
                                <Button variant="secondary" className="w-full group-hover:bg-indigo-50 group-hover:text-indigo-700 group-hover:border-indigo-200">
                                    Acceder al panel
                                </Button>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            </main>
        </div>
    )
}
