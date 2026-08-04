import { useParams, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { useSpecialMenu } from '@/features/menus/hooks/useSpecialMenu'
import { ArrowLeft, Utensils, Save, Loader2 } from 'lucide-react'

export default function SpecialMenuPage() {
    const { menuId } = useParams<{ menuId: string }>()
    const navigate = useNavigate()

    const {
        menu,
        schools,
        date,
        allergenGroups,
        matrixData,
        isLoading,
        isSaving,
        updateMatrixField,
        handleSave,
        fields
    } = useSpecialMenu(menuId!)

    const handleSaveClick = async () => {
        try {
            await handleSave()
            navigate('/menus')
        } catch {
            alert('Error al guardar los menús especiales')
        }
    }

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-10 w-10 text-indigo-500 animate-spin" />
                    <p className="text-gray-500 font-medium">Cargando menús especiales...</p>
                </div>
            </div>
        )
    }

    if (!menu) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center space-y-4">
                    <Utensils className="h-12 w-12 text-gray-300 mx-auto" />
                    <p className="text-gray-500 font-medium">Menú no encontrado</p>
                    <Button variant="outline" onClick={() => navigate('/menus')}>
                        Volver a Menús
                    </Button>
                </div>
            </div>
        )
    }

    const formattedDate = date
        ? new Date(date + 'T00:00:00').toLocaleDateString('es-ES', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
        })
        : ''

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto w-full">
                    <div className="flex items-center gap-3 mb-3">
                        <Button variant="ghost" size="sm" onClick={() => navigate('/menus')} className="text-gray-500">
                            <ArrowLeft className="h-4 w-4 mr-1" />
                            Menús
                        </Button>
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">Menús Especiales</h1>
                        <p className="text-sm text-gray-500">
                            {formattedDate} — {schools.map(s => s.name).join(', ')}
                        </p>
                    </div>
                </div>
            </header>

            <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
                {allergenGroups.length === 0 ? (
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
                        <Utensils className="h-12 w-12 text-gray-200 mx-auto mb-4" />
                        <p className="text-gray-500 font-medium">
                            No hay niños con alérgenos en estos colegios
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex items-center gap-6">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-gray-400 uppercase">Niños con alérgenos:</span>
                                <Badge variant="info">
                                    {allergenGroups.reduce((sum, g) => sum + g.count, 0)}
                                </Badge>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-gray-400 uppercase">Agrupaciones:</span>
                                <Badge variant="warning">
                                    {allergenGroups.length}
                                </Badge>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
                            <div className="min-w-[800px]">
                                <table className="w-full border-collapse">
                                    <thead>
                                        <tr>
                                            <th className="p-3 border-b text-left bg-gray-50 text-xs font-bold text-gray-400 uppercase tracking-wider sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                                                Plato
                                            </th>
                                            <th className="p-3 border-b text-center bg-indigo-50 text-xs font-bold text-indigo-600 uppercase tracking-wider">
                                                Menú Base
                                            </th>
                                            {allergenGroups.map(group => (
                                                <th key={group.name} className="p-3 border-b text-center bg-gray-50 text-xs font-bold text-gray-600 uppercase tracking-wider">
                                                    <Badge variant="warning" className="mb-1 whitespace-nowrap">
                                                        {group.name}
                                                    </Badge>
                                                    <span className="block text-[10px] text-gray-400 font-normal">
                                                        {group.count} niño{group.count !== 1 ? 's' : ''}
                                                    </span>
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {fields.map(row => (
                                            <tr key={row.field} className="hover:bg-gray-50 transition-colors">
                                                <td className="p-3 border-b text-sm font-bold text-gray-700 bg-white sticky left-0 z-10 w-40 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] whitespace-nowrap">
                                                    {row.label}
                                                </td>
                                                <td className="p-3 border-b text-sm text-gray-400 italic bg-indigo-50/30 text-center">
                                                    {menu[row.field] || '-'}
                                                </td>
                                                {allergenGroups.map(group => (
                                                    <td key={group.name} className="p-2 border-b min-w-[220px]">
                                                        <Input
                                                            value={matrixData[group.name]?.[row.field] || ''}
                                                            onChange={e => updateMatrixField(group.name, row.field, e.target.value)}
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
                        </div>

                        <div className="flex gap-3 pt-2">
                            <Button variant="outline" className="flex-1" onClick={() => navigate('/menus')}>
                                Cancelar
                            </Button>
                            <Button className="flex-1 gap-2 shadow-lg shadow-indigo-100" onClick={handleSaveClick} disabled={isSaving}>
                                <Save className="h-4 w-4" />
                                {isSaving ? 'Guardando...' : 'Guardar Menús Especiales'}
                            </Button>
                        </div>
                    </>
                )}
            </main>
        </div>
    )
}
