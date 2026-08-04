# Alérgenos y Menús Especiales - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Menús Especiales" tab to the /menus page with allergens CRUD and a list of children with special menus.

**Architecture:** Add tabs to MenuHeader component, create a SpecialMenusView with two sub-tabs (Alérgenos, Niños), backed by a new allergens table in Supabase and a new special_menu column on children.

**Tech Stack:** React 19, TypeScript, Supabase, Tailwind CSS, lucide-react

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `supabase/migrations/YYYYMMDD_add_allergens_table.sql` | Create | allergens table + RLS policies |
| `supabase/migrations/YYYYMMDD_add_special_menu_to_children.sql` | Create | Add special_menu column to children |
| `src/services/allergens.service.ts` | Create | Allergens CRUD service |
| `src/services/children.service.ts` | Modify | Add getChildrenWithSpecialMenu() |
| `src/features/menus/components/AllergensManager.tsx` | Create | Allergens table + add/edit/delete |
| `src/features/menus/components/SpecialMenuChildrenList.tsx` | Create | Children with special_menu list |
| `src/features/menus/components/SpecialMenusView.tsx` | Create | Tab container with sub-tabs |
| `src/features/menus/components/MenuHeader.tsx` | Modify | Add tabs with activeTab prop |
| `src/pages/menus/MenusPage.tsx` | Modify | Integrate tab state |
| `src/features/menus/index.ts` | Modify | Add new exports |

---

### Task 1: Create allergens table in Supabase

**Files:**
- Apply via `supabase_apply_migration`

**SQL:**
```sql
CREATE TABLE public.allergens (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

ALTER TABLE public.allergens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allergens_admin_all" ON public.allergens
  FOR ALL USING (
    auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin')
  );

CREATE POLICY "allergens_view_authenticated" ON public.allergens
  FOR SELECT USING (
    auth.role() = 'authenticated'
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.allergens TO authenticated;
```

### Task 2: Add special_menu column to children table

**Files:**
- Apply via `supabase_apply_migration`

**SQL:**
```sql
ALTER TABLE public.children
ADD COLUMN special_menu BOOLEAN DEFAULT false;
```

### Task 3: Create allergens service

**Files:**
- Create: `src/services/allergens.service.ts`

```typescript
import { supabase } from '../lib/supabase';

export interface Allergen {
    id: string;
    name: string;
}

export const AllergenService = {
    getAll: async (): Promise<Allergen[]> => {
        const { data, error } = await supabase
            .from('allergens')
            .select('id, name')
            .order('name');

        if (error) {
            console.error('Error fetching allergens:', error);
            throw new Error(error.message);
        }

        return data || [];
    },

    create: async (name: string): Promise<Allergen> => {
        const { data, error } = await supabase
            .from('allergens')
            .insert([{ name }])
            .select()
            .single();

        if (error) {
            console.error('Error creating allergen:', error);
            throw new Error(error.message);
        }

        return data;
    },

    update: async (id: string, name: string): Promise<Allergen> => {
        const { data, error } = await supabase
            .from('allergens')
            .update({ name })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating allergen:', error);
            throw new Error(error.message);
        }

        return data;
    },

    delete: async (id: string): Promise<void> => {
        const { error } = await supabase
            .from('allergens')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting allergen:', error);
            throw new Error(error.message);
        }
    }
};
```

### Task 4: Add getChildrenWithSpecialMenu to children service

**Files:**
- Modify: `src/services/children.service.ts`

**Change:** Add the `ChildWithSchool` interface and `getChildrenWithSpecialMenu` method after the existing `deleteChild` method (before the closing `}`).

**New interface** (add after existing `Child` interface):
```typescript
export interface ChildWithSchool {
    id: string;
    first_name: string;
    last_name: string;
    class_id: string;
    created_at: string;
    special_menu: boolean;
    classes: {
        id: string;
        name: string;
        school_id: string;
        schools: {
            id: string;
            name: string;
        } | null;
    } | null;
}
```

**New method** (add inside `ChildService` object, before the final `}`):
```typescript
    getChildrenWithSpecialMenu: async (): Promise<ChildWithSchool[]> => {
        const { data, error } = await supabase
            .from('children')
            .select(`
                id,
                first_name,
                last_name,
                class_id,
                created_at,
                special_menu,
                classes!inner(
                    id,
                    name,
                    school_id,
                    schools(
                        id,
                        name
                    )
                )
            `)
            .eq('special_menu', true)
            .order('first_name');

        if (error) {
            console.error('Error fetching children with special menu:', error);
            throw new Error(error.message);
        }

        return (data as unknown as ChildWithSchool[]) || [];
    },
```

### Task 5: Create AllergensManager component

**Files:**
- Create: `src/features/menus/components/AllergensManager.tsx`

```typescript
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
        } catch (err: any) {
            setError(err.message || 'Error al guardar');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Eliminar este alérgeno?')) return;
        try {
            await AllergenService.delete(id);
            await fetchAllergens();
        } catch (err: any) {
            alert(err.message || 'Error al eliminar');
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
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
                                                className="h-8 w-8 text-gray-400 hover:text-indigo-600"
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
```

### Task 6: Create SpecialMenuChildrenList component

**Files:**
- Create: `src/features/menus/components/SpecialMenuChildrenList.tsx`

```typescript
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
```

### Task 7: Create SpecialMenusView component

**Files:**
- Create: `src/features/menus/components/SpecialMenusView.tsx`

```typescript
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
```

### Task 8: Modify MenuHeader to accept tabs

**Files:**
- Modify: `src/features/menus/components/MenuHeader.tsx`

**Replace entire file content with:**

