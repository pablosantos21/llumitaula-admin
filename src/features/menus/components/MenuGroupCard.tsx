import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Building2, Edit2, Plus, ChevronDown, ChevronRight, Users } from 'lucide-react'
import type { MenuGroup, SpecialMenuVariant } from '../types'

const DISH_FIELDS: { field: 'first_course' | 'second_course' | 'side' | 'salad' | 'dessert'; label: string }[] = [
    { field: 'first_course', label: 'Primer Plato' },
    { field: 'second_course', label: 'Segundo Plato' },
    { field: 'side', label: 'Guarnición' },
    { field: 'salad', label: 'Ensalada' },
    { field: 'dessert', label: 'Postre' },
]

interface MenuGroupCardProps {
    group: MenuGroup;
    onEditNormal: (group: MenuGroup) => void;
}

const getDish = (group: MenuGroup, field: string): string => {
    const value = (group.menu as unknown as Record<string, string | undefined>)[field]
    return value || '-'
}

export const MenuGroupCard = ({ group, onEditNormal }: MenuGroupCardProps) => {
    const navigate = useNavigate()
    const isSpecial = group.menu.type !== 'normal'

    if (isSpecial) {
        return <SpecialMenuCard group={group} />
    }

    const variants = group.variants || []

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="bg-gray-50 px-6 py-3 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Building2 className="h-4 w-4 text-primary-500 shrink-0" />
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
                    {DISH_FIELDS.map(f => (
                        <div key={f.field} className="space-y-1">
                            <span className="text-[10px] uppercase font-bold text-gray-400 block not-italic">{f.label}</span>
                            <p className="truncate font-medium text-gray-900">{getDish(group, f.field)}</p>
                        </div>
                    ))}
                </div>

                {variants.length > 0 && (
                    <SpecialVariantsSection baseId={group.menu.id} variants={variants} />
                )}

                <div className="flex items-center justify-end pt-2">
                    <Button
                        variant="primary"
                        size="sm"
                        className="h-8 shadow-sm gap-2"
                        onClick={() => navigate(`/menus/${group.menu.id}`)}
                    >
                        <Plus className="h-4 w-4" />
                        {variants.length > 0 ? 'Editar Menús Especiales' : 'Configurar Menús Especiales'}
                    </Button>
                </div>
            </div>
        </div>
    )
}

const SpecialMenuCard = ({ group }: { group: MenuGroup }) => {
    return (
        <div className="bg-white rounded-xl border border-dashed border-amber-300 shadow-sm overflow-hidden">
            <div className="bg-amber-50/60 px-6 py-3 border-b border-amber-100 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                    <Building2 className="h-4 w-4 text-amber-600 shrink-0" />
                    <Badge variant="warning" className="whitespace-nowrap">{group.menu.type}</Badge>
                    <div className="flex flex-wrap gap-1.5">
                        {group?.schools.map(s => (
                            <span key={s.id} className="bg-white px-2 py-0.5 rounded border border-gray-200 font-bold text-gray-900 shadow-sm text-xs uppercase tracking-tight">
                                {s.name}
                            </span>
                        ))}
                    </div>
                </div>
            </div>
            <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 italic text-sm text-gray-700">
                    {DISH_FIELDS.map(f => (
                        <div key={f.field} className="space-y-1">
                            <span className="text-[10px] uppercase font-bold text-gray-400 block not-italic">{f.label}</span>
                            <p className="truncate font-medium text-gray-900">{getDish(group, f.field)}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

const SpecialVariantsSection = ({ baseId, variants }: { baseId: string; variants: SpecialMenuVariant[] }) => {
    const navigate = useNavigate()
    const [expanded, setExpanded] = useState<Set<string>>(new Set())

    const toggle = (id: string) => {
        setExpanded(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    return (
        <div className="pt-2">
            <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                    Menús especiales ({variants.length})
                </p>
                <Button variant="ghost" size="sm" className="text-primary-600 gap-1" onClick={() => navigate(`/menus/${baseId}`)}>
                    <Edit2 className="h-3.5 w-3.5" />
                    Editar
                </Button>
            </div>
            <div className="space-y-2">
                {variants.map(variant => {
                    const isOpen = expanded.has(variant.id)
                    return (
                        <div key={variant.id} className="rounded-lg border border-amber-200 bg-amber-50/40 overflow-hidden">
                            <button
                                type="button"
                                onClick={() => toggle(variant.id)}
                                className="w-full flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-amber-50 transition-colors text-left"
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <Badge variant="warning" className="whitespace-nowrap">{variant.type}</Badge>
                                    <span className="flex items-center gap-1 text-xs text-gray-500 whitespace-nowrap">
                                        <Users className="h-3.5 w-3.5" />
                                        {variant.children.length} niño{variant.children.length !== 1 ? 's' : ''}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 min-w-0">
                                    {isOpen ? <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" /> : <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />}
                                </div>
                            </button>

                            {isOpen && (
                                <div className="px-4 pb-4 space-y-4">
                                    {variant.changed.length === 0 && (
                                        <p className="text-xs text-gray-400 italic">Sin cambios respecto al menú base</p>
                                    )}
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 text-sm">
                                        {DISH_FIELDS.map(f => (
                                            <div key={f.field} className="space-y-1">
                                                <span className="text-[10px] uppercase font-bold text-gray-400 block">{f.label}</span>
                                                <p className={`truncate ${variant.changed.some(c => c.field === f.field) ? 'font-semibold text-gray-900' : 'text-gray-500 italic'}`}>
                                                    {variant[f.field] || '—'}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}