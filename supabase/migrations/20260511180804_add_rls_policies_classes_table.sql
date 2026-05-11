-- Create RLS policies for classes table
-- Policy 1: Parents can view classes their children attend
CREATE POLICY "classes_view_parent_children_classes" ON public.classes
  FOR SELECT USING (
    id IN (
      SELECT DISTINCT ch.class_id FROM public.children ch
      JOIN public.parents_children pc ON pc.child_id = ch.id
      WHERE pc.parent_id = auth.uid()
    )
  );

-- Policy 2: Monitors can view classes in their schools
CREATE POLICY "classes_view_monitor_schools" ON public.classes
  FOR SELECT USING (
    school_id IN (
      SELECT school_id FROM public.monitors_schools
      WHERE monitor_id IN (
        SELECT id FROM public.monitors 
        WHERE code IS NOT NULL
      )
    )
  );

-- Policy 3: Admins can view all classes
CREATE POLICY "classes_admin_view_all" ON public.classes
  FOR SELECT USING (
    auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin')
  );

-- Revoke default access
REVOKE SELECT ON public.classes FROM anon, authenticated;
GRANT SELECT ON public.classes TO authenticated;
