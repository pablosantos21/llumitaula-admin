# Special Menu Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `SpecialMenusMatrixModal` with a dedicated page `/menus/:menuId` that displays the base menu and auto-detects allergen-grouped special menu variants from children in assigned schools.

**Architecture:** A new page `SpecialMenuPage` at `/menus/:menuId` with a dedicated hook `useSpecialMenu`. The hook fetches the base menu, queries children's allergens from assigned schools, groups by unique allergen combinations, and manages edit/save state. Existing `MenuService.upsertMenu` and `MenuService.assignMenuToSchools` are reused for saving.

**Tech Stack:** React 19, TypeScript, React Router DOM v7, Supabase, Tailwind CSS v4, Lucide React

---

### Task 1: Add `getMenuWithSchools` to MenuService

**Files:**
- Modify: `src/services/menus.service.ts`

- [ ] **Step 1: Add the method to MenuService**

Add this method inside `export const MenuService = { ... }` before the closing `};`:

```typescript
    getMenuWithSchools: async (menuId: string): Promise<{
        menu: any;
        schools: { id: string; name: string }[];
        date: string;
    }> => {
        const { data, error } = await supabase
            .from('menus')
            .select(`
                *,
                menus_schools (
                    school_id,
                    date,
                    schools (
                        id,
                        name
                    )
                )
            `)
            .eq('id', menuId)
            .single();

        if (error) {
            console.error('Error fetching menu:', error);
            throw new Error(error.message);
        }

        const { menus_schools, ...menuData } = data;
        const schools = menus_schools.map((ms: any) => ms.schools);
        const date = menus_schools[0]?.date || '';

        return {
            menu: {
                ...menuData,
                first_course: menuData.first_course || menuData.primero,
                second_course: menuData.second_course || menuData.segundo,
                side: menuData.side || menuData.guarnicion,
                salad: menuData.salad || menuData.ensalada,
                dessert: menuData.dessert || menuData.postre,
            },
            schools,
            date
        };
    },
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to `menus.service.ts`.

---

### Task 2: Add `getChildrenAllergensBySchools` to ChildService

**Files:**
- Modify: `src/services/children.service.ts`

- [ ] **Step 1: Add method to ChildService**

Add inside `export const ChildService = { ... }` before the closing `};`:

```typescript
    getChildrenAllergensBySchools: async (schoolIds: string[]): Promise<{
        id: string;
        first_name: string;
        last_name: string;
        allergens: { id: string; name: string }[];
    }[]> => {
        const { data, error } = await supabase
            .from('children')
            .select(`
                id,
                first_name,
                last_name,
                class_id,
                classes!inner(
                    id,
                    school_id
                ),
                child_allergens(
                    allergen_id,
                    allergens(
                        id,
                        name
                    )
                )
            `)
            .in('classes.school_id', schoolIds)
            .not('child_allergens', 'is', null)
            .order('first_name');

        if (error) {
            console.error('Error fetching children allergens:', error);
            throw new Error(error.message);
        }

        return (data || []).map((c: any) => ({
            id: c.id,
            first_name: c.first_name,
            last_name: c.last_name,
            allergens: (c.child_allergens || []).map((ca: any) => ca.allergens)
        }));
    },
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to `children.service.ts`.

---

### Task 3: Add `deleteSpecialMenus` to MenuService

**Files:**
- Modify: `src/services/menus.service.ts`

- [ ] **Step 1: Add method to MenuService**

Add inside `export const MenuService = { ... }` before the closing `};`:

