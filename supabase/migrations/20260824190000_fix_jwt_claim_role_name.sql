-- Fix custom_access_token_hook: store role as 'role' not 'user_role'
-- All RLS policies check auth.jwt() ->> 'role' but the hook was writing to 'user_role',
-- causing every role-based RLS check to silently fail (returned NULL).

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  claims jsonb := coalesce(event->'claims', '{}'::jsonb);
  profile_role public.user_role;
  profile_school_id uuid;
  profile_active boolean;
begin
  select u.role, u.school_id, u.active
    into profile_role, profile_school_id, profile_active
    from public.users u
   where u.id = (event->>'user_id')::uuid;

  claims := jsonb_set(claims, '{role}', coalesce(to_jsonb(profile_role), 'null'::jsonb), true);
  claims := jsonb_set(claims, '{school_id}', coalesce(to_jsonb(profile_school_id), 'null'::jsonb), true);
  claims := jsonb_set(claims, '{active}', coalesce(to_jsonb(profile_active), 'false'::jsonb), true);
  return jsonb_set(event, '{claims}', claims, true);
end;
$$;
