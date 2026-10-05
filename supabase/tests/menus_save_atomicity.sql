-- Contract test: saving a menu and its schools is atomic.
--
-- The admin used to save a menu with two independent statements (upsert `menus`
-- then delete + insert on `menus_schools`). A failed assignment left the menu row
-- behind with no schools: an orphan the daily list no longer shows, which is how
-- a school's normal menu silently disappeared while its special menus stayed.
--
-- Run against the scratch database built by scripts/test-db.sh. Everything runs
-- inside a transaction and is rolled back.

begin;

select plan(16);

set local role postgres;

-- Deterministic fixtures: schools A (...401), B (...402), C (...403) and a
-- menu M0 (...901) already served at school A on 2026-09-25.

insert into public.schools (id, name) values
  ('00000000-0000-4000-8000-000000000401'::uuid, 'School A'),
  ('00000000-0000-4000-8000-000000000402'::uuid, 'School B'),
  ('00000000-0000-4000-8000-000000000403'::uuid, 'School C');

insert into public.menus (id, first_course, second_course, side, salad, dessert, type) values
  ('00000000-0000-4000-8000-000000000901'::uuid,
   'Lentejas', 'Sepia', 'Patatas', 'A5', 'Natilla', 'normal');

insert into public.menus_schools (menu_id, school_id, date) values
  ('00000000-0000-4000-8000-000000000901'::uuid,
   '00000000-0000-4000-8000-000000000401'::uuid, date '2026-09-25');

-- ── Surface ──────────────────────────────────────────────────────────────────

select ok(
  to_regprocedure('public.save_menu_with_schools(uuid,jsonb,uuid[],date)') is not null,
  'save_menu_with_schools exists'
);

select ok(
  not exists (
    select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'save_menu_with_schools'
       and p.prosecdef
  ),
  'save_menu_with_schools is SECURITY INVOKER so RLS still gates writes'
);

select ok(
  has_function_privilege('authenticated', 'public.save_menu_with_schools(uuid,jsonb,uuid[],date)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.save_menu_with_schools(uuid,jsonb,uuid[],date)', 'EXECUTE')
  and not has_function_privilege('service_role', 'public.save_menu_with_schools(uuid,jsonb,uuid[],date)', 'EXECUTE'),
  'save_menu_with_schools is callable by authenticated only'
);

-- ── Creating a menu for several schools ──────────────────────────────────────

set local role authenticated;

create temp table tmp_created (menu_id uuid, served_on date);

insert into tmp_created (menu_id, served_on)
select public.save_menu_with_schools(
         null,
         '{"type":"normal","first_course":"Arroz","second_course":"Pollo","side":"Patatas","salad":"A5","dessert":"Yogur"}'::jsonb,
         array['00000000-0000-4000-8000-000000000401'::uuid,
               '00000000-0000-4000-8000-000000000402'::uuid],
         date '2026-09-25'
       ),
       date '2026-09-25';

select ok(
  (select menu_id from tmp_created) is not null,
  'creating a menu for several schools returns the new menu id'
);

select is(
  (select count(*)::int from public.menus_schools
    where menu_id = (select menu_id from tmp_created)),
  2,
  'the new menu is assigned to both schools'
);

select is(
  (select string_agg(school_id::text, ',' order by school_id)
     from public.menus_schools
    where menu_id = (select menu_id from tmp_created)),
  '00000000-0000-4000-8000-000000000401,00000000-0000-4000-8000-000000000402',
  'both schools are stored, no matter which order the client sent them'
);

select is(
  (select date from public.menus_schools
    where menu_id = (select menu_id from tmp_created)
    limit 1),
  date '2026-09-25',
  'the associations keep the requested date'
);

select is(
  (select first_course || '|' || second_course || '|' || type
     from public.menus where id = (select menu_id from tmp_created)),
  'Arroz|Pollo|normal',
  'the dishes are stored on the new menu'
);

-- ── A rejected save leaves nothing behind ────────────────────────────────────

select throws_ok(
  $$select public.save_menu_with_schools(
      null,
      '{"type":"normal","first_course":"Verdura","second_course":"Merluza","side":null,"salad":null,"dessert":null}'::jsonb,
      array['00000000-0000-4000-8000-000000000999'::uuid],
      date '2026-09-25'
    )$$,
  '23503',
  NULL,
  'an unknown school is rejected'
);

select is(
  (select count(*)::int from public.menus
    where first_course = 'Verdura' and second_course = 'Merluza'),
  0,
  'a failed save does not leave an orphan menu behind'
);

select is(
  (select count(*)::int from public.menus_schools
    where menu_id = (select menu_id from tmp_created)),
  2,
  'a failed save does not touch the schools of the previous menu'
);

-- ── Editing an existing menu ─────────────────────────────────────────────────

select is(
  public.save_menu_with_schools(
    '00000000-0000-4000-8000-000000000901'::uuid,
    '{"type":"normal","first_course":"Lentejas","second_course":"Sepia","side":null,"salad":"A5","dessert":"Natilla"}'::jsonb,
    array['00000000-0000-4000-8000-000000000402'::uuid,
          '00000000-0000-4000-8000-000000000403'::uuid],
    date '2026-09-25'
  ),
  '00000000-0000-4000-8000-000000000901'::uuid,
  'editing a menu keeps its id'
);

select is(
  (select count(*)::int from public.menus_schools
    where menu_id = '00000000-0000-4000-8000-000000000901'::uuid),
  2,
  'the edited menu is assigned to exactly the selected schools'
);

select is(
  (select string_agg(school_id::text, ',' order by school_id)
     from public.menus_schools
    where menu_id = '00000000-0000-4000-8000-000000000901'::uuid),
  '00000000-0000-4000-8000-000000000402,00000000-0000-4000-8000-000000000403',
  'the schools dropped from the menu lose their assignment'
);

select is(
  (select count(distinct date)::int from public.menus_schools
    where menu_id = '00000000-0000-4000-8000-000000000901'::uuid),
  1,
  'a menu is only ever served on one date'
);

select is(
  public.save_menu_with_schools(
    '00000000-0000-4000-8000-000000000901'::uuid,
    '{"type":"normal","first_course":"Lentejas","second_course":"Sepia","side":null,"salad":"A5","dessert":"Natilla"}'::jsonb,
    array['00000000-0000-4000-8000-000000000402'::uuid,
          '00000000-0000-4000-8000-000000000403'::uuid],
    date '2026-09-26'
  ),
  '00000000-0000-4000-8000-000000000901'::uuid,
  'moving a menu to another date is accepted'
);

select is(
  (select count(*)::int from public.menus_schools
    where menu_id = '00000000-0000-4000-8000-000000000901'::uuid
      and date = date '2026-09-26'),
  2,
  'the moved menu keeps every school on the new date'
);

-- ── Removing every school keeps the menu ─────────────────────────────────────

select public.save_menu_with_schools(
  '00000000-0000-4000-8000-000000000901'::uuid,
  '{"type":"normal","first_course":"Lentejas","second_course":"Sepia","side":null,"salad":"A5","dessert":"Natilla"}'::jsonb,
  '{}'::uuid[],
  date '2026-09-26'
);

select is(
  (select count(*)::int from public.menus_schools
    where menu_id = '00000000-0000-4000-8000-000000000901'::uuid),
  0,
  'saving with no schools clears the assignments'
);

select is(
  (select first_course from public.menus
    where id = '00000000-0000-4000-8000-000000000901'::uuid),
  'Lentejas',
  'the menu itself survives losing every school'
);

select * from finish();

rollback;
