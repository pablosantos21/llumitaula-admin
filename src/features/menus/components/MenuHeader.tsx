import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Utensils, ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

type MenuTab = 'menus' | 'especiales'

interface MenuHeaderProps {
    activeTab: MenuTab
    onTabChange: (tab: MenuTab) => void
}

const tabs: { id: MenuTab; label: string }[] = [
    { id: 'menus', label: 'Gestión de Menús' },
    { id: 'especiales', label: 'Menús Especiales' },
]

export const MenuHeader = ({ activeTab, onTabChange }: MenuHeaderProps) => {
    const navigate = useNavigate()

    return (
        <header className="bg-white border-b border-gray-200 px-6 pt-4 sticky top-0 z-10">
            <div className="flex items-center gap-4 pb-4">
                <Button variant="ghost" size="sm" onClick={() => navigate('/select-school')} className="text-gray-500">
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Colegios
                </Button>
                <div className="h-6 w-px bg-gray-200" />
                <div className="flex items-center gap-2">
                    <Utensils className="h-5 w-5 text-primary-600" />
                    <h1 className="text-lg font-bold text-gray-900">Gestión de Menús</h1>
                </div>
            </div>
            <div className="flex gap-1 -mb-px">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => onTabChange(tab.id)}
                        className={cn(
                            "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
                            activeTab === tab.id
                                ? "border-primary-600 text-primary-700"
                                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                        )}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>
        </header>
    )
}
