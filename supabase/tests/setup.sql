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
  create type public.user_role as enum ('admin', 'monitor', 'padre', 'parent', 'worker', 'supervisor');
exception when duplicate_object then null;
end $$;

create table if not exists public.users (
  id uuid primary key,
  role public.user_role not null,
  -- Kept nullable for compatibility with the older device RPC fixtures. The
  -- capability contract below authorizes through child/class relationships,
  -- never through this legacy column.
  school_id uuid references public.schools(id),
  full_name text,
  active boolean not null default true,
  created_at timestamptz default now()
);

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  school_id uuid references public.schools(id),
  is_active boolean not null default true
);

create table if not exists public.children (
  id uuid primary key default gen_random_uuid(),
  class_id uuid references public.classes(id) on delete set null,
  name text not null,
  active boolean not null default true
);

create table if not exists public.parents_children (
  parent_id uuid not null,
  child_id uuid not null references public.children(id) on delete cascade,
  primary key (parent_id, child_id)
);

create table if not exists public.worker_classrooms (
  worker_id uuid not null,
  class_id uuid not null references public.classes(id) on delete cascade,
  primary key (worker_id, class_id)
);

create table if not exists public.monitors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  school_id uuid not null references public.schools(id)
);

create table if not exists public.monitors_schools (
  monitor_id uuid not null references public.monitors(id) on delete cascade,
  school_id uuid not null references public.schools(id),
  primary key (monitor_id, school_id)
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

-- These helpers mirror the relationship contract installed by the shared
-- tenant migrations. In particular, `users.school_id` is not used to decide
-- whether a parent or monitor may read capability values.
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp, auth
as $$
  select u.role::text
    from public.users u
   where u.id = auth.uid()
     and u.active
$$;

create or replace function public.current_user_active()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp, auth
as $$
  select coalesce((select u.active from public.users u where u.id = auth.uid()), false)
$$;

create or replace function public.current_user_id()
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp, auth
as $$
  select auth.uid()
$$;

create schema if not exists private;

create or replace function private.current_user_monitor_school_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.school_id
    from public.monitors m
   where m.user_id = public.current_user_id()
     and m.school_id is not null
  union
  select ms.school_id
    from public.monitors_schools ms
    join public.monitors m on m.id = ms.monitor_id
   where m.user_id = public.current_user_id()
$$;

create or replace function private.current_user_can_access_class(p_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.current_user_active()
     and (
       public.current_user_role() = 'admin'
       or exists (
         select 1
           from public.classes c
          where c.id = p_class_id
            and (
              (
                public.current_user_role() = 'monitor'
                and c.school_id in (select private.current_user_monitor_school_ids())
              )
              or (
                public.current_user_role() = 'worker'
                and exists (
                  select 1
                    from public.worker_classrooms wc
                   where wc.class_id = c.id
                     and wc.worker_id = public.current_user_id()
                )
              )
              or (
                public.current_user_role() in ('parent', 'padre')
                and exists (
                  select 1
                    from public.children ch
                    join public.parents_children pc on pc.child_id = ch.id
                   where ch.class_id = c.id
                     and pc.parent_id = public.current_user_id()
                )
              )
            )
       )
     )
$$;

create or replace function private.current_user_can_access_child(p_child_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.current_user_active()
     and exists (
       select 1
         from public.children ch
         join public.classes cl on cl.id = ch.class_id
        where ch.id = p_child_id
          and (
            public.current_user_role() = 'admin'
            or public.current_user_role() = 'supervisor'
            or (
              public.current_user_role() = 'monitor'
              and cl.school_id in (select private.current_user_monitor_school_ids())
            )
            or exists (
              select 1
                from public.worker_classrooms wc
               where wc.class_id = cl.id
                 and wc.worker_id = public.current_user_id()
            )
            or exists (
              select 1
                from public.parents_children pc
               where pc.child_id = ch.id
                 and pc.parent_id = public.current_user_id()
            )
          )
      )
$$;

-- Supabase grants schema/table privileges to anon/authenticated by default and
-- relies on RLS for the actual gate; mirror that so table-level SQL behaves.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;

alter table public.schools enable row level security;
alter table public.users enable row level security;
alter table public.devices enable row level security;
alter table public.classes enable row level security;
alter table public.children enable row level security;

create policy users_admin_select on public.users
  for select
  to authenticated
  using (public.current_user_active() and public.current_user_role() = 'admin');

create policy classes_related_select on public.classes
  for select
  to authenticated
  using (
    public.current_user_active()
    and (
      public.current_user_role() = 'admin'
      or private.current_user_can_access_class(id)
    )
  );

create policy children_related_select on public.children
  for select
  to authenticated
  using (private.current_user_can_access_child(id));

-- Existing school SELECT behavior: admins and non-supervisors retain access,
-- while supervisors are scoped by the legacy users.school_id helper. The
-- capability migration adds an independent policy for explicit assignments.
create policy schools_existing_select on public.schools
  for select
  to authenticated
  using (
    public.current_user_active()
    and (
      public.current_user_role() <> 'supervisor'
      or id = public.current_user_school_id()
    )
  );

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
