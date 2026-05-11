-- Create RLS policies for users table
-- Policy 1: Users can view their own profile
CREATE POLICY "users_view_own_profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

-- Policy 2: Admins can view all users
CREATE POLICY "users_admin_view_all" ON public.users
  FOR SELECT USING (
    auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin')
  );

-- Policy 3: Users can update their own profile (non-role fields)
CREATE POLICY "users_update_own_profile" ON public.users
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (
    -- Users cannot change their own role (only admins can)
    auth.uid() = id AND role = (SELECT role FROM public.users WHERE id = auth.uid())
  );

-- Policy 4: Admins can update any user
CREATE POLICY "users_admin_update" ON public.users
  FOR UPDATE USING (
    auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin')
  );

-- Ensure anon and authenticated cannot select by default
REVOKE SELECT ON public.users FROM anon, authenticated;
GRANT SELECT ON public.users TO authenticated;