```typescript
    deleteSpecialMenus: async (menuId: string): Promise<void> => {
        const { data: assignments, error: fetchError } = await supabase
            .from('menus_schools')
            .select('menu_id, date')
            .eq('menu_id', menuId);

        if (fetchError) {
            console.error('Error fetching assignments:', fetchError);
            throw new Error(fetchError.message);
        }

        if (!assignments || assignments.length === 0) return;

        const date = assignments[0].date;

        const { data: sameDay, error: sameDayError } = await supabase
            .from('menus_schools')
            .select('menu_id')
            .eq('date', date);

        if (sameDayError) {
            console.error('Error fetching same-day menus:', sameDayError);
            throw new Error(sameDayError.message);
        }

        const menuIds = sameDay.map((ms: any) => ms.menu_id);

        const { data: specialMenus, error: specialError } = await supabase
            .from('menus')
            .select('id')
            .in('id', menuIds)
            .neq('type', 'normal');

        if (specialError) {
            console.error('Error fetching special menus:', specialError);
            throw new Error(specialError.message);
        }

        const specialIds = specialMenus.map((m: any) => m.id);

        if (specialIds.length > 0) {
            const { error: delAssignError } = await supabase
                .from('menus_schools')
                .delete()
                .in('menu_id', specialIds);

            if (delAssignError) {
                console.error('Error deleting special menu assignments:', delAssignError);
                throw new Error(delAssignError.message);
            }

            const { error: delMenuError } = await supabase
                .from('menus')
                .delete()
                .in('id', specialIds);

            if (delMenuError) {
                console.error('Error deleting special menus:', delMenuError);
                throw new Error(delMenuError.message);
            }
        }
    },
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to `menus.service.ts`.

---

### Task 4: Create `useSpecialMenu` hook

**Files:**
- Create: `src/features/menus/hooks/useSpecialMenu.ts`

- [ ] **Step 1: Create the hook file**

Write to `src/features/menus/hooks/useSpecialMenu.ts`:

```typescript
import { useState, useEffect, useCallback, useMemo } from 'react'
import { MenuService } from '@/services/menus.service'
import { ChildService } from '@/services/children.service'

interface AllergenGroup {
    name: string;
    children: {
        id: string;
        first_name: string;
        last_name: string;
    }[];
    count: number;
}

interface MatrixCell {
    first_course: string;
    second_course: string;
    side: string;
    salad: string;
    dessert: string;
}

interface MenuData {
    id: string;
    type: string;
    first_course: string;
    second_course: string;
    side: string;
    salad: string;
    dessert: string;
}

export const useSpecialMenu = (menuId: string) => {
    const [menu, setMenu] = useState<MenuData | null>(null)
    const [schools, setSchools] = useState<{ id: string; name: string }[]>([])
    const [date, setDate] = useState<string>('')
    const [allergenGroups, setAllergenGroups] = useState<AllergenGroup[]>([])
    const [matrixData, setMatrixData] = useState<Record<string, MatrixCell>>({})
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)

    useEffect(() => {
        const fetchData = async () => {
            try {
                setIsLoading(true)
                const menuData = await MenuService.getMenuWithSchools(menuId)
                setMenu(menuData.menu)
                setSchools(menuData.schools)
                setDate(menuData.date)

                const schoolIds = menuData.schools.map(s => s.id)
                if (schoolIds.length === 0) {
                    setAllergenGroups([])
                    return
                }

                const children = await ChildService.getChildrenAllergensBySchools(schoolIds)

                const groupMap = new Map<string, { id: string; first_name: string; last_name: string }[]>()
                children.forEach(child => {
                    const allergenNames = child.allergens.map(a => a.name).sort()
                    const key = allergenNames.join(' + ')
                    if (!groupMap.has(key)) groupMap.set(key, [])
                    groupMap.get(key)!.push({
                        id: child.id,
                        first_name: child.first_name,
                        last_name: child.last_name
                    })
                })

                const groups: AllergenGroup[] = Array.from(groupMap.entries()).map(([name, children]) => ({
                    name,
                    children,
                    count: children.length
                }))

                setAllergenGroups(groups)

                const initialMatrix: Record<string, MatrixCell> = {}
                const base = {
                    first_course: menuData.menu.first_course || '',
                    second_course: menuData.menu.second_course || '',
                    side: menuData.menu.side || '',
                    salad: menuData.menu.salad || '',
                    dessert: menuData.menu.dessert || ''
                }
                groups.forEach(group => {
                    initialMatrix[group.name] = { ...base }
                })
                setMatrixData(initialMatrix)
            } catch (err) {
                console.error('Error loading special menu data:', err)
            } finally {
                setIsLoading(false)
            }
        }
        fetchData()
    }, [menuId])

    const updateMatrixField = useCallback((groupName: string, field: string, value: string) => {
        setMatrixData(prev => ({
            ...prev,
            [groupName]: {
                ...prev[groupName],
                [field]: value
            }
        }))
    }, [])

    const handleSave = useCallback(async () => {
        if (!menu) return
        try {
            setIsSaving(true)

            await MenuService.deleteSpecialMenus(menu.id)

            const schoolIds = schools.map(s => s.id)

            for (const [groupName, fields] of Object.entries(matrixData)) {
                const hasContent = Object.values(fields).some(v => !!v)
                if (!hasContent) continue

                const menuData = {
                    type: groupName,
                    first_course: fields.first_course,
                    second_course: fields.second_course,
                    side: fields.side,
                    salad: fields.salad,
                    dessert: fields.dessert,
                }

                const savedMenu = await MenuService.upsertMenu(menuData)

                await MenuService.assignMenuToSchools(
                    savedMenu.id,
                    schoolIds,
                    date
                )
            }
        } catch (err) {
            console.error('Error saving special menus:', err)
            throw err
        } finally {
            setIsSaving(false)
        }
    }, [menu, schools, date, matrixData])

    const fields = useMemo<{ label: string; field: keyof MatrixCell }[]>(() => [
        { label: 'Primer Plato', field: 'first_course' },
        { label: 'Segundo Plato', field: 'second_course' },
        { label: 'Guarnición', field: 'side' },
        { label: 'Ensalada', field: 'salad' },
        { label: 'Postre', field: 'dessert' },
    ], [])

    return {
        menu,
        schools,
        date,
        allergenGroups,
        matrixData,
        isLoading,
        isSaving,
        updateMatrixField,
        handleSave,
        fields
    }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to `useSpecialMenu.ts`.

