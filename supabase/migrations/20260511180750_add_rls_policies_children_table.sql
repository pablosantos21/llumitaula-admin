-- Create RLS policies for children table
-- Policy 1: Parents can view children they're linked to
CREATE POLICY "children_view_own_children" ON public.children
  FOR SELECT USING (
    id IN (
      SELECT child_id FROM public.parents_children 
      WHERE parent_id = auth.uid()
    )
  );

-- Policy 2: Monitors can view children in their schools
CREATE POLICY "children_view_monitor_schools" ON public.children
  FOR SELECT USING (
    class_id IN (
      SELECT c.id FROM public.classes c
      JOIN public.monitors_schools ms ON ms.school_id = c.school_id
      WHERE ms.monitor_id IN (
        SELECT id FROM public.monitors 
        WHERE code IS NOT NULL
      )
    )
  );

-- Policy 3: Admins can view all children
CREATE POLICY "children_admin_view_all" ON public.children
  FOR SELECT USING (
    auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin')
  );

-- Revoke default access
REVOKE SELECT ON public.children FROM anon, authenticated;
GRANT SELECT ON public.children TO authenticated;
