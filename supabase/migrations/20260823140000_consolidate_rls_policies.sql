-- Consolidate RLS policies: one permissive policy per (table, action), TO authenticated
-- Fixes performance lints: auth_rls_initplan (wrap auth.<fn>() in subselect) and multiple_permissive_policies
-- Removes all remaining is_admin()/parent_class_ids() references (functions are now owner-only)

-- admin predicate (recursion-free, JWT role set by custom_access_token_hook)
-- Uses (select auth.jwt()) to force initplan evaluation

-- ============ users ============
DROP POLICY IF EXISTS "Users insert own profile" ON public.users;
DROP POLICY IF EXISTS "Users update own profile" ON public.users;
DROP POLICY IF EXISTS "users_admin_update" ON public.users;
DROP POLICY IF EXISTS "users_admin_view_all" ON public.users;
DROP POLICY IF EXISTS "users_update_own_profile" ON public.users;
DROP POLICY IF EXISTS "users_view_own_profile" ON public.users;

CREATE POLICY "users_insert_own" ON public.users
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = id);
CREATE POLICY "users_select" ON public.users
  FOR SELECT TO authenticated USING ((select auth.uid()) = id OR (((select auth.jwt()) ->> 'role') = 'admin'));
CREATE POLICY "users_update" ON public.users
  FOR UPDATE TO authenticated USING ((select auth.uid()) = id OR (((select auth.jwt()) ->> 'role') = 'admin'))
  WITH CHECK ((select auth.uid()) = id OR (((select auth.jwt()) ->> 'role') = 'admin'));

-- ============ schools ============
DROP POLICY IF EXISTS "schools_admin_delete" ON public.schools;
DROP POLICY IF EXISTS "schools_admin_insert" ON public.schools;
DROP POLICY IF EXISTS "schools_admin_update" ON public.schools;
DROP POLICY IF EXISTS "schools_admin_view_all" ON public.schools;
DROP POLICY IF EXISTS "schools_public_select" ON public.schools;
DROP POLICY IF EXISTS "schools_view_monitor_assigned" ON public.schools;
DROP POLICY IF EXISTS "schools_view_parent_children_schools" ON public.schools;

CREATE POLICY "schools_select" ON public.schools
  FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "schools_insert" ON public.schools
  FOR INSERT TO authenticated WITH CHECK (((select auth.jwt()) ->> 'role') = 'admin');
CREATE POLICY "schools_update" ON public.schools
  FOR UPDATE TO authenticated USING (((select auth.jwt()) ->> 'role') = 'admin')
  WITH CHECK (((select auth.jwt()) ->> 'role') = 'admin');
CREATE POLICY "schools_delete" ON public.schools
  FOR DELETE TO authenticated USING (((select auth.jwt()) ->> 'role') = 'admin');

-- ============ classes ============
DROP POLICY IF EXISTS "admins can delete classes" ON public.classes;
DROP POLICY IF EXISTS "admins can insert classes" ON public.classes;
DROP POLICY IF EXISTS "admins can select classes" ON public.classes;
DROP POLICY IF EXISTS "admins can update classes" ON public.classes;
DROP POLICY IF EXISTS "classes_admin_view_all" ON public.classes;
DROP POLICY IF EXISTS "classes_public_select" ON public.classes;
DROP POLICY IF EXISTS "classes_view_monitor_schools" ON public.classes;
DROP POLICY IF EXISTS "classes_view_parent_children_classes" ON public.classes;

CREATE POLICY "classes_select" ON public.classes
  FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "classes_insert" ON public.classes
  FOR INSERT TO authenticated WITH CHECK (((select auth.jwt()) ->> 'role') = 'admin');
CREATE POLICY "classes_update" ON public.classes
  FOR UPDATE TO authenticated USING (((select auth.jwt()) ->> 'role') = 'admin')
  WITH CHECK (((select auth.jwt()) ->> 'role') = 'admin');
CREATE POLICY "classes_delete" ON public.classes
  FOR DELETE TO authenticated USING (((select auth.jwt()) ->> 'role') = 'admin');

