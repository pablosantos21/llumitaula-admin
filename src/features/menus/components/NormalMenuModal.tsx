import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Check, Save } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { School } from '@/services/schools.service'
import type { MenuGroup } from '../types'

interface NormalMenuModalProps {
    isOpen: boolean;
    onClose: () => void;
    editingGroup: MenuGroup | null;
    formData: any;
    setFormData: (data: any) => void;
    schools: School[];
    assignedSchoolIds: Set<string>;
    toggleSelection: (id: string, field: 'schoolIds' | 'allergens') => void;
    onSave: () => void;
    isSaving: boolean;
}

export const NormalMenuModal = ({
    isOpen,
    onClose,
    editingGroup,
    formData,
    setFormData,
    schools,
    assignedSchoolIds,
    toggleSelection,
    onSave,
    isSaving
}: NormalMenuModalProps) => {
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={editingGroup ? "Editar Menú Principal" : "Asignar Menú Diario"}
        >
            <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
                <div className="space-y-4">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Composición del Menú Principal</h4>
                    <div className="grid gap-4">
                        <div className="grid gap-1.5">
                            <Label htmlFor="first_course" className="text-sm font-medium">Primer Plato</Label>
                            <Input id="first_course" value={formData.first_course} onChange={e => setFormData({ ...formData, first_course: e.target.value })} />
                        </div>
                        <div className="grid gap-1.5">
                            <Label htmlFor="second_course" className="text-sm font-medium">Segundo Plato</Label>
                            <Input id="second_course" value={formData.second_course} onChange={e => setFormData({ ...formData, second_course: e.target.value })} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-1.5">
                                <Label htmlFor="side" className="text-sm font-medium">Guarnición</Label>
                                <Input id="side" value={formData.side} onChange={e => setFormData({ ...formData, side: e.target.value })} />
                            </div>
                            <div className="grid gap-1.5">
                                <Label htmlFor="salad" className="text-sm font-medium">Ensalada</Label>
                                <Input id="salad" value={formData.salad} onChange={e => setFormData({ ...formData, salad: e.target.value })} />
                            </div>
                        </div>
                        <div className="grid gap-1.5">
                            <Label htmlFor="dessert" className="text-sm font-medium">Postre</Label>
                            <Input id="dessert" value={formData.dessert} onChange={e => setFormData({ ...formData, dessert: e.target.value })} />
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Asignación de Colegios</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {schools.map(school => {
                            const isAlreadyAssigned = assignedSchoolIds.has(school.id) && !editingGroup?.schoolIds.includes(school.id);
                            const isSelected = formData.schoolIds.includes(school.id);

                            return (
                                <button
                                    key={school.id}
                                    type="button"
                                    disabled={isAlreadyAssigned}
                                    onClick={() => !isAlreadyAssigned && toggleSelection(school.id, 'schoolIds')}
                                    className={cn(
                                        "flex items-center gap-3 p-3 rounded-lg border text-left transition-all",
                                        isSelected
                                            ? "border-indigo-200 bg-indigo-50 text-indigo-700 shadow-sm"
                                            : isAlreadyAssigned
                                                ? "border-gray-100 bg-gray-50 text-gray-400 cursor-not-allowed opacity-60"
                                                : "border-gray-200 hover:border-gray-300 text-gray-600"
                                    )}
                                >
                                    <div className={cn(
                                        "h-4 w-4 rounded border flex items-center justify-center transition-all",
                                        isSelected ? "bg-indigo-600 border-indigo-600" : "border-gray-300",
                                        isAlreadyAssigned && "bg-gray-200 border-gray-200"
                                    )}>
                                        {isSelected && <Check className="h-3 w-3 text-white" />}
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-medium">{school.name}</span>
                                        {isAlreadyAssigned && (
                                            <span className="text-[10px] text-gray-400">Ya tiene un menú hoy</span>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* <div className="space-y-4">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Alérgenos e Intolerancias (Principal)</h4>
                    <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                        {ALLERGENS.map(allergen => (
                            <button
                                key={allergen.id}
                                type="button"
                                onClick={() => toggleSelection(allergen.id, 'allergens')}
                                title={allergen.name}
                                className={cn(
                                    "flex flex-col items-center justify-center p-2 rounded-lg border transition-all gap-1",
                                    formData.allergens.includes(allergen.id)
                                        ? "border-red-200 bg-red-50 text-red-700 shadow-sm"
                                        : "border-gray-100 hover:border-gray-200 grayscale opacity-60 hover:grayscale-0 hover:opacity-100"
                                )}
                            >
                                <span className="text-xl">{allergen.icon}</span>
                                <span className="text-[8px] font-bold text-center leading-tight truncate w-full">{allergen.name}</span>
                            </button>
                        ))}
                    </div>
                </div> */}

                <div className="flex gap-3 pt-4 sticky bottom-0 bg-white border-t border-gray-100 py-4 mt-4">
                    <Button variant="ghost" className="flex-1" onClick={onClose}>Cancelar</Button>
                    <Button className="flex-1 gap-2" onClick={onSave} disabled={isSaving}>
                        <Save className="h-4 w-4" />
                        {isSaving ? "Guardando..." : "Guardar Menú Normal"}
                    </Button>
                </div>
            </div>
        </Modal>
    )
}
