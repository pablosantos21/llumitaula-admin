-- Contract test: saving special menus is atomic and isolated by school grouping.
--
-- Saving special menus for one school grouping (e.g. [School A, School B]) on a date
-- must never modify, delete, or overwrite special menus belonging to other school
-- groupings (e.g. [School C]) on the same date.
-- If saving fails, previously saved special menus for that grouping and date are preserved.
--
-- Run against the scratch database built by scripts/test-db.sh. Everything runs
-- inside a transaction and is rolled back.

begin;

select plan(20);

set local role postgres;

-- Deterministic fixtures: schools A (...401), B (...402), C (...403)
insert into public.schools (id, name) values
  ('00000000-0000-4000-8000-000000000401'::uuid, 'School A'),
  ('00000000-0000-4000-8000-000000000402'::uuid, 'School B'),
  ('00000000-0000-4000-8000-000000000403'::uuid, 'School C');

-- ── Surface ──────────────────────────────────────────────────────────────────

select ok(
  to_regprocedure('public.save_special_menus(uuid[],date,jsonb)') is not null,
  'save_special_menus exists'
);

select ok(
  not exists (
    select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'save_special_menus'
       and p.prosecdef
  ),
  'save_special_menus is SECURITY INVOKER so RLS still gates writes'
);

select ok(
  has_function_privilege('authenticated', 'public.save_special_menus(uuid[],date,jsonb)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.save_special_menus(uuid[],date,jsonb)', 'EXECUTE')
  and not has_function_privilege('service_role', 'public.save_special_menus(uuid[],date,jsonb)', 'EXECUTE'),
  'save_special_menus is callable by authenticated only'
);

-- ── Creating special menus for School Group [A, B] ───────────────────────────

set local role authenticated;

create temp table tmp_ab_menus (inserted_ids uuid[]);

insert into tmp_ab_menus (inserted_ids)
select public.save_special_menus(
  array['00000000-0000-4000-8000-000000000401'::uuid,
        '00000000-0000-4000-8000-000000000402'::uuid],
  date '2026-10-14',
  '[
    {"type":"sin-gluten","first_course":"Arroz SG","second_course":"Pollo SG","side":"Patatas","salad":null,"dessert":"Fruta"},
    {"type":"vegetariano","first_course":"Verdura","second_course":"Tofu","side":null,"salad":"A5","dessert":"Yogur"}
  ]'::jsonb
);

select is(
  cardinality((select inserted_ids from tmp_ab_menus)),
  2,
  'creating two special menus for [A, B] returns two menu ids'
);

select is(
  (select count(*)::int
     from public.menus_schools ms
     join public.menus m on m.id = ms.menu_id
    where ms.date = date '2026-10-14'
      and m.type <> 'normal'),
  4,
  'each of the two special menus is assigned to both School A and School B (2 * 2 = 4 rows)'
);

-- ── Creating special menus for School Group [C] on the SAME date ──────────────

create temp table tmp_c_menus (inserted_ids uuid[]);

insert into tmp_c_menus (inserted_ids)
select public.save_special_menus(
  array['00000000-0000-4000-8000-000000000403'::uuid],
  date '2026-10-14',
  '[
    {"type":"sin-gluten","first_course":"Pasta SG","second_course":"Pavo SG","side":null,"salad":null,"dessert":"Manzana"}
  ]'::jsonb
);

select is(
  cardinality((select inserted_ids from tmp_c_menus)),
  1,
  'creating special menu for School C returns one menu id'
);

select is(
  (select count(*)::int
     from public.menus_schools ms
     join public.menus m on m.id = ms.menu_id
    where ms.date = date '2026-10-14'
      and ms.school_id = '00000000-0000-4000-8000-000000000403'::uuid
      and m.type = 'sin-gluten'),
  1,
  'School C has its own sin-gluten menu on 2026-10-14'
);

select is(
  (select first_course
     from public.menus
    where id in (select unnest(inserted_ids) from tmp_c_menus)),
  'Pasta SG',
  'School C menu content is Pasta SG'
);

-- ── Updating special menus for [A, B] must NOT touch School C ────────────────

create temp table tmp_ab_updated (inserted_ids uuid[]);

