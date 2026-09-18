import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { AllergenService, type Allergen } from '@/services/allergens.service';
import { ChildService, type ChildWithSchool } from '@/services/children.service';

interface ChildAllergensModalProps {
    child: ChildWithSchool | null;
    isOpen: boolean;
    onClose: () => void;
    onSaved: () => void;
}

export const ChildAllergensModal = ({ child, isOpen, onClose, onSaved }: ChildAllergensModalProps) => {
    if (!isOpen || !child) return null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Editar alérgenos de ${child.first_name} ${child.last_name}`}
            size="md"
        >
            <ChildAllergensForm key={child.id} child={child} onClose={onClose} onSaved={onSaved} />
        </Modal>
    );
};

const ChildAllergensForm = ({ child, onClose, onSaved }: Omit<ChildAllergensModalProps, 'isOpen'> & { child: ChildWithSchool }) => {
    const [allergens, setAllergens] = useState<Allergen[]>([]);
    const [selectedAllergens, setSelectedAllergens] = useState<string[]>(
        child.child_allergens?.map(a => a.allergen_id) || []
    );
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        AllergenService.getAll()
            .then(setAllergens)
            .catch(err => {
                console.error(err);
                setError('No se pudieron cargar los alérgenos');
            })
            .finally(() => setIsLoading(false));
    }, []);

    const toggleAllergen = (allergenId: string) => {
        setSelectedAllergens(prev =>
            prev.includes(allergenId)
                ? prev.filter(id => id !== allergenId)
                : [...prev, allergenId]
        );
    };

    const handleSave = async () => {
        try {
            setIsSaving(true);
            setError(null);
            await ChildService.setChildAllergens(child.id, selectedAllergens);
            onSaved();
            onClose();
        } catch (err) {
            console.error(err);
            setError('No se pudieron guardar los alérgenos');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg text-center">
                    {error}
                </div>
            )}

            <div className="space-y-2">
                {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
                    </div>
                ) : allergens.length === 0 ? (
                    <p className="text-sm text-gray-400">No hay alérgenos registrados</p>
                ) : (
                    <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-2 border border-gray-200 rounded-md">
                        {allergens.map(allergen => (
                            <label
                                key={allergen.id}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer border transition-colors ${
                                    selectedAllergens.includes(allergen.id)
                                        ? 'bg-amber-100 text-amber-800 border-amber-300'
                                        : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                                }`}
                            >
                                <input
                                    type="checkbox"
                                    checked={selectedAllergens.includes(allergen.id)}
                                    onChange={() => toggleAllergen(allergen.id)}
                                    className="sr-only"
                                />
                                {allergen.name}
                            </label>
                        ))}
                    </div>
                )}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <Button type="button" variant="ghost" onClick={onClose} disabled={isSaving}>
                    Cancelar
                </Button>
                <Button onClick={handleSave} disabled={isSaving || isLoading}>
                    {isSaving ? 'Guardando...' : 'Guardar cambios'}
                </Button>
            </div>
        </div>
    );
};
