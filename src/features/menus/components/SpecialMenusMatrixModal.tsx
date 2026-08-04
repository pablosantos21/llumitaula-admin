import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Save } from 'lucide-react'
import type { MenuType } from '@/mocks/menus'

interface SpecialMenusMatrixModalProps {
    isOpen: boolean;
    onClose: () => void;
    matrixData: Record<string, any>;
    updateMatrixField: (type: string, field: string, value: string) => void;
    onSave: () => void;
    isSaving: boolean;
}

const getTypeBadgeVariant = (type: MenuType) => {
    switch (type) {
        case 'normal': return 'info'
        case 'sin-gluten': return 'warning'
        case 'vegetariano': return 'success'
        case 'halal': return 'default'
        case 'sin-lactosa': return 'warning'
        case 'sin-plv': return 'warning'
        case 'sin-huevo': return 'warning'
        case 'sin-pescado': return 'warning'
        default: return 'default'
    }
}

export const SpecialMenusMatrixModal = ({
    isOpen,
    onClose,
    matrixData,
    updateMatrixField,
    onSave,
    isSaving
}: SpecialMenusMatrixModalProps) => {
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Configuración de Menús Especiales"
            size="full"
        >
            <div className="space-y-6 max-w-full overflow-x-auto pb-4">
                <div className="min-w-[1200px]">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr>
                                <th className="p-3 border-b text-left bg-gray-50 text-xs font-bold text-gray-400 uppercase tracking-wider sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                                    Componente
                                </th>
                                {Object.keys(matrixData).map(type => (
                                    <th key={type} className="p-3 border-b text-center bg-gray-50 text-xs font-bold text-gray-600 uppercase tracking-wider">
                                        <Badge variant={getTypeBadgeVariant(type as MenuType)} className="mb-1 whitespace-nowrap">
                                            {type.replace(/-/g, ' ')}
                                        </Badge>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {[
                                { label: 'Primer Plato', field: 'first_course' },
                                { label: 'Segundo Plato', field: 'second_course' },
                                { label: 'Guarnición', field: 'side' },
                                { label: 'Ensalada', field: 'salad' },
                                { label: 'Postre', field: 'dessert' }
                            ].map(row => (
                                <tr key={row.field} className="hover:bg-gray-50 transition-colors">
                                    <td className="p-3 border-b text-sm font-bold text-gray-700 bg-white sticky left-0 z-10 w-40 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] whitespace-nowrap">
                                        {row.label}
                                    </td>
                                    {Object.keys(matrixData).map(type => (
                                        <td key={type} className="p-2 border-b min-w-[220px]">
                                            <Input
                                                value={matrixData[type]?.[row.field] || ''}
                                                onChange={e => updateMatrixField(type, row.field, e.target.value)}
                                                className="h-9 text-xs focus:bg-white bg-gray-50/50 border-gray-100"
                                                placeholder={`Escribir ${row.label.toLowerCase()}...`}
                                            />
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="flex gap-3 pt-6 border-t border-gray-100">
                    <Button variant="ghost" className="flex-1" onClick={onClose}>
                        Descartar
                    </Button>
                    <Button className="flex-1 gap-2 shadow-lg shadow-indigo-100" onClick={onSave} disabled={isSaving}>
                        <Save className="h-4 w-4" />
                        {isSaving ? "Guardando..." : "Guardar Todas las Variantes"}
                    </Button>
                </div>
            </div>
        </Modal>
    )
}
