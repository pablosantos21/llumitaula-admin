-- Allow admins to manage children across all schools (remove school scoping)
-- Previously, admins could only manage children in their own school_id,
-- which blocked operations when classes belonged to a different school.

DROP POLICY IF EXISTS children_admin_insert ON public.children;
CREATE POLICY children_admin_insert ON public.children
  FOR INSERT TO authenticated
  WITH CHECK (current_user_role() = 'admin');

DROP POLICY IF EXISTS children_admin_update ON public.children;
CREATE POLICY children_admin_update ON public.children
  FOR UPDATE TO authenticated
  USING (current_user_role() = 'admin')
  WITH CHECK (current_user_role() = 'admin');

DROP POLICY IF EXISTS children_admin_delete ON public.children;
CREATE POLICY children_admin_delete ON public.children
  FOR DELETE TO authenticated
  USING (current_user_role() = 'admin');
