-- Create RLS policies for parents_children table
-- Policy 1: Parents can view their own children relationships
CREATE POLICY "parents_children_view_own_relationships" ON public.parents_children
  FOR SELECT USING (parent_id = auth.uid());

-- Policy 2: Admins can view all relationships
CREATE POLICY "parents_children_admin_view_all" ON public.parents_children
  FOR SELECT USING (
    auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin')
  );

-- Revoke default access
REVOKE SELECT ON public.parents_children FROM anon, authenticated;
GRANT SELECT ON public.parents_children TO authenticated;
