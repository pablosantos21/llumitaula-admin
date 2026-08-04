import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { ChildService, type ChildWithSchool } from '@/services/children.service';

export const SpecialMenuChildrenList = () => {
    const [children, setChildren] = useState<ChildWithSchool[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchChildren = async () => {
            try {
                setIsLoading(true);
                const data = await ChildService.getChildrenWithSpecialMenu();
                setChildren(data);
            } catch (err) {
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchChildren();
    }, []);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
            </div>
        );
    }

    return (
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
                        </tr>
                    </thead>
                    <tbody>
                        {children.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-400">
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
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
