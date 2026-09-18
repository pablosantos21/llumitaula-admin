-- The admin app calls create_monitor() as an authenticated admin user.
-- Security hardening revoked broad function privileges, so EXECUTE must be
-- granted explicitly. The function itself enforces that only admins can
-- create monitors.
REVOKE EXECUTE ON FUNCTION public.create_monitor(text, text, smallint, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_monitor(text, text, smallint, uuid) TO authenticated;
