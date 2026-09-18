import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { AllergenService, type Allergen } from '@/services/allergens.service';

export const AllergensManager = () => {
    const [allergens, setAllergens] = useState<Allergen[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingAllergen, setEditingAllergen] = useState<Allergen | null>(null);
    const [name, setName] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');

    const fetchAllergens = async () => {
        try {
            setIsLoading(true);
            const data = await AllergenService.getAll();
            setAllergens(data);
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchAllergens();
    }, []);

    const openAddModal = () => {
        setEditingAllergen(null);
        setName('');
        setError('');
        setIsModalOpen(true);
    };

    const openEditModal = (allergen: Allergen) => {
        setEditingAllergen(allergen);
        setName(allergen.name);
        setError('');
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        const trimmed = name.trim();
        if (!trimmed) {
            setError('El nombre no puede estar vacío');
            return;
        }

        try {
            setIsSaving(true);
            setError('');
            if (editingAllergen) {
                await AllergenService.update(editingAllergen.id, trimmed);
            } else {
                await AllergenService.create(trimmed);
            }
            await fetchAllergens();
            setIsModalOpen(false);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Error al guardar');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Eliminar este alérgeno?')) return;
        try {
            await AllergenService.delete(id);
            await fetchAllergens();
        } catch (err: unknown) {
            alert(err instanceof Error ? err.message : 'Error al eliminar');
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">{allergens.length} alérgenos</p>
                <Button size="sm" onClick={openAddModal}>
                    <Plus className="h-4 w-4 mr-1" />
                    Añadir alérgeno
                </Button>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-gray-100">
                            <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">
                                Nombre
                            </th>
                            <th className="text-right px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider w-24">
                                Acciones
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {allergens.length === 0 ? (
                            <tr>
                                <td colSpan={2} className="px-4 py-8 text-center text-sm text-gray-400">
                                    No hay alérgenos registrados
                                </td>
                            </tr>
                        ) : (
                            allergens.map(allergen => (
                                <tr key={allergen.id} className="border-b border-gray-50 hover:bg-gray-50">
                                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                        {allergen.name}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-gray-400 hover:text-primary-600"
                                                onClick={() => openEditModal(allergen)}
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-gray-400 hover:text-red-600"
                                                onClick={() => handleDelete(allergen.id)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingAllergen ? 'Editar alérgeno' : 'Nuevo alérgeno'}
                size="sm"
            >
                <div className="space-y-4">
                    <div className="space-y-2">
                        <label htmlFor="allergen-name" className="text-sm font-medium text-gray-700">
                            Nombre
                        </label>
                        <Input
                            id="allergen-name"
                            value={name}
                            onChange={e => { setName(e.target.value); setError(''); }}
                            placeholder="Ej: Gluten"
                            autoFocus
                        />
                        {error && (
                            <p className="text-sm text-red-500">{error}</p>
                        )}
                    </div>
                    <div className="flex gap-3 pt-2">
                        <Button variant="ghost" className="flex-1" onClick={() => setIsModalOpen(false)}>
                            Cancelar
                        </Button>
                        <Button className="flex-1" onClick={handleSave} disabled={isSaving}>
                            {isSaving ? 'Guardando...' : 'Guardar'}
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};