---

### Task 5: Create `SpecialMenuPage` component

**Files:**
- Create: `src/pages/menus/SpecialMenuPage.tsx`

- [ ] **Step 1: Create the page file**

Write to `src/pages/menus/SpecialMenuPage.tsx`:

```typescript
import { useParams, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { useSpecialMenu } from '@/features/menus/hooks/useSpecialMenu'
import { ArrowLeft, Utensils, Save, Loader2 } from 'lucide-react'

export default function SpecialMenuPage() {
    const { menuId } = useParams<{ menuId: string }>()
    const navigate = useNavigate()

    const {
        menu,
        schools,
        date,
        allergenGroups,
        matrixData,
        isLoading,
        isSaving,
        updateMatrixField,
        handleSave,
        fields
    } = useSpecialMenu(menuId!)

    const handleSaveClick = async () => {
        try {
            await handleSave()
            navigate('/menus')
        } catch {
            alert('Error al guardar los menús especiales')
        }
    }

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-10 w-10 text-indigo-500 animate-spin" />
                    <p className="text-gray-500 font-medium">Cargando menús especiales...</p>
                </div>
            </div>
        )
    }

    if (!menu) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center space-y-4">
                    <Utensils className="h-12 w-12 text-gray-300 mx-auto" />
                    <p className="text-gray-500 font-medium">Menú no encontrado</p>
                    <Button variant="outline" onClick={() => navigate('/menus')}>
                        Volver a Menús
                    </Button>
                </div>
            </div>
        )
    }

    const formattedDate = date
        ? new Date(date + 'T00:00:00').toLocaleDateString('es-ES', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
        })
        : ''

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto w-full">
                    <div className="flex items-center gap-3 mb-3">
                        <Button variant="ghost" size="sm" onClick={() => navigate('/menus')} className="text-gray-500">
                            <ArrowLeft className="h-4 w-4 mr-1" />
                            Menús
                        </Button>
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">Menús Especiales</h1>
                        <p className="text-sm text-gray-500">
                            {formattedDate} — {schools.map(s => s.name).join(', ')}
                        </p>
                    </div>
                </div>
            </header>

            <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
                {allergenGroups.length === 0 ? (
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
                        <Utensils className="h-12 w-12 text-gray-200 mx-auto mb-4" />
                        <p className="text-gray-500 font-medium">
                            No hay niños con alérgenos en estos colegios
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex items-center gap-6">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-gray-400 uppercase">Niños con alérgenos:</span>
                                <Badge variant="info">
                                    {allergenGroups.reduce((sum, g) => sum + g.count, 0)}
                                </Badge>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-gray-400 uppercase">Agrupaciones:</span>
                                <Badge variant="warning">
                                    {allergenGroups.length}
                                </Badge>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
                            <div className="min-w-[800px]">
                                <table className="w-full border-collapse">
                                    <thead>
                                        <tr>
                                            <th className="p-3 border-b text-left bg-gray-50 text-xs font-bold text-gray-400 uppercase tracking-wider sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                                                Plato
                                            </th>
                                            <th className="p-3 border-b text-center bg-indigo-50 text-xs font-bold text-indigo-600 uppercase tracking-wider">
                                                Menú Base
                                            </th>
                                            {allergenGroups.map(group => (
                                                <th key={group.name} className="p-3 border-b text-center bg-gray-50 text-xs font-bold text-gray-600 uppercase tracking-wider">
                                                    <Badge variant="warning" className="mb-1 whitespace-nowrap">
                                                        {group.name}
                                                    </Badge>
                                                    <span className="block text-[10px] text-gray-400 font-normal">
                                                        {group.count} niño{group.count !== 1 ? 's' : ''}
                                                    </span>
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {fields.map(row => (
                                            <tr key={row.field} className="hover:bg-gray-50 transition-colors">
                                                <td className="p-3 border-b text-sm font-bold text-gray-700 bg-white sticky left-0 z-10 w-40 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] whitespace-nowrap">
                                                    {row.label}
                                                </td>
                                                <td className="p-3 border-b text-sm text-gray-400 italic bg-indigo-50/30 text-center">
                                                    {menu[row.field] || '-'}
                                                </td>
                                                {allergenGroups.map(group => (
                                                    <td key={group.name} className="p-2 border-b min-w-[220px]">
                                                        <Input
                                                            value={matrixData[group.name]?.[row.field] || ''}
                                                            onChange={e => updateMatrixField(group.name, row.field, e.target.value)}
                                                            className="h-9 text-xs focus:bg-white bg-gray-50/50 border-gray-100"
                                                            placeholder={`Escribir ${row.label.toLowerCase()}...`}
                                                        />
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="flex gap-3 pt-2">
                            <Button variant="outline" className="flex-1" onClick={() => navigate('/menus')}>
                                Cancelar
                            </Button>
                            <Button className="flex-1 gap-2 shadow-lg shadow-indigo-100" onClick={handleSaveClick} disabled={isSaving}>
                                <Save className="h-4 w-4" />
                                {isSaving ? 'Guardando...' : 'Guardar Menús Especiales'}
                            </Button>
                        </div>
                    </>
                )}
            </main>
        </div>
    )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to `SpecialMenuPage.tsx`.

---

### Task 6: Add route to App.tsx

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Import and add route**

In `src/App.tsx`, add the import:
```typescript
import SpecialMenuPage from './pages/menus/SpecialMenuPage'
```

And add the route inside `<Route element={<ProtectedRoute />}>` after the `/menus` route:
```typescript
<Route path="/menus/:menuId" element={<SpecialMenuPage />} />
```

The `App.tsx` file should end up with these relevant lines:
```typescript
import SpecialMenuPage from './pages/menus/SpecialMenuPage'
// ...
<Route path="/menus" element={<MenusPage />} />
<Route path="/menus/:menuId" element={<SpecialMenuPage />} />
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to `App.tsx`.

