# Buscador de niños en Menús Especiales — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir en la pestaña "Niños" de Menús Especiales un buscador con debounce que encuentre cualquier niño del sistema y permita editar sus alérgenos mediante un modal, manteniendo la tabla existente de niños con menú especial.

**Architecture:** Se añade un método `getAllChildren()` al servicio de niños que consulta todos los niños con clase, colegio y alérgenos. El componente `SpecialMenuChildrenList` se amplía con un input de búsqueda con debounce (hook `useDebounce`), una tabla de resultados con badges de alérgenos y un nuevo modal `ChildAllergensModal` que gestiona los checkboxes de alérgenos y guarda con `setChildAllergens()` (delete + insert en `child_allergens`).

**Tech Stack:** React 19 + TypeScript 5.9, Vite, TailwindCSS v4, Supabase, lucide-react. Componentes UI propios (`Modal`, `Button`, `Input`).

**Nota sobre verificación:** Este proyecto no tiene framework de tests. La verificación de cada tarea es `npm run build` (typecheck `tsc -b` + build) y `npm run lint` (ESLint). Alias de import `@/` → `src/`.

**Spec:** `docs/superpowers/specs/2026-08-04-buscador-ninos-alergenos-design.md`

---

### Task 1: Añadir `getAllChildren()` a `children.service.ts`

**Files:**
- Modify: `src/services/children.service.ts`

- [ ] **Step 1: Añadir el método**

Añade el método `getAllChildren` dentro del objeto `ChildService`, justo antes de `getChildrenWithSpecialMenu` (después del cierre de `setChildAllergens` en la línea 149, antes del `getChildrenWithSpecialMenu` en la línea 151):

```typescript
    getAllChildren: async (): Promise<ChildWithSchool[]> => {
        const { data, error } = await supabase
            .from('children')
            .select(`
                id,
                first_name,
                last_name,
                class_id,
                created_at,
                child_allergens(
                    allergen_id,
                    allergens(
                        id,
                        name
                    )
                ),
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
            .order('first_name');

        if (error) {
            console.error('Error fetching all children:', error);
            throw new Error(error.message);
        }

        return (data as unknown as ChildWithSchool[]) || [];
    },
```

- [ ] **Step 2: Verificar typecheck y lint**

Run: `npm run build && npm run lint`
Expected: build OK (no TS errors), lint OK (no ESLint errors).

- [ ] **Step 3: Commit**

```bash
git add src/services/children.service.ts
git commit -m "feat: add getAllChildren service method"
```

---

### Task 2: Crear hook `useDebounce`

**Files:**
- Create: `src/features/menus/hooks/useDebounce.ts`

- [ ] **Step 1: Crear el hook**

Crea el directorio `src/features/menus/hooks/` si no existe (ya existe, contiene `useMenusData.ts` y `useMenuForm.ts`) y el archivo `useDebounce.ts`:

```typescript
import { useState, useEffect } from 'react';

