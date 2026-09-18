import { Button } from '@/components/ui/button'
import { Utensils, Loader2, Info, Plus } from 'lucide-react'
import { MenuGroupCard } from './MenuGroupCard'
import type { MenuGroup } from '../types'

interface DailyProgrammingProps {
    selectedDate: Date | null;
    isLoading: boolean;
    groupedMenus: MenuGroup[];
    unassignedSchoolsCount: number;
    openNormalMenuModal: (group?: MenuGroup) => void;
}

export const DailyProgramming = ({
    selectedDate,
    isLoading,
    groupedMenus,
    unassignedSchoolsCount,
    openNormalMenuModal
}: DailyProgrammingProps) => {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between bg-white px-6 py-4 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="bg-primary-100 p-2 rounded-lg">
                        <Utensils className="h-5 w-5 text-primary-600" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-gray-900">Programación del día</h2>
                        <p className="text-sm text-gray-500">
                            {selectedDate
                                ? selectedDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
                                : "Selecciona un día"
                            }
                        </p>
                    </div>
                </div>
                {isLoading && <Loader2 className="h-5 w-5 text-primary-500 animate-spin" />}
            </div>

            {selectedDate ? (
                <div className="space-y-4">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-gray-100">
                            <Loader2 className="h-10 w-10 text-primary-200 animate-spin mb-4" />
                            <p className="text-gray-400 font-medium">Cargando menús...</p>
                        </div>
                    ) : (
                        <>
                            {groupedMenus.length > 0 ? (
                                groupedMenus.map((group, idx) => (
                                    <MenuGroupCard
                                        key={idx}
                                        group={group}
                                        onEditNormal={openNormalMenuModal}
                                    />
                                ))
                            ) : (
                                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
                                    <Utensils className="h-12 w-12 text-gray-100 mx-auto mb-4" />
                                    <p className="text-gray-500 font-medium">No hay menús registrados para este día</p>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="mt-4"
                                        onClick={() => openNormalMenuModal()}
                                    >
                                        <Plus className="h-4 w-4 mr-2" />
                                        Asignar Menú Principal
                                    </Button>
                                </div>
                            )}
                        </>
                    )}

                    {groupedMenus.length > 0 && unassignedSchoolsCount > 0 && (
                        <div className="flex justify-center pt-2">
                            <Button
                                variant="outline"
                                size="sm"
                                className="w-full py-6 border-dashed border-2 hover:border-primary-300 hover:bg-primary-50/30 text-primary-600 transition-all gap-2"
                                onClick={() => openNormalMenuModal()}
                            >
                                <Plus className="h-4 w-4" />
                                Asignar Menú a Colegios Restantes ({unassignedSchoolsCount})
                            </Button>
                        </div>
                    )}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-20 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                    <Info className="h-10 w-10 text-gray-300 mb-4" />
                    <p className="text-gray-500 font-medium">Selecciona un día en el calendario</p>
                </div>
            )}
        </div>
    )
}
