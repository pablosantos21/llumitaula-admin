-- Un menu es una fila logica compartida por todos los colegios donde se sirve:
-- `menus` guarda los platos y `menus_schools` guarda una fila por
-- (menu, colegio, fecha). El trigger `menus_schools_same_school`, creado en la
-- migracion remota 20260918104703_fix_menus_schools_insert_recursion, prohibia
-- justo ese modelo y hacia fallar cualquier guardado en varios colegios con
-- `23514: menus_schools cannot associate a menu across schools`.
--
-- El aislamiento no se pierde: las politicas RLS de `menus` y `menus_schools`
-- ya limitan la escritura al rol `admin` (menus_admin_insert/update/delete y
-- menus_schools_admin_insert/update/delete), y el trigger se ejecutaba como
-- SECURITY DEFINER sin comprobar el rol, es decir sin anadir un gate real.
drop trigger if exists menus_schools_same_school on public.menus_schools;
drop function if exists public.enforce_menu_school_tenant();