-- ============ children ============
DROP POLICY IF EXISTS "Admins access all children" ON public.children;
DROP POLICY IF EXISTS "Monitors access children" ON public.children;
DROP POLICY IF EXISTS "Parents access children" ON public.children;
DROP POLICY IF EXISTS "admins can delete children" ON public.children;
DROP POLICY IF EXISTS "admins can insert children" ON public.children;
DROP POLICY IF EXISTS "admins can select children" ON public.children;
DROP POLICY IF EXISTS "admins can update children" ON public.children;
DROP POLICY IF EXISTS "children_admin_view_all" ON public.children;
DROP POLICY IF EXISTS "children_view_monitor_schools" ON public.children;
DROP POLICY IF EXISTS "children_view_own_children" ON public.children;

CREATE POLICY "children_select" ON public.children
  FOR SELECT TO authenticated USING (
    (((select auth.jwt()) ->> 'role') = 'admin')
    OR class_id IN (SELECT c.id FROM classes c JOIN monitors_schools ms ON ms.school_id = c.school_id
                    WHERE ms.monitor_id IN (SELECT id FROM monitors WHERE code IS NOT NULL))
    OR id IN (SELECT child_id FROM parents_children WHERE parent_id = (select auth.uid()))
  );
CREATE POLICY "children_insert" ON public.children
  FOR INSERT TO authenticated WITH CHECK (((select auth.jwt()) ->> 'role') = 'admin');
CREATE POLICY "children_update" ON public.children
  FOR UPDATE TO authenticated USING (((select auth.jwt()) ->> 'role') = 'admin')
  WITH CHECK (((select auth.jwt()) ->> 'role') = 'admin');
CREATE POLICY "children_delete" ON public.children
  FOR DELETE TO authenticated USING (((select auth.jwt()) ->> 'role') = 'admin');

-- ============ monitors ============
DROP POLICY IF EXISTS "Admins full access monitors" ON public.monitors;
DROP POLICY IF EXISTS "monitors_admin_view_all" ON public.monitors;
DROP POLICY IF EXISTS "monitors_public_select" ON public.monitors;

CREATE POLICY "monitors_select" ON public.monitors
  FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "monitors_insert" ON public.monitors
  FOR INSERT TO authenticated WITH CHECK (((select auth.jwt()) ->> 'role') = 'admin');
CREATE POLICY "monitors_update" ON public.monitors
  FOR UPDATE TO authenticated USING (((select auth.jwt()) ->> 'role') = 'admin')
  WITH CHECK (((select auth.jwt()) ->> 'role') = 'admin');
CREATE POLICY "monitors_delete" ON public.monitors
  FOR DELETE TO authenticated USING (((select auth.jwt()) ->> 'role') = 'admin');

-- ============ monitors_schools ============
DROP POLICY IF EXISTS "admin can insert monitor_school" ON public.monitors_schools;
DROP POLICY IF EXISTS "admins full access monitors_schools" ON public.monitors_schools;
DROP POLICY IF EXISTS "monitors_schools_admin_view_all" ON public.monitors_schools;
DROP POLICY IF EXISTS "monitors_schools_public_select" ON public.monitors_schools;

CREATE POLICY "monitors_schools_select" ON public.monitors_schools
  FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "monitors_schools_insert" ON public.monitors_schools
  FOR INSERT TO authenticated WITH CHECK (((select auth.jwt()) ->> 'role') = 'admin');
CREATE POLICY "monitors_schools_update" ON public.monitors_schools
  FOR UPDATE TO authenticated USING (((select auth.jwt()) ->> 'role') = 'admin')
  WITH CHECK (((select auth.jwt()) ->> 'role') = 'admin');
CREATE POLICY "monitors_schools_delete" ON public.monitors_schools
  FOR DELETE TO authenticated USING (((select auth.jwt()) ->> 'role') = 'admin');

-- ============ incidents ============
DROP POLICY IF EXISTS "Admins access all incidents" ON public.incidents;
DROP POLICY IF EXISTS "Monitors access incidents" ON public.incidents;
DROP POLICY IF EXISTS "Parents access incidents" ON public.incidents;
DROP POLICY IF EXISTS "incidents_admin_view_all" ON public.incidents;
DROP POLICY IF EXISTS "incidents_monitor_insert" ON public.incidents;
DROP POLICY IF EXISTS "incidents_view_monitor_school_children" ON public.incidents;
DROP POLICY IF EXISTS "incidents_view_parent_children_incidents" ON public.incidents;

