-- Enable RLS on menus table
ALTER TABLE public.menus ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for menus table
-- Policy 1: Parents can view menus for their children's schools
CREATE POLICY "menus_view_parent_school_access" ON public.menus
  FOR SELECT USING (
    id IN (
      SELECT m.id FROM public.menus m
      JOIN public.menus_schools ms ON ms.menu_id = m.id
      JOIN public.schools s ON s.id = ms.school_id
      WHERE s.id IN (
        SELECT DISTINCT c.school_id FROM public.classes c
        JOIN public.children ch ON ch.class_id = c.id
        JOIN public.parents_children pc ON pc.child_id = ch.id
        WHERE pc.parent_id = auth.uid()
      )
    )
  );

-- Policy 2: Monitors can view menus for their schools
CREATE POLICY "menus_view_monitor_schools" ON public.menus
  FOR SELECT USING (
    id IN (
      SELECT m.id FROM public.menus m
      JOIN public.menus_schools ms ON ms.menu_id = m.id
      WHERE ms.school_id IN (
        SELECT school_id FROM public.monitors_schools
        WHERE monitor_id IN (
          SELECT id FROM public.monitors 
          WHERE code IS NOT NULL
        )
      )
    )
  );

-- Policy 3: Admins can view all menus
CREATE POLICY "menus_admin_view_all" ON public.menus
  FOR SELECT USING (
    auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin')
  );

-- Enable RLS on menus_schools table
ALTER TABLE public.menus_schools ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for menus_schools table
-- Policy 1: Parents can view menu dates for their children's schools
CREATE POLICY "menus_schools_view_parent_access" ON public.menus_schools
  FOR SELECT USING (
    school_id IN (
      SELECT DISTINCT c.school_id FROM public.classes c
      JOIN public.children ch ON ch.class_id = c.id
      JOIN public.parents_children pc ON pc.child_id = ch.id
      WHERE pc.parent_id = auth.uid()
    )
  );

-- Policy 2: Monitors can view menu dates for their schools
CREATE POLICY "menus_schools_view_monitor_schools" ON public.menus_schools
  FOR SELECT USING (
    school_id IN (
      SELECT school_id FROM public.monitors_schools
      WHERE monitor_id IN (
        SELECT id FROM public.monitors 
        WHERE code IS NOT NULL
      )
    )
  );

-- Policy 3: Admins can view all menu_schools entries
CREATE POLICY "menus_schools_admin_view_all" ON public.menus_schools
  FOR SELECT USING (
    auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin')
  );

-- Revoke default access
REVOKE SELECT ON public.menus FROM anon, authenticated;
REVOKE SELECT ON public.menus_schools FROM anon, authenticated;
GRANT SELECT ON public.menus TO authenticated;
GRANT SELECT ON public.menus_schools TO authenticated;
