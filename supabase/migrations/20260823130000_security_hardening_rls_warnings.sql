-- Security hardening: fix Supabase RLS/security advisor warnings
-- 1. Revoke all access from anon (app is authenticated-only; closes real REST data leak)
-- 2. Remove anon/authenticated EXECUTE on SECURITY DEFINER helpers after removing their use in policies
-- 3. Disable pg_graphql (app is REST-only) to clear GraphQL schema-exposure warnings
-- 4. Refactor policies to use auth.jwt() instead of is_admin()/parent_class_ids()

-- 1. anon has no legitimate access to any table/sequence
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;

-- 2. Remove anon + public EXECUTE on helper functions
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.parent_class_ids() FROM anon, public;

-- 3. Disable GraphQL extension (application is REST-only)
DROP EXTENSION IF EXISTS pg_graphql;

-- 4. Refactor policies that depended on SECURITY DEFINER helpers
-- is_admin() -> auth.jwt() ->> 'role' = 'admin'  (recursion-free, JWT role set by custom_access_token_hook)

DROP POLICY IF EXISTS "children_admin_view_all" ON public.children;
CREATE POLICY "children_admin_view_all" ON public.children
  FOR SELECT USING ((auth.jwt() ->> 'role') = 'admin');

DROP POLICY IF EXISTS "classes_admin_view_all" ON public.classes;
CREATE POLICY "classes_admin_view_all" ON public.classes
  FOR SELECT USING ((auth.jwt() ->> 'role') = 'admin');

DROP POLICY IF EXISTS "incidents_admin_view_all" ON public.incidents;
CREATE POLICY "incidents_admin_view_all" ON public.incidents
  FOR SELECT USING ((auth.jwt() ->> 'role') = 'admin');

DROP POLICY IF EXISTS "menus_admin_view_all" ON public.menus;
CREATE POLICY "menus_admin_view_all" ON public.menus
  FOR SELECT USING ((auth.jwt() ->> 'role') = 'admin');

DROP POLICY IF EXISTS "menus_admin_update" ON public.menus;
CREATE POLICY "menus_admin_update" ON public.menus
  FOR UPDATE USING ((auth.jwt() ->> 'role') = 'admin');

DROP POLICY IF EXISTS "menus_admin_delete" ON public.menus;
CREATE POLICY "menus_admin_delete" ON public.menus
  FOR DELETE USING ((auth.jwt() ->> 'role') = 'admin');

DROP POLICY IF EXISTS "menus_schools_admin_view_all" ON public.menus_schools;
CREATE POLICY "menus_schools_admin_view_all" ON public.menus_schools
  FOR SELECT USING ((auth.jwt() ->> 'role') = 'admin');

DROP POLICY IF EXISTS "menus_schools_admin_update" ON public.menus_schools;
CREATE POLICY "menus_schools_admin_update" ON public.menus_schools
  FOR UPDATE USING ((auth.jwt() ->> 'role') = 'admin');

DROP POLICY IF EXISTS "menus_schools_admin_delete" ON public.menus_schools;
CREATE POLICY "menus_schools_admin_delete" ON public.menus_schools
  FOR DELETE USING ((auth.jwt() ->> 'role') = 'admin');

DROP POLICY IF EXISTS "monitors_admin_view_all" ON public.monitors;
CREATE POLICY "monitors_admin_view_all" ON public.monitors
  FOR SELECT USING ((auth.jwt() ->> 'role') = 'admin');

DROP POLICY IF EXISTS "monitors_schools_admin_view_all" ON public.monitors_schools;
CREATE POLICY "monitors_schools_admin_view_all" ON public.monitors_schools
  FOR SELECT USING ((auth.jwt() ->> 'role') = 'admin');

DROP POLICY IF EXISTS "parents_children_admin_view_all" ON public.parents_children;
CREATE POLICY "parents_children_admin_view_all" ON public.parents_children
  FOR SELECT USING ((auth.jwt() ->> 'role') = 'admin');

DROP POLICY IF EXISTS "users_admin_view_all" ON public.users;
CREATE POLICY "users_admin_view_all" ON public.users
  FOR SELECT USING ((auth.jwt() ->> 'role') = 'admin');

DROP POLICY IF EXISTS "users_admin_update" ON public.users;
CREATE POLICY "users_admin_update" ON public.users
  FOR UPDATE USING ((auth.jwt() ->> 'role') = 'admin');

DROP POLICY IF EXISTS "schools_admin_view_all" ON public.schools;
CREATE POLICY "schools_admin_view_all" ON public.schools
  FOR SELECT USING ((auth.jwt() ->> 'role') = 'admin');

DROP POLICY IF EXISTS "schools_admin_update" ON public.schools;
CREATE POLICY "schools_admin_update" ON public.schools
  FOR UPDATE USING ((auth.jwt() ->> 'role') = 'admin');

DROP POLICY IF EXISTS "schools_admin_delete" ON public.schools;
CREATE POLICY "schools_admin_delete" ON public.schools
  FOR DELETE USING ((auth.jwt() ->> 'role') = 'admin');

-- parent_class_ids() -> inline subquery
DROP POLICY IF EXISTS "classes_view_parent_children_classes" ON public.classes;
CREATE POLICY "classes_view_parent_children_classes" ON public.classes
  FOR SELECT USING (
    id IN (
      SELECT DISTINCT ch.class_id FROM public.children ch
      JOIN public.parents_children pc ON pc.child_id = ch.id
      WHERE pc.parent_id = auth.uid()
    )
  );

-- Now that no policy uses the SECURITY DEFINER helpers, restrict EXECUTE to the owner
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.parent_class_ids() FROM authenticated;
