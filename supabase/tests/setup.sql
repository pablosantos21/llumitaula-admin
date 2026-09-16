-- Minimal fixture schema for the admin device config-code contract tests.
--
-- The real tenant schema lives on the shared project (worker base migrations +
-- live remote baseline), so the full admin migration set cannot be applied on
-- a bare Postgres. This file reproduces only the objects the two admin RPC
-- migrations under test depend on, so the pgTAP suite can run against a
-- deterministic scratch database. Column shapes mirror the migration that
-- originally created each object.
--
-- The `auth` schema (auth.users, auth.jwt(), auth.uid()) is imported by
-- scripts/test-db.sh before this file runs. pgcrypto (digest, etc.) mirrors
-- the supabase image layout: installed into the `extensions` schema.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
grant usage on schema extensions to anon, authenticated;

create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null
);

do $$
begin
  create type public.user_role as enum ('admin', 'monitor', 'padre', 'worker', 'supervisor');
exception when duplicate_object then null;
end $$;

create table if not exists public.users (
  id uuid primary key,
  role public.user_role not null,
  school_id uuid not null references public.schools(id),
  full_name text,
  active boolean not null default true,
  created_at timestamptz default now()
);

-- Devices mirror the shared schema: the fase-2 layout plus the claim columns
-- added by the worker's device_claims migration.
create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id),
  name text not null,
  identifier text,
  active boolean not null default true,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  config_code_hash text,
  config_code_expires_at timestamptz,
  config_code_created_at timestamptz,
  revoked_at timestamptz,
  revoked boolean not null default false
);

-- Same definition as admin migration 20260824150000 (workers administration).
create or replace function public.current_user_school_id()
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select school_id from public.users where id = auth.uid() and active;
$$;
revoke execute on function public.current_user_school_id() from public, anon;
grant execute on function public.current_user_school_id() to authenticated, service_role;

-- Supabase grants schema/table privileges to anon/authenticated by default and
-- relies on RLS for the actual gate; mirror that so table-level SQL behaves.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;

alter table public.schools enable row level security;
alter table public.users enable row level security;
alter table public.devices enable row level security;

-- Staff read access mirroring the remote devices_administration policies:
-- an admin sees everything, a supervisor only their own school.
create policy staff_read_devices on public.devices
  for select
  to authenticated
  using (
    (select auth.jwt() ->> 'role') = 'admin'
    or (
      (select auth.jwt() ->> 'role') = 'supervisor'
      and school_id = public.current_user_school_id()
    )
  );