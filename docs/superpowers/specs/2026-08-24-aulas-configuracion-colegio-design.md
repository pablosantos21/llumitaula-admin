# Aulas y Configuración del Colegio

## Objetivo

Añadir la gestión administrativa de aulas y permitir editar el nombre del colegio seleccionado, conservando las relaciones existentes y evitando borrados destructivos.

## Alcance

- Añadir `classes.is_active` como estado persistido, obligatorio y con valor inicial `true`.
- Crear la página administrativa `/school/:schoolId/classes`.
- Listar, crear, editar, desactivar y reactivar aulas.
- Mantener las aulas inactivas visibles en la página de gestión, claramente marcadas.
- Excluir aulas inactivas de nuevas asignaciones.
- Mantener asignaciones existentes de niños a aulas que después se desactiven.
- Permitir editar únicamente el nombre del colegio, porque el esquema actual no contiene otros campos de configuración.

## Diseño

`ClassService` devolverá `is_active` y expondrá operaciones separadas para actualizar el nombre y el estado de un aula. La página de aulas cargará el colegio y sus aulas, mostrará el estado y usará formularios para alta y edición. Desactivar o reactivar requerirá una confirmación explícita.

`SchoolService` añadirá una operación de actualización del nombre y conservará el contrato existente de `School`. La página podrá actualizar su encabezado local después de guardar correctamente.

Los selectores de aula usados al crear o editar niños y en futuras asignaciones recibirán únicamente aulas activas. Esta exclusión se hará en la capa de datos presentada a los formularios, no eliminando aulas inactivas de las consultas administrativas.

La ruta estará bajo el guard administrativo existente, por lo que solo usuarios `admin` y `supervisor` podrán acceder a ella.

## Base de datos

La migración añadirá:

```sql
ALTER TABLE public.classes
ADD COLUMN is_active boolean NOT NULL DEFAULT true;
```

No se eliminarán aulas ni se modificarán automáticamente niños, trabajadores u otros registros relacionados al cambiar el estado.

## Manejo de errores

- Mostrar estado de carga durante la consulta inicial y las operaciones de guardado.
- Mostrar un mensaje de error si falla la carga o cualquier mutación.
- Mantener el formulario abierto cuando una mutación falle para no perder los datos introducidos.
- Deshabilitar acciones mientras la operación correspondiente está en curso.

## Verificación

- Verificar la migración y el valor por defecto de `is_active`.
- Verificar alta, edición, desactivación y reactivación desde la UI.
- Verificar que las aulas inactivas permanecen visibles en gestión.
- Verificar que los selectores de nuevas asignaciones excluyen aulas inactivas.
- Verificar la edición del nombre del colegio.
- Ejecutar `npm run build` y `npm run lint`.

## Fuera de alcance

- Otros campos de configuración del colegio.
- Eliminación física de aulas.
- Migración o edición de asignaciones existentes.
- Gestión de trabajadores, dispositivos o historial.
