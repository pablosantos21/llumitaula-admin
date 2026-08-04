import { useState } from 'react';
import { cn } from '@/lib/utils';
import { AllergensManager } from './AllergensManager';
import { SpecialMenuChildrenList } from './SpecialMenuChildrenList';
import { ShieldAlert, Users } from 'lucide-react';

type SubTab = 'alergenos' | 'ninos';

const subTabs: { id: SubTab; label: string; icon: typeof ShieldAlert }[] = [
    { id: 'alergenos', label: 'Alérgenos', icon: ShieldAlert },
    { id: 'ninos', label: 'Niños', icon: Users },
];

export const SpecialMenusView = () => {
    const [activeSubTab, setActiveSubTab] = useState<SubTab>('alergenos');

    return (
        <div className="space-y-6">
            <div className="flex gap-1 border-b border-gray-200">
                {subTabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveSubTab(tab.id)}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
                            activeSubTab === tab.id
                                ? "border-indigo-600 text-indigo-700"
                                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                        )}
                    >
                        <tab.icon className="h-4 w-4" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {activeSubTab === 'alergenos' && <AllergensManager />}
            {activeSubTab === 'ninos' && <SpecialMenuChildrenList />}
        </div>
    );
};
