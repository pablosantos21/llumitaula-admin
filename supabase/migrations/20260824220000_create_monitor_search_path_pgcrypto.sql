-- create_monitor uses crypt()/gen_salt() from pgcrypto, which lives in the
-- extensions schema. Its search_path must include it or the calls fail with
-- "function gen_salt(unknown) does not exist".
ALTER FUNCTION public.create_monitor(text, text, smallint, uuid)
  SET search_path TO 'pg_catalog', 'public', 'extensions', 'pg_temp';