```typescript
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Utensils, ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

type MenuTab = 'menus' | 'especiales'

interface MenuHeaderProps {
    activeTab: MenuTab
    onTabChange: (tab: MenuTab) => void
}

const tabs: { id: MenuTab; label: string }[] = [
    { id: 'menus', label: 'Gestión de Menús' },
    { id: 'especiales', label: 'Menús Especiales' },
]

export const MenuHeader = ({ activeTab, onTabChange }: MenuHeaderProps) => {
    const navigate = useNavigate()

    return (
        <header className="bg-white border-b border-gray-200 px-6 pt-4 sticky top-0 z-10">
            <div className="flex items-center gap-4 pb-4">
                <Button variant="ghost" size="sm" onClick={() => navigate('/select-school')} className="text-gray-500">
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Colegios
                </Button>
                <div className="h-6 w-px bg-gray-200" />
                <div className="flex items-center gap-2">
                    <Utensils className="h-5 w-5 text-indigo-600" />
                    <h1 className="text-lg font-bold text-gray-900">Gestión de Menús</h1>
                </div>
            </div>
            <div className="flex gap-1 -mb-px">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => onTabChange(tab.id)}
                        className={cn(
                            "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
                            activeTab === tab.id
                                ? "border-indigo-600 text-indigo-700"
                                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                        )}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>
        </header>
    )
}
```

### Task 9: Modify MenusPage to integrate tabs

**Files:**
- Modify: `src/pages/menus/MenusPage.tsx`

**Replace entire file content with:**

```typescript
import { useState } from 'react'
import {
    useMenusData,
    useMenuForm,
    MenuHeader,
    CoverageCalendar,
    DailyProgramming,
    NormalMenuModal,
    SpecialMenusMatrixModal,
    SpecialMenusView
} from '@/features/menus'

type MenuTab = 'menus' | 'especiales'

export default function MenusPage() {
    const [activeTab, setActiveTab] = useState<MenuTab>('menus')

    const {
        selectedDate,
        setSelectedDate,
        currentMonth,
        setCurrentMonth,
        schools,
        groupedMenus,
        assignedSchoolIds,
        unassignedSchoolsCount,
        isLoadingCoverage,
        isLoadingDaily,
        getDayCoverage,
        refreshData
    } = useMenusData()

    const {
        isMenuModalOpen,
        setIsMenuModalOpen,
        isMatrixModalOpen,
        setIsMatrixModalOpen,
        editingGroup,
        isSaving,
        formData,
        setFormData,
        matrixData,
        openNormalMenuModal,
        openMatrixModal,
        updateMatrixField,
        toggleSelection,
        handleSaveAssignment,
        handleSaveMatrix
    } = useMenuForm(selectedDate, refreshData)

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <MenuHeader activeTab={activeTab} onTabChange={setActiveTab} />

            <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
                {activeTab === 'menus' ? (
                    <>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">Gestión de Menús</h1>
                                <p className="text-sm text-gray-500">Consulta la cobertura de menús por día y colegio.</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                            <CoverageCalendar
                                isLoading={isLoadingCoverage}
                                currentMonth={currentMonth}
                                onMonthChange={setCurrentMonth}
                                selectedDate={selectedDate}
                                onDateClick={setSelectedDate}
                                getDayCoverage={getDayCoverage}
                            />

                            <DailyProgramming
                                selectedDate={selectedDate}
                                isLoading={isLoadingDaily}
                                groupedMenus={groupedMenus}
                                unassignedSchoolsCount={unassignedSchoolsCount}
                                openNormalMenuModal={openNormalMenuModal}
                                openMatrixModal={openMatrixModal}
                            />
                        </div>

                        <NormalMenuModal
                            isOpen={isMenuModalOpen}
                            onClose={() => setIsMenuModalOpen(false)}
                            editingGroup={editingGroup}
                            formData={formData}
                            setFormData={setFormData}
                            schools={schools}
                            assignedSchoolIds={assignedSchoolIds}
                            toggleSelection={toggleSelection}
                            onSave={handleSaveAssignment}
                            isSaving={isSaving}
                        />

                        <SpecialMenusMatrixModal
                            isOpen={isMatrixModalOpen}
                            onClose={() => setIsMatrixModalOpen(false)}
                            matrixData={matrixData}
                            updateMatrixField={updateMatrixField}
                            onSave={handleSaveMatrix}
                            isSaving={isSaving}
                        />
                    </>
                ) : (
                    <SpecialMenusView />
                )}
            </main>
        </div>
    )
}
```

### Task 10: Update barrel exports

**Files:**
- Modify: `src/features/menus/index.ts`

**Replace entire file content with:**

```typescript
export * from './hooks/useMenusData'
export * from './hooks/useMenuForm'
export * from './components/MenuHeader'
export * from './components/CoverageCalendar'
export * from './components/DailyProgramming'
export * from './components/NormalMenuModal'
export * from './components/SpecialMenusMatrixModal'
export * from './components/SpecialMenusView'
export * from './components/AllergensManager'
export * from './components/SpecialMenuChildrenList'
export * from './types'
export * from './constants/allergens'
export * from './utils/date-utils'
```

---

## Execution Order

1. **Task 1** — Create allergens table in Supabase
2. **Task 2** — Add special_menu column to children
3. **Task 3** — Create allergens service
4. **Task 4** — Add getChildrenWithSpecialMenu to children service
5. **Task 5** — Create AllergensManager component
6. **Task 6** — Create SpecialMenuChildrenList component
7. **Task 7** — Create SpecialMenusView component
8. **Task 8** — Modify MenuHeader to accept tabs
9. **Task 9** — Modify MenusPage to integrate tabs
10. **Task 10** — Update barrel exports

Tasks 1-2 are independent of each other. Tasks 3-7 are independent of each other. Tasks 8-10 depend on earlier tasks only for imports/exports to exist.