export function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState(value);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);

    return debouncedValue;
}
```

- [ ] **Step 2: Verificar typecheck y lint**

Run: `npm run build && npm run lint`
Expected: build OK, lint OK.

- [ ] **Step 3: Commit**

```bash
git add src/features/menus/hooks/useDebounce.ts
git commit -m "feat: add useDebounce hook"
```

---

### Task 3: Crear modal `ChildAllergensModal`

**Files:**
- Create: `src/features/menus/components/ChildAllergensModal.tsx`

- [ ] **Step 1: Crear el componente**

Crea `ChildAllergensModal.tsx` en `src/features/menus/components/`:

```tsx
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
    const [allergens, setAllergens] = useState<Allergen[]>([]);
    const [selectedAllergens, setSelectedAllergens] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && child) {
            setSelectedAllergens(child.child_allergens?.map(a => a.allergen_id) || []);
            setError(null);
            setIsLoading(true);
            AllergenService.getAll()
                .then(setAllergens)
                .catch(err => {
                    console.error(err);
                    setError('No se pudieron cargar los alérgenos');
                })
                .finally(() => setIsLoading(false));
        }
    }, [isOpen, child]);

    const toggleAllergen = (allergenId: string) => {
        setSelectedAllergens(prev =>
            prev.includes(allergenId)
                ? prev.filter(id => id !== allergenId)
                : [...prev, allergenId]
        );
    };

    const handleSave = async () => {
        if (!child) return;
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
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Editar alérgenos de ${child?.first_name} ${child?.last_name}`}
            size="md"
        >
            <div className="space-y-6">
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg text-center">
                        {error}
                    </div>
                )}

                <div className="space-y-2">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
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
        </Modal>
    );
};
```

- [ ] **Step 2: Verificar typecheck y lint**

Run: `npm run build && npm run lint`
Expected: build OK, lint OK.

- [ ] **Step 3: Commit**

```bash
git add src/features/menus/components/ChildAllergensModal.tsx
git commit -m "feat: add child allergens edit modal"
```

---

### Task 4: Añadir buscador y edición en `SpecialMenuChildrenList`

**Files:**
- Modify: `src/features/menus/components/SpecialMenuChildrenList.tsx` (reescribir el archivo completo)

- [ ] **Step 1: Reescribir el componente**

Reemplaza todo el contenido de `SpecialMenuChildrenList.tsx` por lo siguiente:

```tsx
import { useState, useEffect, useCallback } from 'react';
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

    const debouncedSearchTerm = useDebounce(searchTerm, 300);

    const fetchData = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);
            const [specialMenu, all] = await Promise.all([
                ChildService.getChildrenWithSpecialMenu(),
                ChildService.getAllChildren(),
            ]);
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

            <ChildAllergensModal
                child={selectedChild}
                isOpen={!!selectedChild}
                onClose={() => setSelectedChild(null)}
                onSaved={fetchData}
            />
        </div>
    );
};
```

- [ ] **Step 2: Verificar typecheck y lint**

Run: `npm run build && npm run lint`
Expected: build OK, lint OK.

- [ ] **Step 3: Verificación manual del flujo**

Ejecuta `npm run dev`, navega a Menús → Menús Especiales → pestaña "Niños" y comprueba:
1. El buscador aparece arriba con la lupa y placeholder "Buscar por nombre, clase o colegio...".
2. Al escribir, tras ~300ms aparecen resultados con Nombre, Apellido, Clase, Colegio, Alérgenos (badges ámbar) y botón "Editar".
3. Buscar un niño sin alérgenos muestra "Sin alérgenos".
4. Buscar texto sin coincidencias muestra "No se encontraron niños".
5. Al borrar el input, la tabla de resultados desaparece y queda solo la tabla de "niños con menú especial".
6. Clic en "Editar" abre el modal con los alérgenos actuales marcados.
7. Marcar/desmarcar y "Guardar cambios" actualiza tanto la tabla de resultados como la de menú especial.
8. La tabla inferior "X niños con menú especial" sigue funcionando.

- [ ] **Step 4: Commit**

```bash
git add src/features/menus/components/SpecialMenuChildrenList.tsx
git commit -m "feat: add child search with allergen editing to special menus"
```

---

## Self-Review

**Spec coverage:**
- ✅ `getAllChildren()` en `children.service.ts` (Task 1)
- ✅ Se mantiene `getChildrenWithSpecialMenu()` sin cambios (Task 1 no lo toca; Task 4 lo usa)
- ✅ Reutiliza `setChildAllergens()` (Task 3)
- ✅ Buscador con debounce 300ms, filtro por nombre/apellido/clase/colegio (Task 4)
- ✅ Resultados solo visibles con input no vacío (Task 4)
- ✅ Tabla compacta con badges de alérgenos y botón Editar (Task 4)
- ✅ Modal con checkboxes y estado marcado previo (Task 3)
- ✅ Refresco de ambas tablas al guardar (`onSaved={fetchData}`) (Task 4)
- ✅ Tabla inferior de menú especial intacta (Task 4)
- ✅ Estados: carga, sin resultados, error con reintentar, error al guardar (Tasks 3-4)

**Placeholder scan:** No hay TBD/TODO; todo paso incluye código completo.

**Type consistency:** `ChildWithSchool` usado de forma consistente en service, modal y list. `setChildAllergens(childId, allergenIds: string[])` coincide con la firma existente. `AllergenService.getAll()` retorna `Allergen[]`. `useDebounce<T>` es genérico y se usa con `string`.
