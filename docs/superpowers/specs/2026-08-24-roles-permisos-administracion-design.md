# Roles y Permisos de Administración

## Objetivo

Añadir soporte para el rol `supervisor` y restringir las secciones de administración a usuarios con rol `admin` o `supervisor`, manteniendo el acceso general autenticado y las redirecciones existentes.

## Alcance

- Ampliar el tipo `User.role` para aceptar `admin`, `supervisor` y `monitor`.
- Aplicar la autorización de administración en las rutas protegidas.
- Ocultar en la navegación las secciones que el usuario no puede administrar.
- Mantener el rol coherente al iniciar sesión, recuperar una sesión existente y reaccionar a cambios de autenticación.
- No cambiar en esta subtarea las políticas de Supabase ni los datos persistidos de usuarios.

## Diseño

`ProtectedRoute` continuará comprobando únicamente si existe una sesión autenticada. Se añadirá un guard específico para administración que permita únicamente los roles `admin` y `supervisor`. Las rutas administrativas se agruparán bajo ese guard; las rutas autenticadas no administrativas seguirán usando solo `ProtectedRoute`.

La navegación consultará el mismo rol expuesto por `useAuth`. Los usuarios `monitor` no verán enlaces de administración y tampoco podrán acceder escribiendo directamente la URL. La UI no se considerará una frontera de seguridad: las políticas RLS del backend seguirán siendo la autorización definitiva.

## Manejo de acceso denegado

- Usuario no autenticado: redirección a `/login`.
- Usuario autenticado sin permisos administrativos: redirección a `/select-school`.
- Usuario `admin` o `supervisor`: acceso normal a las rutas administrativas.

## Verificación

- Comprobar el tipo y la transformación del rol en login, sesión persistida y cambios de autenticación.
- Comprobar el acceso permitido para `admin` y `supervisor`.
- Comprobar el rechazo de `monitor` en acceso directo a una ruta administrativa.
- Ejecutar `npm run build`.
- Ejecutar `npm run lint`.

## Fuera de alcance

- Gestión de usuarios desde la UI.
- Cambios de contraseña o configuración de autenticación.
- Creación o modificación de migraciones RLS.
- Implementación de las subtareas posteriores de aulas, trabajadores, dispositivos o historial.