CREATE POLICY "incidents_select" ON public.incidents
  FOR SELECT TO authenticated USING (
    (((select auth.jwt()) ->> 'role') = 'admin')
    OR child_id IN (SELECT ch.id FROM children ch JOIN classes c ON c.id = ch.class_id
                    JOIN monitors_schools ms ON ms.school_id = c.school_id
                    WHERE ms.monitor_id IN (SELECT id FROM monitors WHERE code IS NOT NULL))
    OR child_id IN (SELECT child_id FROM parents_children WHERE parent_id = (select auth.uid()))
  );
CREATE POLICY "incidents_insert" ON public.incidents
  FOR INSERT TO authenticated WITH CHECK (
    (((select auth.jwt()) ->> 'role') = 'admin')
    OR child_id IN (SELECT ch.id FROM children ch JOIN classes c ON c.id = ch.class_id
                    JOIN monitors_schools ms ON ms.school_id = c.school_id
                    WHERE ms.monitor_id IN (SELECT id FROM monitors WHERE code IS NOT NULL))
  );
CREATE POLICY "incidents_update" ON public.incidents
  FOR UPDATE TO authenticated USING (((select auth.jwt()) ->> 'role') = 'admin')
  WITH CHECK (((select auth.jwt()) ->> 'role') = 'admin');
CREATE POLICY "incidents_delete" ON public.incidents
  FOR DELETE TO authenticated USING (((select auth.jwt()) ->> 'role') = 'admin');

-- ============ menus ============
DROP POLICY IF EXISTS "Admins access all menus" ON public.menus;
DROP POLICY IF EXISTS "Monitors access menus" ON public.menus;
DROP POLICY IF EXISTS "Parents access menus" ON public.menus;
DROP POLICY IF EXISTS "admins full access menus" ON public.menus;
DROP POLICY IF EXISTS "menus_admin_delete" ON public.menus;
DROP POLICY IF EXISTS "menus_admin_insert" ON public.menus;
DROP POLICY IF EXISTS "menus_admin_update" ON public.menus;
DROP POLICY IF EXISTS "menus_admin_view_all" ON public.menus;

CREATE POLICY "menus_select" ON public.menus
  FOR SELECT TO authenticated USING (
    (((select auth.jwt()) ->> 'role') = 'admin')
    OR id IN (SELECT m.id FROM menus m JOIN menus_schools ms ON ms.menu_id = m.id
              WHERE ms.school_id IN (SELECT school_id FROM monitors_schools
                                     WHERE monitor_id IN (SELECT id FROM monitors WHERE code IS NOT NULL)))
    OR id IN (SELECT m.id FROM menus m JOIN menus_schools ms ON ms.menu_id = m.id
              JOIN schools s ON s.id = ms.school_id
              WHERE s.id IN (SELECT DISTINCT c.school_id FROM classes c
                             JOIN children ch ON ch.class_id = c.id
                             JOIN parents_children pc ON pc.child_id = ch.id
                             WHERE pc.parent_id = (select auth.uid())))
  );
CREATE POLICY "menus_insert" ON public.menus
  FOR INSERT TO authenticated WITH CHECK (((select auth.jwt()) ->> 'role') = 'admin');
CREATE POLICY "menus_update" ON public.menus
  FOR UPDATE TO authenticated USING (((select auth.jwt()) ->> 'role') = 'admin')
  WITH CHECK (((select auth.jwt()) ->> 'role') = 'admin');
CREATE POLICY "menus_delete" ON public.menus
  FOR DELETE TO authenticated USING (((select auth.jwt()) ->> 'role') = 'admin');

-- ============ menus_schools ============
DROP POLICY IF EXISTS "admins full access menus_schools" ON public.menus_schools;
DROP POLICY IF EXISTS "menus_schools_admin_delete" ON public.menus_schools;
DROP POLICY IF EXISTS "menus_schools_admin_insert" ON public.menus_schools;
DROP POLICY IF EXISTS "menus_schools_admin_update" ON public.menus_schools;
DROP POLICY IF EXISTS "menus_schools_admin_view_all" ON public.menus_schools;
DROP POLICY IF EXISTS "menus_schools_view_monitor_schools" ON public.menus_schools;
DROP POLICY IF EXISTS "menus_schools_view_parent_access" ON public.menus_schools;

