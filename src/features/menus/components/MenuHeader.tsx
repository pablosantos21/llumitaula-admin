import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Utensils, ChevronLeft } from 'lucide-react'

export const MenuHeader = () => {
    const navigate = useNavigate()

    return (
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10 mb-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="sm" onClick={() => navigate('/select-school')} className="text-gray-500">
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Colegios
                </Button>
                <div className="h-6 w-px bg-gray-200" />
                <div className="flex items-center gap-2">
                    <Utensils className="h-5 w-5 text-indigo-600" />
                    <h1 className="text-lg font-bold text-gray-900">Gestión de Menús</h1>
                </div>
            </div>
        </header>
    )
}
