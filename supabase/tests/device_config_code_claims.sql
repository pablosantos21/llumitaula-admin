-- Contract tests for the admin device config-code model.
--
-- Run against the scratch database built by scripts/test-db.sh, which imports
-- the `auth` schema, applies supabase/tests/setup.sql (minimal shared schema)
-- and then the two real RPC migrations under test:
--   migrations/20260916110000_device_config_code_six_characters.sql
--   migrations/20260916120000_device_claim_history.sql
--
-- Everything runs inside a transaction and is rolled back.

begin;

select plan(27);

-- ── Deterministic fixtures (school A ...201, school B ...202) ────────────────

set local role postgres;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                        created_at, updated_at)
values
  ('00000000-0000-4000-8000-000000000101'::uuid, '00000000-0000-0000-0000-000000000000'::uuid,
   'authenticated', 'authenticated', 'admin.a@contract.test',
   '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
   timestamp '2026-01-01 00:00:00+00',
   jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
   jsonb_build_object('full_name', 'Admin A'),
   timestamp '2026-01-01 00:00:00+00', timestamp '2026-01-01 00:00:00+00'),
  ('00000000-0000-4000-8000-000000000102'::uuid, '00000000-0000-0000-0000-000000000000'::uuid,
   'authenticated', 'authenticated', 'supervisor.a@contract.test',
   '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
   timestamp '2026-01-01 00:00:00+00',
   jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
   jsonb_build_object('full_name', 'Supervisor A'),
   timestamp '2026-01-01 00:00:00+00', timestamp '2026-01-01 00:00:00+00'),
  ('00000000-0000-4000-8000-000000000103'::uuid, '00000000-0000-0000-0000-000000000000'::uuid,
   'authenticated', 'authenticated', 'supervisor.b@contract.test',
   '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
   timestamp '2026-01-01 00:00:00+00',
   jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
   jsonb_build_object('full_name', 'Supervisor B'),
   timestamp '2026-01-01 00:00:00+00', timestamp '2026-01-01 00:00:00+00');

insert into public.schools (id, name) values
  ('00000000-0000-4000-8000-000000000201'::uuid, 'School A'),
  ('00000000-0000-4000-8000-000000000202'::uuid, 'School B');

insert into public.users (id, role, school_id, full_name, active, created_at) values
  ('00000000-0000-4000-8000-000000000101'::uuid, 'admin',      '00000000-0000-4000-8000-000000000201'::uuid, 'Admin A',        true, timestamp '2026-01-01 00:00:00+00'),
  ('00000000-0000-4000-8000-000000000102'::uuid, 'supervisor', '00000000-0000-4000-8000-000000000201'::uuid, 'Supervisor A',   true, timestamp '2026-01-01 00:00:00+00'),
  ('00000000-0000-4000-8000-000000000103'::uuid, 'supervisor', '00000000-0000-4000-8000-000000000202'::uuid, 'Supervisor B',   true, timestamp '2026-01-01 00:00:00+00');

insert into public.devices (id, school_id, name, identifier, active) values
  ('00000000-0000-4000-8000-000000000601'::uuid, '00000000-0000-4000-8000-000000000201'::uuid, 'Device A1', 'dev-a1', true),
  ('00000000-0000-4000-8000-000000000602'::uuid, '00000000-0000-4000-8000-000000000201'::uuid, 'Device A2', 'dev-a2', true),
  ('00000000-0000-4000-8000-000000000604'::uuid, '00000000-0000-4000-8000-000000000202'::uuid, 'Device B1', 'dev-b1', true),
  ('00000000-0000-4000-8000-000000000605'::uuid, '00000000-0000-4000-8000-000000000201'::uuid, 'Inactive A', null, false);

-- ── Schema & security surface ────────────────────────────────────────────────

