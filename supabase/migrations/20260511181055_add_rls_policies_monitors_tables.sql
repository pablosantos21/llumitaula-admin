-- Enable RLS on monitors and monitors_schools tables
ALTER TABLE public.monitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monitors_schools ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for monitors table
-- Policy 1: Admins can view all monitors
CREATE POLICY "monitors_admin_view_all" ON public.monitors
  FOR SELECT USING (
    auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin')
  );

-- Create RLS policies for monitors_schools table
-- Policy 1: Admins can view all monitor-school assignments
CREATE POLICY "monitors_schools_admin_view_all" ON public.monitors_schools
  FOR SELECT USING (
    auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin')
  );

-- Revoke default access for anon and authenticated users
REVOKE SELECT ON public.monitors FROM anon, authenticated;
REVOKE SELECT ON public.monitors_schools FROM anon, authenticated;

-- Grant back SELECT for authenticated users (they'll still be restricted by RLS)
GRANT SELECT ON public.monitors TO authenticated;
GRANT SELECT ON public.monitors_schools TO authenticated;