insert into tmp_ab_updated (inserted_ids)
select public.save_special_menus(
  array['00000000-0000-4000-8000-000000000402'::uuid,
        '00000000-0000-4000-8000-000000000401'::uuid],
  date '2026-10-14',
  '[
    {"type":"sin-gluten","first_course":"Arroz SG v2","second_course":"Pollo SG v2","side":null,"salad":null,"dessert":"Platano"}
  ]'::jsonb
);

select is(
  cardinality((select inserted_ids from tmp_ab_updated)),
  1,
  'updating [A, B] replaces with one menu'
);

-- Verify School C special menu was completely unaffected
select is(
  (select count(*)::int
     from public.menus_schools ms
     join public.menus m on m.id = ms.menu_id
    where ms.date = date '2026-10-14'
      and ms.school_id = '00000000-0000-4000-8000-000000000403'::uuid
      and m.id in (select unnest(inserted_ids) from tmp_c_menus)),
  1,
  'isolation: School C special menu assignment is completely preserved'
);

select is(
  (select first_course
     from public.menus
    where id in (select unnest(inserted_ids) from tmp_c_menus)),
  'Pasta SG',
  'isolation: School C special menu dishes are unchanged'
);

-- Verify old [A, B] menus were cleaned up
select is(
  (select count(*)::int
     from public.menus
    where id in (select unnest(inserted_ids) from tmp_ab_menus)),
  0,
  'old [A, B] special menus were removed'
);

-- ── Atomicity: Failed save does NOT delete previous special menus ─────────────

-- Attempt to save for [A, B] with an invalid school id
select throws_ok(
  $$select public.save_special_menus(
      array['00000000-0000-4000-8000-000000000401'::uuid,
            '00000000-0000-4000-8000-000000000999'::uuid],
      date '2026-10-14',
      '[{"type":"halal","first_course":"Couscous","second_course":"Cordero"}]'::jsonb
    )$$,
  '23503',
  NULL,
  'save with invalid school id raises foreign_key_violation'
);

-- Verify the menu from tmp_ab_updated is still there and was NOT deleted!
select is(
  (select count(*)::int
     from public.menus
    where id in (select unnest(inserted_ids) from tmp_ab_updated)),
  1,
  'atomicity: previous special menu for [A, B] was preserved after failed save'
);

select is(
  (select count(*)::int
     from public.menus_schools
    where menu_id in (select unnest(inserted_ids) from tmp_ab_updated)),
  2,
  'atomicity: previous assignments for [A, B] were preserved after failed save'
);

-- ── Validation: empty school_ids or null date raises 22023 ───────────────────

select throws_ok(
  $$select public.save_special_menus('{}'::uuid[], date '2026-10-14', '[]'::jsonb)$$,
  '22023',
  'save_special_menus requires non-empty school ids and a date',
  'empty school_ids array raises 22023'
);

select throws_ok(
  $$select public.save_special_menus(array['00000000-0000-4000-8000-000000000401'::uuid], null, '[]'::jsonb)$$,
  '22023',
  'save_special_menus requires non-empty school ids and a date',
  'null date raises 22023'
);

-- ── Clearing special menus with empty array ──────────────────────────────────

select is(
  public.save_special_menus(
    array['00000000-0000-4000-8000-000000000401'::uuid,
          '00000000-0000-4000-8000-000000000402'::uuid],
    date '2026-10-14',
    '[]'::jsonb
  ),
  '{}'::uuid[],
  'passing empty array clears special menus and returns empty array'
);

select is(
  (select count(*)::int
     from public.menus_schools ms
     join public.menus m on m.id = ms.menu_id
    where ms.date = date '2026-10-14'
      and ms.school_id in ('00000000-0000-4000-8000-000000000401'::uuid,
                           '00000000-0000-4000-8000-000000000402'::uuid)
      and m.type <> 'normal'),
  0,
  'special menus for [A, B] are cleared'
);

select is(
  (select count(*)::int
     from public.menus_schools ms
     join public.menus m on m.id = ms.menu_id
    where ms.date = date '2026-10-14'
      and ms.school_id = '00000000-0000-4000-8000-000000000403'::uuid
      and m.type <> 'normal'),
  1,
  'School C special menu is still untouched after clearing [A, B]'
);

select * from finish();

rollback;