select ok(
  to_regclass('public.device_claims') is not null,
  'device claims audit table exists'
);
select ok(
  exists (
    select 1
      from pg_class
     where oid = to_regclass('public.device_claims')
       and relrowsecurity
  ),
  'device claims audit table has RLS enabled'
);
select has_column('public', 'devices', 'config_code_hash', 'devices store only a config code hash');
select has_column('public', 'devices', 'config_code_created_at', 'devices track when a code was issued');
select has_column('public', 'devices', 'config_code_expires_at', 'devices config codes can expire');
select has_column('public', 'devices', 'revoked', 'devices can be revoked');
select ok(
  exists (
    select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'generate_device_config_code'
       and p.prosecdef
  ),
  'generate_device_config_code is defined SECURITY DEFINER'
);
select ok(
  exists (
    select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'get_device_claims'
       and p.prosecdef
  ),
  'get_device_claims is defined SECURITY DEFINER'
);
select ok(
  has_function_privilege('authenticated', 'public.generate_device_config_code(uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.generate_device_config_code(uuid)', 'EXECUTE')
  and not has_function_privilege('service_role', 'public.generate_device_config_code(uuid)', 'EXECUTE'),
  'generate_device_config_code is callable by authenticated only'
);
select ok(
  has_function_privilege('authenticated', 'public.get_device_claims(uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.get_device_claims(uuid)', 'EXECUTE')
  and not has_function_privilege('service_role', 'public.get_device_claims(uuid)', 'EXECUTE'),
  'get_device_claims is callable by authenticated only'
);

-- ── Admin mints a 6-character code ───────────────────────────────────────────

set local role authenticated;
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', '00000000-0000-4000-8000-000000000101',
    'role', 'admin'
  )::text,
  true
);

create temp table tmp_generated (device_id uuid, position int, code text, primary key (device_id, position));

insert into tmp_generated (device_id, position, code) values
  ('00000000-0000-4000-8000-000000000601'::uuid, 1,
   (select public.generate_device_config_code('00000000-0000-4000-8000-000000000601'::uuid))),
  ('00000000-0000-4000-8000-000000000601'::uuid, 2,
   (select public.generate_device_config_code('00000000-0000-4000-8000-000000000601'::uuid)));

select is(
  (select length(code) from tmp_generated where device_id = '00000000-0000-4000-8000-000000000601'::uuid and position = 1),
  6,
  'minted code has six characters'
);
select ok(
  (select code from tmp_generated where device_id = '00000000-0000-4000-8000-000000000601'::uuid and position = 1) ~ '^[0-9A-Za-z]{6}$',
  'minted code fits the [0-9A-Za-z] alphabet (no LLM- prefix)'
);
select is(
  (select config_code_hash from public.devices where id = '00000000-0000-4000-8000-000000000601'::uuid),
  encode(digest(lower((select code from tmp_generated where device_id = '00000000-0000-4000-8000-000000000601'::uuid and position = 2)), 'sha256'), 'hex'),
  'stored hash is the sha256 of the lowercased current code'
);
select ok(
  (select config_code_created_at from public.devices where id = '00000000-0000-4000-8000-000000000601'::uuid) is not null,
  'code creation time is recorded'
);
select isnt(
  (select code from tmp_generated where device_id = '00000000-0000-4000-8000-000000000601'::uuid and position = 2),
  (select code from tmp_generated where device_id = '00000000-0000-4000-8000-000000000601'::uuid and position = 1),
  'regeneration issues a distinct code'
);
select is(
  (select config_code_hash = encode(digest(lower((select code from tmp_generated where device_id = '00000000-0000-4000-8000-000000000601'::uuid and position = 1)), 'sha256'), 'hex')
     from public.devices where id = '00000000-0000-4000-8000-000000000601'::uuid),
  false,
  'the previous code no longer matches after regeneration'
);
select ok(
  exists (
    select 1 from public.devices
    where config_code_hash = encode(digest(lower((select code from tmp_generated where device_id = '00000000-0000-4000-8000-000000000601'::uuid and position = 2)), 'sha256'), 'hex')
  ),
  'a minted code resolves through the worker claim lookup (sha256 of lowercased code)'
);
select throws_ok(
  $$select public.generate_device_config_code('00000000-0000-4000-8000-000000000666'::uuid)$$,
  NULL,
  'generation rejects an unknown device'
);
select throws_ok(
  $$select public.generate_device_config_code('00000000-0000-4000-8000-000000000605'::uuid)$$,
  NULL,
  'generation rejects an inactive device'
);

