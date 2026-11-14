import type { ChildWithSchool } from '@/services/children.service';
import { Button } from '@/components/ui/button';

export interface SpecialMenuChildrenTableProps {
    childrenList: ChildWithSchool[];
    emptyMessage: string;
    onEditChild: (child: ChildWithSchool) => void;
}

export const SpecialMenuChildrenTable = ({
    childrenList,
    emptyMessage,
    onEditChild,
}: SpecialMenuChildrenTableProps) => {
    return (
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
                    {childrenList.length === 0 ? (
                        <tr>
                            <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">
                                {emptyMessage}
                            </td>
                        </tr>
                    ) : (
                        childrenList.map((child) => (
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
                                            {child.child_allergens.map((a) => (
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
                                    <Button size="sm" variant="secondary" onClick={() => onEditChild(child)}>
                                        Editar
                                    </Button>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
};
