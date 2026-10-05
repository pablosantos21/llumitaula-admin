-- Contract test: a logical menu can be shared across schools.
--
-- Run against the scratch database built by scripts/test-db.sh, which imports
-- the `auth` schema, applies supabase/tests/setup.sql (minimal shared schema,
-- including the remote menus tenancy trigger) and then the migrations under
-- test. Everything runs inside a transaction and is rolled back.

begin;

select plan(5);

set local role postgres;

-- Deterministic fixtures: one menu, schools C (...301) and D (...302).

insert into public.schools (id, name) values
  ('00000000-0000-4000-8000-000000000301'::uuid, 'School C'),
  ('00000000-0000-4000-8000-000000000302'::uuid, 'School D');

insert into public.menus (id, first_course, second_course, side, salad, dessert, type) values
  ('00000000-0000-4000-8000-000000000801'::uuid,
   'Sopa', 'Main', 'Side', 'Salad', 'Dessert', 'normal');

insert into public.menus_schools (menu_id, school_id, date) values
  ('00000000-0000-4000-8000-000000000801'::uuid,
   '00000000-0000-4000-8000-000000000301'::uuid, date '2026-09-25');

select lives_ok(
  $$insert into public.menus_schools (menu_id, school_id, date)
    values ('00000000-0000-4000-8000-000000000801'::uuid,
            '00000000-0000-4000-8000-000000000302'::uuid, date '2026-09-25')$$,
  'a menu can be associated with a second school on the same date'
);

select is(
  (select count(*)::int from public.menus_schools
    where menu_id = '00000000-0000-4000-8000-000000000801'::uuid),
  2,
  'both school associations are stored for the same menu'
);

select lives_ok(
  $$insert into public.menus_schools (menu_id, school_id, date)
    values ('00000000-0000-4000-8000-000000000801'::uuid,
            '00000000-0000-4000-8000-000000000302'::uuid, date '2026-09-26')
    on conflict (menu_id, school_id) do update set date = excluded.date$$,
  'a school can be re-assigned to the same menu on another date'
);

select ok(
  not exists (
    select 1 from pg_trigger
     where tgrelid = 'public.menus_schools'::regclass and not tgisinternal
  ),
  'no trigger forces a menu to belong to a single school'
);

select ok(
  not exists (
    select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'enforce_menu_school_tenant'
  ),
  'enforce_menu_school_tenant is removed'
);

select * from finish();

rollback;
