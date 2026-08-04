# Alérgenos y Menús Especiales

**Fecha:** 2026-08-04
**Estado:** Diseño aprobado

---

## Resumen

Añadir una segunda pestaña "Menús Especiales" en la página `/menus` que permita:
1. Gestionar alérgenos (CRUD) desde la base de datos
2. Listar los niños que tienen `special_menu = true`

---

## Backend (Supabase)

### Nueva tabla: `allergens`

| Columna | Tipo | Restricciones |
|---------|------|---------------|
| `id` | uuid | PK, default gen_random_uuid() |
| `name` | text | NOT NULL, UNIQUE |

### Migración en `children`

Añadir columna `special_menu`:

| Columna | Tipo | Default |
|---------|------|---------|
| `special_menu` | boolean | false |

### Nuevo servicio: `allergens.service.ts`

```
AllergenService {
  getAll(): Promise<Allergen[]>
  create(name: string): Promise<Allergen>
  update(id: string, name: string): Promise<Allergen>
  delete(id: string): Promise<void>
}
```

---

## Frontend

### Modificaciones

| Archivo | Cambio |
|---------|--------|
| `MenuHeader.tsx` | Añadir dos pestañas: "Gestión de Menús" y "Menús Especiales". Recibe prop `activeTab` y callback `onTabChange`. |
| `MenusPage.tsx` | Añadir estado `activeTab` ("menus" | "especiales"). Renderiza condicionalmente el contenido según la pestaña. |
| `menu.service.ts` | Añadir método `getChildrenWithSpecialMenu()` con join a `classes` y `schools`. |
| `constants/allergens.ts` | Eliminar array `ALLERGENS` hardcodeado (se sustituye por datos de BD). |

### Componentes nuevos

| Componente | Función |
|------------|---------|
| `SpecialMenusView` | Contenedor con dos sub-pestañas internas: "Alérgenos" y "Niños" |
| `AllergensManager` | Tabla con filas de alérgenos + botón "Añadir" + acciones por fila (editar, eliminar). Modal para crear/editar nombre. |
| `SpecialMenuChildrenList` | Tabla informativa mostrando: first_name, last_name, clase, colegio. Filtrada por `special_menu = true`. |

### Flujo de datos

- `MenusPage` mantiene estado `activeTab` con `useState<"menus" | "especiales">`
- `MenuHeader` recibe `activeTab` y `onTabChange` como props
- Cuando `activeTab === "especiales"`, se renderiza `<SpecialMenusView />` en lugar del calendario
- `SpecialMenusView` usa su propio estado interno para las sub-pestañas: "alergenos" | "ninos"
- `AllergensManager` hace fetch vía `AllergenService.getAll()` al montar, refresca tras cada operación CRUD
- `SpecialMenuChildrenList` hace una única consulta con join al montar

---

## Estilo

- Seguir los mismos patrones visuales existentes: indigo-600 para activo, cards blancas con rounded-xl y shadow-sm
- Las pestañas del header usan el mismo estilo que los tabs de navegación del sidebar
