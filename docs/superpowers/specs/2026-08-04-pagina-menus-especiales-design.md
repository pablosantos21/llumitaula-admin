# Diseño: Página de Menús Especiales por Menú Base

**Fecha:** 2026-08-04
**Estado:** Aprobado

## Resumen

Reemplazar el modal `SpecialMenusMatrixModal` por una página dedicada `/menus/:menuId` que muestra el menú base y las variantes de menú especial generadas automáticamente a partir de las agrupaciones de alérgenos de los niños en los colegios asignados a ese menú.

## Motivación

Actualmente los menús especiales se configuran manualmente en un modal con una matriz de tipos predefinidos (`sin-gluten`, `vegetariano`, etc.). El nuevo enfoque deriva las variantes necesarias directamente de los datos reales: las combinaciones de alérgenos que tienen los niños de los colegios donde se sirve ese menú.

---

## 1. Enrutado

**Nueva ruta:** `/menus/:menuId` → `SpecialMenuPage`

```tsx
// App.tsx
<Route path="/menus/:menuId" element={<SpecialMenuPage />} />
```

**Navegación:**
- `MenuGroupCard` → botón "Configurar Menús Especiales" → `navigate(/menus/${group.menu.id})`
- La página tiene botón "← Volver" que navega a `/menus`

---

## 2. Modelo de Datos

### Consulta de agrupaciones de alérgenos

```sql
SELECT c.id AS child_id, c.first_name, c.last_name,
       array_agg(a.name ORDER BY a.name) AS alergenos
FROM children c
JOIN classes cl ON c.class_id = cl.id
JOIN child_allergens ca ON c.id = ca.child_id
JOIN allergens a ON ca.allergen_id = a.id
WHERE cl.school_id IN (schools_del_menu)
GROUP BY c.id
ORDER BY c.first_name;
```

Las agrupaciones se computan en JS agrupando por la combinación única de alérgenos. Cada agrupación se convierte en una columna de la tabla.

### Campo `menus.type`

Pasa a almacenar la agrupación como texto. Ejemplos:
- `"Gluten"`
- `"Lácteos"`
- `"Gluten + Lácteos"`

### Guardado

Cada variante se guarda como una fila en `menus` (type = agrupación) y se asigna a los mismos colegios/fecha vía `menus_schools`. Se reutilizan `MenuService.upsertMenu()` y `MenuService.assignMenuToSchools()`.

---

## 3. Componentes

### Archivos nuevos

| Archivo | Propósito |
|---------|-----------|
| `src/pages/menus/SpecialMenuPage.tsx` | Página principal de la ruta `/menus/:menuId` |
| `src/features/menus/hooks/useSpecialMenu.ts` | Hook: fetch del menú base, cálculo de agrupaciones, estado de edición, save |

### Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `src/App.tsx` | Nueva ruta `/menus/:menuId` |
| `src/pages/menus/MenusPage.tsx` | Eliminar `SpecialMenusMatrixModal` y su lógica |
| `src/features/menus/components/MenuGroupCard.tsx` | `onEditSpecial` → `navigate()` |
| `src/features/menus/hooks/useMenuForm.ts` | Eliminar `openMatrixModal`, `matrixData`, `updateMatrixField`, `handleSaveMatrix`, `isMatrixModalOpen`, `setIsMatrixModalOpen` |
| `src/features/menus/index.ts` | Exportar nuevo hook, eliminar export del modal |

### Archivos eliminados

| Archivo | Motivo |
|---------|--------|
| `src/features/menus/components/SpecialMenusMatrixModal.tsx` | Reemplazado por la nueva página |

### Estructura de la página

```
SpecialMenuPage
├── Header
│   ├── Botón "← Volver" (navigate a /menus)
│   ├── Título: "Menú <fecha> — <colegios>"
│   └── Resumen: "X niños con alérgenos · Y agrupaciones"
├── Tabla/Matriz (SpecialMenuMatrix)
│   ├── Columna 0: "Plato" (etiquetas: 1º, 2º, Guarnición, Ensalada, Postre)
│   ├── Columna 1: "Menú Base" (solo lectura, destacada visualmente)
│   └── Columnas 2..N: Una por cada agrupación (inputs editables, pre-rellenados con los valores del base)
│       └── Cabecera: nombre de la agrupación + badge con conteo de niños
└── Footer
    ├── Botón "Cancelar" (vuelve a /menus)
    └── Botón "Guardar Menús Especiales"
```

### Hook `useSpecialMenu(menuId)`

Estado y métodos:
- `menu` — datos del menú base + colegios + fecha
- `allergenGroups` — `{ name: string, children: Child[], count: number }[]`
- `matrixData` — `Record<string, { first_course, second_course, side, salad, dessert }>` inicializado con valores del base
- `isLoading` — estado de carga
- `isSaving` — estado de guardado
- `updateMatrixField(groupName, field, value)` — actualiza un campo
- `handleSave()` — guarda todas las variantes

---

## 4. Lo que NO cambia

- La pestaña "Menús Especiales" en `/menus` (SpecialMenusView con Alérgenos / Niños) se mantiene intacta.
- El modal `NormalMenuModal` para crear/editar el menú base se mantiene intacto.
- `CoverageCalendar`, `DailyProgramming`, `MenuGroupCard` (salvo el cambio del botón) se mantienen intactos.

---

## 5. Comportamiento

1. Admin crea/edita menú base (normal) para una fecha y colegios (flujo existente).
2. En `DailyProgramming`, en el `MenuGroupCard`, hace clic en "Configurar Menús Especiales".
3. Navega a `/menus/:menuId`.
4. La página carga el menú base, consulta los niños con alérgenos de los colegios asignados, y agrupa por combinaciones únicas de alérgenos.
5. Muestra la tabla con columna base (readonly) y una columna por agrupación, con los platos pre-rellenados con los valores del menú base.
6. El admin edita los platos de cada variante según necesite.
7. Al guardar, se hace upsert de cada variante como fila en `menus` y se asigna a los mismos colegios/fecha en `menus_schools`.
8. Si ya existían variantes previas para ese menú base, se reemplazan. Al guardar se eliminan las variantes antiguas del `menus` (type != 'normal' vinculadas a la misma fecha/colegios) y sus `menus_schools`, y se insertan las nuevas.
9. Si no hay niños con alérgenos en los colegios asignados, la tabla solo muestra la columna base con un mensaje "No hay niños con alérgenos en estos colegios".
