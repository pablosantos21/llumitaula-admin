-- Enable RLS on incidents table if not already enabled
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;

-- Policy 1: Parents can view incidents for their children
CREATE POLICY "incidents_view_parent_children_incidents" ON public.incidents
  FOR SELECT USING (
    child_id IN (
      SELECT child_id FROM public.parents_children 
      WHERE parent_id = auth.uid()
    )
  );

-- Policy 2: Monitors can view incidents for children in their schools
CREATE POLICY "incidents_view_monitor_school_children" ON public.incidents
  FOR SELECT USING (
    child_id IN (
      SELECT ch.id FROM public.children ch
      JOIN public.classes c ON c.id = ch.class_id
      JOIN public.monitors_schools ms ON ms.school_id = c.school_id
      WHERE ms.monitor_id IN (
        SELECT id FROM public.monitors 
        WHERE code IS NOT NULL
      )
    )
  );

-- Policy 3: Admins can view all incidents
CREATE POLICY "incidents_admin_view_all" ON public.incidents
  FOR SELECT USING (
    auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin')
  );

-- Policy 4: Monitors can insert incidents for children in their schools
CREATE POLICY "incidents_monitor_insert" ON public.incidents
  FOR INSERT WITH CHECK (
    child_id IN (
      SELECT ch.id FROM public.children ch
      JOIN public.classes c ON c.id = ch.class_id
      JOIN public.monitors_schools ms ON ms.school_id = c.school_id
      WHERE ms.monitor_id IN (
        SELECT id FROM public.monitors 
        WHERE code IS NOT NULL
      )
    )
  );

-- Revoke default access
REVOKE SELECT ON public.incidents FROM anon, authenticated;
GRANT SELECT ON public.incidents TO authenticated;
