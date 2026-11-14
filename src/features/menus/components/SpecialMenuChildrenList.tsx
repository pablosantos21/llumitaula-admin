import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Loader2, Search, RefreshCw } from 'lucide-react';
import { ChildService, type ChildWithSchool } from '@/services/children.service';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useDebounce } from '@/features/menus/hooks/useDebounce';
import { ChildAllergensModal } from './ChildAllergensModal';
import { SpecialMenuChildrenTable } from './SpecialMenuChildrenTable';

export { SpecialMenuChildrenTable } from './SpecialMenuChildrenTable';

export const SpecialMenuChildrenList = () => {
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
            const all = await ChildService.getAllChildren();
            hasLoadedRef.current = true;
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

    const specialMenuChildren = useMemo(() => {
        return allChildren.filter(c => (c.child_allergens?.length ?? 0) > 0);
    }, [allChildren]);

    const filteredChildren = useMemo(() => {
        const search = debouncedSearchTerm.trim().toLowerCase();
        if (!search) return [];
        return allChildren.filter(child => {
            const fullName = `${child.first_name} ${child.last_name}`.toLowerCase();
            const className = child.classes?.name?.toLowerCase() || '';
            const schoolName = child.classes?.schools?.name?.toLowerCase() || '';
            return fullName.includes(search) || className.includes(search) || schoolName.includes(search);
        });
    }, [allChildren, debouncedSearchTerm]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
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
                <SpecialMenuChildrenTable
                    childrenList={filteredChildren}
                    emptyMessage="No se encontraron niños"
                    onEditChild={setSelectedChild}
                />
            )}

            <div className="space-y-4">
                <p className="text-sm text-gray-500">{specialMenuChildren.length} niños con menú especial</p>
                <SpecialMenuChildrenTable
                    childrenList={specialMenuChildren}
                    emptyMessage="No hay niños con menú especial"
                    onEditChild={setSelectedChild}
                />
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
