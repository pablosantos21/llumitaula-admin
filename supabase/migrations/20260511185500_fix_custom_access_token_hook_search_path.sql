-- Fix search_path vulnerability on custom_access_token_hook function
-- This prevents privilege escalation through mutable search_path

-- Set explicit search_path on the function
ALTER FUNCTION public.custom_access_token_hook(event jsonb) 
SET search_path = public;

-- Revoke EXECUTE permissions from anonymous and authenticated roles
-- Only postgres (auth internal use) should execute this SECURITY DEFINER function
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook(event jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook(event jsonb) FROM authenticated;

-- Ensure only postgres can execute (used by auth internally)
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(event jsonb) TO postgres;
