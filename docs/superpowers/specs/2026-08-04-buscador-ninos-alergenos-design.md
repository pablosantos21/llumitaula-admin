# Buscador de niños en Menús Especiales

**Fecha:** 2026-08-04
**Estado:** Aprobado

## Objetivo

Añadir en la pestaña "Niños" de Menús Especiales un buscador que permita encontrar cualquier niño del sistema y editar sus alérgenos, manteniendo la tabla actual de niños con menú especial.

## Diseño

### 1. Datos y servicios (`children.service.ts`)

**Nuevo método `getAllChildren()`:**
- Consulta todos los niños de todas las escuelas (sin filtrar por `child_allergens`)
- Incluye joins: `classes!inner(id, name, school_id, schools(id, name))` y `child_allergens(allergen_id, allergens(id, name))`
- Retorna `ChildWithSchool[]` (tipado ya existente)

**Método existente `getChildrenWithSpecialMenu()`:** se mantiene sin cambios para la tabla inferior.

**Método existente `setChildAllergens(childId, allergenIds)`:** se reutiliza para guardar ediciones (delete + insert en `child_allergens`).

### 2. Layout y buscador (`SpecialMenuChildrenList.tsx`)

- Se añade una **sección de búsqueda** encima de la tabla existente, que:
  - Tiene un input con icono de lupa y placeholder "Buscar por nombre, clase o colegio..."
  - Aplica debounce de 300ms antes de filtrar
  - Al montar, carga todos los niños con `getAllChildren()`
  - Filtra client-side por nombre, apellido, clase o colegio

- **Resultados de búsqueda:**
  - Solo se muestran cuando hay texto en el input (al menos 1 carácter)
  - Tabla compacta con columnas: Nombre, Apellido, Clase, Colegio, Alérgenos (badges), Acción
  - Los alérgenos se muestran como badges (mismo estilo que el resto de la app)
  - Si un niño no tiene alérgenos, se muestra "Sin alérgenos"
  - Cada fila tiene un botón "Editar" que abre el modal de edición

- **Tabla inferior existente:** se mantiene sin cambios, mostrando la lista de niños con menú especial.

### 3. Modal de edición de alérgenos (`ChildAllergensModal.tsx`)

**Nuevo componente** en `features/menus/components/`:

- Recibe como props: `child` (ChildWithSchool), `isOpen`, `onClose`, `onSaved`
- Título: "Editar alérgenos de [Nombre Apellido]"
- Lista de checkboxes con todos los alérgenos disponibles (de `allergens` table)
- Los alérgenos que ya tiene el niño aparecen marcados
- Usa el método `getAllergens()` ya existente en `allergens.service.ts`
- Al guardar: llama a `setChildAllergens(childId, selectedIds)` y dispara `onSaved`
- `onSaved` refresca tanto los datos del buscador como la tabla inferior
- Botones: "Cancelar" (cierra sin cambios) y "Guardar cambios"

### 4. Estados

- **Carga inicial:** spinner mientras se cargan todos los niños
- **Búsqueda sin resultados:** mensaje "No se encontraron niños"
- **Error de carga:** mensaje de error con botón de reintentar
- **Error al guardar:** toast o mensaje de error en el modal
- **Éxito al guardar:** el modal se cierra y los datos se refrescan

### 5. Archivos afectados

| Archivo | Cambio |
|---|---|
| `src/services/children.service.ts` | Nuevo método `getAllChildren()` |
| `src/features/menus/components/SpecialMenuChildrenList.tsx` | Añadir sección de búsqueda |
| `src/features/menus/components/ChildAllergensModal.tsx` | **Nuevo** - Modal de edición |
