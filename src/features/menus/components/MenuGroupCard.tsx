import { Button } from '@/components/ui/button'
import { Building2, Edit2, Plus } from 'lucide-react'
import type { MenuGroup } from '../types'

interface MenuGroupCardProps {
    group: MenuGroup;
    onEditNormal: (group: MenuGroup) => void;
    onEditSpecial: (group: MenuGroup) => void;
}

export const MenuGroupCard = ({ group, onEditNormal, onEditSpecial }: MenuGroupCardProps) => {
    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="bg-gray-50 px-6 py-3 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Building2 className="h-4 w-4 text-indigo-500 shrink-0" />
                    <div className="flex flex-wrap gap-1.5">
                        {group?.schools.map(s => (
                            <span key={s.id} className="bg-white px-2 py-0.5 rounded border border-gray-200 font-bold text-gray-900 shadow-sm text-xs uppercase tracking-tight">
                                {s.name}
                            </span>
                        ))}
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-gray-400"
                        onClick={() => onEditNormal(group)}
                    >
                        <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </div>
            <div className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 py-4 border-b border-gray-100 italic text-sm text-gray-700">
                    <div className="space-y-1">
                        <span className="text-[10px] uppercase font-bold text-gray-400 block not-italic">Primer Plato</span>
                        <p className="truncate font-medium text-gray-900">{group?.menu?.first_course || '-'}</p>
                    </div>
                    <div className="space-y-1">
                        <span className="text-[10px] uppercase font-bold text-gray-400 block not-italic">Segundo Plato</span>
                        <p className="truncate font-medium text-gray-900">{group?.menu?.second_course || '-'}</p>
                    </div>
                    <div className="space-y-1">
                        <span className="text-[10px] uppercase font-bold text-gray-400 block not-italic">Guarnición</span>
                        <p className="truncate text-gray-600">{group?.menu?.side || '-'}</p>
                    </div>
                    <div className="space-y-1">
                        <span className="text-[10px] uppercase font-bold text-gray-400 block not-italic">Ensalada</span>
                        <p className="truncate text-gray-600">{group?.menu?.salad || '-'}</p>
                    </div>
                    <div className="space-y-1">
                        <span className="text-[10px] uppercase font-bold text-gray-400 block not-italic">Postre</span>
                        <p className="truncate font-medium text-gray-900">{group?.menu?.dessert || '-'}</p>
                    </div>
                </div>

                <div className="flex items-center justify-end pt-2">
                    <Button
                        variant="primary"
                        size="sm"
                        className="h-8 shadow-sm gap-2"
                        onClick={() => onEditSpecial(group)}
                    >
                        <Plus className="h-4 w-4" />
                        Configurar Menús Especiales
                    </Button>
                </div>
            </div>
        </div>
    )
}
