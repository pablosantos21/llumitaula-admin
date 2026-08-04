import { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2, Search, RefreshCw } from 'lucide-react';
import { ChildService, type ChildWithSchool } from '@/services/children.service';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useDebounce } from '@/features/menus/hooks/useDebounce';
import { ChildAllergensModal } from './ChildAllergensModal';

export const SpecialMenuChildrenList = () => {
    const [children, setChildren] = useState<ChildWithSchool[]>([]);
    const [allChildren, setAllChildren] = useState<ChildWithSchool[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedChild, setSelectedChild] = useState<ChildWithSchool | null>(null);
    const hasLoadedRef = useRef(false);

    const debouncedSearchTerm = useDebounce(searchTerm, 300);

    const fetchData = useCallback(async () => {
        try {
            setError(null);
            if (!hasLoadedRef.current) {
                setIsLoading(true);
            }
            const [specialMenu, all] = await Promise.all([
                ChildService.getChildrenWithSpecialMenu(),
                ChildService.getAllChildren(),
            ]);
            hasLoadedRef.current = true;
            setChildren(specialMenu);
            setAllChildren(all);
        } catch (err) {
            console.error(err);
            setError('No se pudieron cargar los datos');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const filteredChildren = allChildren.filter(child => {
        const fullName = `${child.first_name} ${child.last_name}`.toLowerCase();
        const className = child.classes?.name?.toLowerCase() || '';
        const schoolName = child.classes?.schools?.name?.toLowerCase() || '';
        const search = debouncedSearchTerm.toLowerCase();
        return fullName.includes(search) || className.includes(search) || schoolName.includes(search);
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
                <p className="text-sm text-red-600">{error}</p>
                <Button variant="secondary" size="sm" onClick={fetchData} className="gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Reintentar
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                    placeholder="Buscar por nombre, clase o colegio..."
                    className="pl-10"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {debouncedSearchTerm.trim().length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-gray-100">
                                <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">
                                    Nombre
                                </th>
                                <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">
                                    Apellido
                                </th>
                                <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">
                                    Clase
                                </th>
                                <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">
                                    Colegio
                                </th>
                                <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">
                                    Alérgenos
                                </th>
                                <th className="text-right px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">
                                    Acción
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredChildren.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">
                                        No se encontraron niños
                                    </td>
                                </tr>
                            ) : (
                                filteredChildren.map(child => (
                                    <tr key={child.id} className="border-b border-gray-50 hover:bg-gray-50">
                                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                            {child.first_name}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-600">
                                            {child.last_name}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-600">
                                            {child.classes?.name || '-'}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-600">
                                            {child.classes?.schools?.name || '-'}
                                        </td>
                                        <td className="px-4 py-3">
                                            {child.child_allergens && child.child_allergens.length > 0 ? (
                                                <div className="flex flex-wrap gap-1">
                                                    {child.child_allergens.map(a => (
                                                        <span
                                                            key={a.allergen_id}
                                                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-300"
                                                        >
                                                            {a.allergens.name}
                                                        </span>
                                                    ))}
                                                </div>
                                            ) : (
                                                <span className="text-sm text-gray-400">Sin alérgenos</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <Button size="sm" variant="secondary" onClick={() => setSelectedChild(child)}>
                                                Editar
                                            </Button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            <div className="space-y-4">
                <p className="text-sm text-gray-500">{children.length} niños con menú especial</p>

                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-gray-100">
                                <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">
                                    Nombre
                                </th>
                                <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">
                                    Apellido
                                </th>
                                <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">
                                    Clase
                                </th>
                                <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">
                                    Colegio
                                </th>
                                <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">
                                    Alérgenos
                                </th>
                                <th className="text-right px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">
                                    Acción
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {children.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">
                                        No hay niños con menú especial
                                    </td>
                                </tr>
                            ) : (
                                children.map(child => (
                                    <tr key={child.id} className="border-b border-gray-50 hover:bg-gray-50">
                                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                            {child.first_name}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-600">
                                            {child.last_name}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-600">
                                            {child.classes?.name || '-'}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-600">
                                            {child.classes?.schools?.name || '-'}
                                        </td>
                                        <td className="px-4 py-3">
                                            {child.child_allergens && child.child_allergens.length > 0 ? (
                                                <div className="flex flex-wrap gap-1">
                                                    {child.child_allergens.map(a => (
                                                        <span
                                                            key={a.allergen_id}
                                                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-300"
                                                        >
                                                            {a.allergens.name}
                                                        </span>
                                                    ))}
                                                </div>
                                            ) : (
                                                <span className="text-sm text-gray-400">Sin alérgenos</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <Button size="sm" variant="secondary" onClick={() => setSelectedChild(child)}>
                                                Editar
                                            </Button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <ChildAllergensModal
                child={selectedChild}
                isOpen={!!selectedChild}
                onClose={() => setSelectedChild(null)}
                onSaved={fetchData}
            />
        </div>
    );
};