CREATE POLICY "menus_schools_select" ON public.menus_schools
  FOR SELECT TO authenticated USING (
    (((select auth.jwt()) ->> 'role') = 'admin')
    OR school_id IN (SELECT school_id FROM monitors_schools
                     WHERE monitor_id IN (SELECT id FROM monitors WHERE code IS NOT NULL))
    OR school_id IN (SELECT DISTINCT c.school_id FROM classes c
                     JOIN children ch ON ch.class_id = c.id
                     JOIN parents_children pc ON pc.child_id = ch.id
                     WHERE pc.parent_id = (select auth.uid()))
  );
CREATE POLICY "menus_schools_insert" ON public.menus_schools
  FOR INSERT TO authenticated WITH CHECK (((select auth.jwt()) ->> 'role') = 'admin');
CREATE POLICY "menus_schools_update" ON public.menus_schools
  FOR UPDATE TO authenticated USING (((select auth.jwt()) ->> 'role') = 'admin')
  WITH CHECK (((select auth.jwt()) ->> 'role') = 'admin');
CREATE POLICY "menus_schools_delete" ON public.menus_schools
  FOR DELETE TO authenticated USING (((select auth.jwt()) ->> 'role') = 'admin');

-- ============ allergens ============
DROP POLICY IF EXISTS "allergens_admin_all" ON public.allergens;
DROP POLICY IF EXISTS "allergens_view_authenticated" ON public.allergens;

CREATE POLICY "allergens_select" ON public.allergens
  FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "allergens_insert" ON public.allergens
  FOR INSERT TO authenticated WITH CHECK (((select auth.jwt()) ->> 'role') = 'admin');
CREATE POLICY "allergens_update" ON public.allergens
  FOR UPDATE TO authenticated USING (((select auth.jwt()) ->> 'role') = 'admin')
  WITH CHECK (((select auth.jwt()) ->> 'role') = 'admin');
CREATE POLICY "allergens_delete" ON public.allergens
  FOR DELETE TO authenticated USING (((select auth.jwt()) ->> 'role') = 'admin');

-- ============ child_allergens ============
DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON public.child_allergens;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.child_allergens;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.child_allergens;
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON public.child_allergens;

CREATE POLICY "child_allergens_select" ON public.child_allergens
  FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "child_allergens_insert" ON public.child_allergens
  FOR INSERT TO authenticated WITH CHECK (TRUE);
CREATE POLICY "child_allergens_update" ON public.child_allergens
  FOR UPDATE TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "child_allergens_delete" ON public.child_allergens
  FOR DELETE TO authenticated USING (TRUE);

-- ============ parents_children ============
DROP POLICY IF EXISTS "Admins access all parents_children" ON public.parents_children;
DROP POLICY IF EXISTS "Monitors access parents_children" ON public.parents_children;
DROP POLICY IF EXISTS "Parents access own children" ON public.parents_children;
DROP POLICY IF EXISTS "parents_children_admin_view_all" ON public.parents_children;
DROP POLICY IF EXISTS "parents_children_view_own_relationships" ON public.parents_children;

CREATE POLICY "parents_children_select" ON public.parents_children
  FOR SELECT TO authenticated USING (
    (((select auth.jwt()) ->> 'role') = 'admin')
    OR ((select auth.jwt()) ->> 'role') = 'monitor'
    OR parent_id = (select auth.uid())
  );
CREATE POLICY "parents_children_insert" ON public.parents_children
  FOR INSERT TO authenticated WITH CHECK (((select auth.jwt()) ->> 'role') = 'admin');
CREATE POLICY "parents_children_update" ON public.parents_children
  FOR UPDATE TO authenticated USING (((select auth.jwt()) ->> 'role') = 'admin')
  WITH CHECK (((select auth.jwt()) ->> 'role') = 'admin');
CREATE POLICY "parents_children_delete" ON public.parents_children
  FOR DELETE TO authenticated USING (((select auth.jwt()) ->> 'role') = 'admin');

-- Remove the now-unused SECURITY DEFINER helpers
DROP FUNCTION IF EXISTS public.is_admin();
DROP FUNCTION IF EXISTS public.parent_class_ids();