---

### Task 7: Modify `MenuGroupCard` — change button to navigate

**Files:**
- Modify: `src/features/menus/components/MenuGroupCard.tsx`

- [ ] **Step 1: Change onEditSpecial to use navigation**

Replace the file content. Change the prop from `onEditSpecial: (group: MenuGroup) => void` to a navigate-based approach. The easiest way: change the prop to be a function that returns nothing but Navigator needs to come from the caller. Better approach: use `useNavigate` directly in the card.

Replace the file at `src/features/menus/components/MenuGroupCard.tsx`:

```typescript
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Building2, Edit2, Plus } from 'lucide-react'
import type { MenuGroup } from '../types'

interface MenuGroupCardProps {
    group: MenuGroup;
    onEditNormal: (group: MenuGroup) => void;
}

export const MenuGroupCard = ({ group, onEditNormal }: MenuGroupCardProps) => {
    const navigate = useNavigate()

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="bg-gray-50 px-6 py-3 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Building2 className="h-4 w-4 text-indigo-500 shrink-0" />
                    <div className="flex flex-wrap gap-1.5">
                        {group?.schools.map(s => (
                            <span key={s.id} className="bg-white px-2 py-0.5 rounded border border-gray-200 font-bold text-gray-900 shadow-sm text-xs uppercase tracking-tight">
                                {s.name}
                            </span>
                        ))}
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-gray-400"
                        onClick={() => onEditNormal(group)}
                    >
                        <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </div>
            <div className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 py-4 border-b border-gray-100 italic text-sm text-gray-700">
                    <div className="space-y-1">
                        <span className="text-[10px] uppercase font-bold text-gray-400 block not-italic">Primer Plato</span>
                        <p className="truncate font-medium text-gray-900">{group?.menu?.first_course || '-'}</p>
                    </div>
                    <div className="space-y-1">
                        <span className="text-[10px] uppercase font-bold text-gray-400 block not-italic">Segundo Plato</span>
                        <p className="truncate font-medium text-gray-900">{group?.menu?.second_course || '-'}</p>
                    </div>
                    <div className="space-y-1">
                        <span className="text-[10px] uppercase font-bold text-gray-400 block not-italic">Guarnición</span>
                        <p className="truncate text-gray-600">{group?.menu?.side || '-'}</p>
                    </div>
                    <div className="space-y-1">
                        <span className="text-[10px] uppercase font-bold text-gray-400 block not-italic">Ensalada</span>
                        <p className="truncate text-gray-600">{group?.menu?.salad || '-'}</p>
                    </div>
                    <div className="space-y-1">
                        <span className="text-[10px] uppercase font-bold text-gray-400 block not-italic">Postre</span>
                        <p className="truncate font-medium text-gray-900">{group?.menu?.dessert || '-'}</p>
                    </div>
                </div>

                <div className="flex items-center justify-end pt-2">
                    <Button
                        variant="primary"
                        size="sm"
                        className="h-8 shadow-sm gap-2"
                        onClick={() => navigate(`/menus/${group.menu.id}`)}
                    >
                        <Plus className="h-4 w-4" />
                        Configurar Menús Especiales
                    </Button>
                </div>
            </div>
        </div>
    )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to `MenuGroupCard.tsx`.

---

### Task 8: Modify `DailyProgramming` — remove matrix prop

**Files:**
- Modify: `src/features/menus/components/DailyProgramming.tsx`

- [ ] **Step 1: Remove the `openMatrixModal` prop**

Change the interface to remove `openMatrixModal`:

```typescript
interface DailyProgrammingProps {
    selectedDate: Date | null;
    isLoading: boolean;
    groupedMenus: MenuGroup[];
    unassignedSchoolsCount: number;
    openNormalMenuModal: (group?: MenuGroup) => void;
}
```

And in the component destructuring, remove `openMatrixModal`:

```typescript
export const DailyProgramming = ({
    selectedDate,
    isLoading,
    groupedMenus,
    unassignedSchoolsCount,
    openNormalMenuModal
}: DailyProgrammingProps) => {
```

And change the `MenuGroupCard` usage from:
```typescript
<MenuGroupCard
    key={idx}
    group={group}
    onEditNormal={openNormalMenuModal}
    onEditSpecial={openMatrixModal}
/>
```
to:
```typescript
<MenuGroupCard
    key={idx}
    group={group}
    onEditNormal={openNormalMenuModal}
/>
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to `DailyProgramming.tsx`.

---

### Task 9: Modify `MenusPage` — remove matrix modal

**Files:**
- Modify: `src/pages/menus/MenusPage.tsx`

- [ ] **Step 1: Remove matrix modal from the page**

Replace the content of `src/pages/menus/MenusPage.tsx`:

```typescript
import { useState } from 'react'
import {
    useMenusData,
    useMenuForm,
    MenuHeader,
    CoverageCalendar,
    DailyProgramming,
    NormalMenuModal,
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
        editingGroup,
        isSaving,
        formData,
        setFormData,
        openNormalMenuModal,
        toggleSelection,
        handleSaveAssignment,
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
                    </>
                ) : (
                    <SpecialMenusView />
                )}
            </main>
        </div>
    )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to `MenusPage.tsx`.

---

### Task 10: Modify `useMenuForm` — remove matrix code

**Files:**
- Modify: `src/features/menus/hooks/useMenuForm.ts`

- [ ] **Step 1: Remove all matrix-related state and methods**

Replace the file at `src/features/menus/hooks/useMenuForm.ts`:

```typescript
import { useState, useCallback } from 'react'
import { MenuService } from '@/services/menus.service'
import type { MenuType } from '@/mocks/menus'
import { formatDate } from '../utils/date-utils'
import type { MenuGroup } from '../types'

interface FormState {
    id: string;
    first_course: string;
    second_course: string;
    side: string;
    salad: string;
    dessert: string;
    schoolIds: string[];
    allergens: string[];
}

const initialFormState: FormState = {
    id: '',
    first_course: '',
    second_course: '',
    side: '',
    salad: '',
    dessert: '',
    schoolIds: [],
    allergens: []
}

export const useMenuForm = (selectedDate: Date | null, onSaveSuccess: () => void) => {
    const [isMenuModalOpen, setIsMenuModalOpen] = useState(false)
    const [editingGroup, setEditingGroup] = useState<MenuGroup | null>(null)
    const [isSaving, setIsSaving] = useState(false)

    const [formData, setFormData] = useState<FormState>(initialFormState)

    const openNormalMenuModal = useCallback((group?: MenuGroup) => {
        if (group) {
            setEditingGroup(group)
            setFormData({
                id: group.menu?.id || '',
                first_course: group.menu?.first_course || '',
                second_course: group.menu?.second_course || '',
                side: group.menu?.side || '',
                salad: group.menu?.salad || '',
                dessert: group.menu?.dessert || '',
                schoolIds: group.schoolIds || [],
                allergens: group.menu?.allergens || []
            })
        } else {
            setEditingGroup(null)
            setFormData(initialFormState)
        }
        setIsMenuModalOpen(true)
    }, [])

    const toggleSelection = useCallback((id: string, field: 'schoolIds' | 'allergens') => {
        setFormData(prev => ({
            ...prev,
            [field]: prev[field].includes(id)
                ? prev[field].filter(item => item !== id)
                : [...prev[field], id]
        }))
    }, [])

    const handleSaveAssignment = async () => {
        if (!selectedDate) return;

        try {
            setIsSaving(true);
            const menuData = {
                id: formData.id || undefined,
                type: 'normal' as MenuType,
                first_course: formData.first_course,
                second_course: formData.second_course,
                side: formData.side,
                salad: formData.salad,
                dessert: formData.dessert,
            };

            const savedMenu = await MenuService.upsertMenu(menuData);

            await MenuService.assignMenuToSchools(
                savedMenu.id,
                formData.schoolIds,
                formatDate(selectedDate)
            );

            onSaveSuccess();
            setIsMenuModalOpen(false);
        } catch (err) {
            console.error('Error saving assignment:', err);
            alert('Error al guardar el menú');
        } finally {
            setIsSaving(false);
        }
    }

    return {
        isMenuModalOpen,
        setIsMenuModalOpen,
        editingGroup,
        isSaving,
        formData,
        setFormData,
        openNormalMenuModal,
        toggleSelection,
        handleSaveAssignment,
    }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to `useMenuForm.ts`.

---

### Task 11: Update barrel export

**Files:**
- Modify: `src/features/menus/index.ts`

- [ ] **Step 1: Remove SpecialMenusMatrixModal export, add useSpecialMenu**

Replace the file at `src/features/menus/index.ts`:

```typescript
export * from './hooks/useMenusData'
export * from './hooks/useMenuForm'
export * from './hooks/useSpecialMenu'
export * from './components/MenuHeader'
export * from './components/CoverageCalendar'
export * from './components/DailyProgramming'
export * from './components/NormalMenuModal'
export * from './components/SpecialMenusView'
export * from './components/AllergensManager'
export * from './components/SpecialMenuChildrenList'
export * from './types'
export * from './constants/allergens'
export * from './utils/date-utils'
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors.

---

### Task 12: Delete `SpecialMenusMatrixModal.tsx`

**Files:**
- Delete: `src/features/menus/components/SpecialMenusMatrixModal.tsx`

- [ ] **Step 1: Delete the file**

Run: `rm src/features/menus/components/SpecialMenusMatrixModal.tsx`

- [ ] **Step 2: Verify TypeScript compiles cleanly**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors. If there are stale import errors, fix them.

---

### Task 13: End-to-end verification

- [ ] **Step 1: Full build (typecheck + vite)**

Run: `npm run build 2>&1`
Expected: Build succeeds with no errors.

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat: replace matrix modal with special menu page based on child allergens"
```
