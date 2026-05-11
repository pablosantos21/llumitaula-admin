-- Further restrict permissions on custom_access_token_hook
-- Revoke all public access, keep only postgres for auth internal use

REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook(event jsonb) FROM public;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook(event jsonb) FROM service_role;