-- ── Supervisor scoping for generation ────────────────────────────────────────

select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', '00000000-0000-4000-8000-000000000102',
    'role', 'supervisor'
  )::text,
  true
);
select lives_ok(
  $$select public.generate_device_config_code('00000000-0000-4000-8000-000000000602'::uuid)$$,
  'a supervisor can mint a code for a device in their school'
);

select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', '00000000-0000-4000-8000-000000000103',
    'role', 'supervisor'
  )::text,
  true
);
select throws_ok(
  $$select public.generate_device_config_code('00000000-0000-4000-8000-000000000602'::uuid)$$,
  NULL,
  'a supervisor cannot mint a code for a device in another school'
);

-- ── Binding history ──────────────────────────────────────────────────────────

set local role postgres;
insert into public.device_claims (id, device_id, device_identifier, claimed_at) values
  ('00000000-0000-4000-8000-000000000701'::uuid, '00000000-0000-4000-8000-000000000601'::uuid, 'claim-1', timestamptz '2026-09-01 09:00:00+00'),
  ('00000000-0000-4000-8000-000000000702'::uuid, '00000000-0000-4000-8000-000000000601'::uuid, 'claim-2', timestamptz '2026-09-01 10:00:00+00');

set local role authenticated;
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', '00000000-0000-4000-8000-000000000101',
    'role', 'admin'
  )::text,
  true
);
select is(
  (select public.get_device_claims('00000000-0000-4000-8000-000000000604'::uuid)),
  '[]'::jsonb,
  'a device with no claims reports an empty history'
);
select is(
  (select public.get_device_claims('00000000-0000-4000-8000-000000000601'::uuid)),
  jsonb_build_array(
    jsonb_build_object(
      'id', '00000000-0000-4000-8000-000000000702'::uuid,
      'device_identifier', 'claim-2',
      'claimed_at', timestamptz '2026-09-01 10:00:00+00'
    ),
    jsonb_build_object(
      'id', '00000000-0000-4000-8000-000000000701'::uuid,
      'device_identifier', 'claim-1',
      'claimed_at', timestamptz '2026-09-01 09:00:00+00'
    )
  ),
  'admin reads the full claim history newest first'
);
select is(
  (select public.get_device_claims('00000000-0000-4000-8000-000000000604'::uuid)),
  '[]'::jsonb,
  'admin reads the (empty) history of a device in another school'
);

select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', '00000000-0000-4000-8000-000000000102',
    'role', 'supervisor'
  )::text,
  true
);
select is(
  jsonb_array_length((select public.get_device_claims('00000000-0000-4000-8000-000000000601'::uuid))),
  2,
  'a supervisor reads the claim history of a device in their school'
);

select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', '00000000-0000-4000-8000-000000000103',
    'role', 'supervisor'
  )::text,
  true
);
select throws_ok(
  $$select public.get_device_claims('00000000-0000-4000-8000-000000000601'::uuid)$$,
  NULL,
  'a supervisor cannot read claims of a device in another school'
);

set local role anon;
select set_config('request.jwt.claims', '{}', true);
select throws_ok(
  $$select public.get_device_claims('00000000-0000-4000-8000-000000000601'::uuid)$$,
  '42501',
  'permission denied for function get_device_claims',
  'anon cannot invoke get_device_claims'
);

select * from finish();

rollback;