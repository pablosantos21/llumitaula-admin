#!/usr/bin/env bash
set -euo pipefail

# Build a deterministic scratch database for the admin contract tests and run
# pgTAP on them.
#
# Background: the admin RPC migrations are applied on top of the shared tenant
# schema (worker base migrations + live remote baseline) in the real project,
# so the full admin migration set cannot be applied on a bare Postgres. This
# harness reproduces only the objects the RPCs depend on (via
# supabase/tests/setup.sql) inside a dedicated scratch database, then applies
# the real migrations under test plus the pgTAP files.
#
# PREREQUISITES
#   - Docker, and the local Supabase stack started (see llumitaula-worker:
#     `npx supabase start`). The postgres container is discovered by name.
#   - The pgtap extension must be resolvable in the supabase postgres image
#     (it is the same image `supabase test db` uses).
#
# USAGE
#   scripts/test-db.sh            # run all contract tests
#
# ENV
#   ADMIN_TEST_DB            scratch database name (default: supabase_test_admin)
#   SUPABASE_DB_CONTAINER    postgres container (default: discovered)

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TESTS_DIR="$ROOT_DIR/supabase/tests"
MIGRATIONS_DIR="$ROOT_DIR/supabase/migrations"
DATABASE="${ADMIN_TEST_DB:-supabase_test_admin}"
DB_USER="${ADMIN_TEST_USER:-postgres}"

if [[ ! "$DATABASE" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
  echo "error: ADMIN_TEST_DB must be a plain SQL identifier, got: $DATABASE" >&2
  exit 1
fi

CONTAINER="${SUPABASE_DB_CONTAINER:-}"
if [[ -z "$CONTAINER" ]]; then
  CONTAINER="$(docker ps --format '{{.Names}}' | grep '^supabase_db_' | head -n 1 || true)"
fi
if [[ -z "$CONTAINER" ]]; then
  echo "error: no running Supabase local database found." >&2
  echo "       Start the local stack first (llumitaula-worker): npx supabase start" >&2
  exit 1
fi
echo "Using postgres container: $CONTAINER"
echo "Using scratch database:   $DATABASE"

MIGRATIONS=(
  "20260916110000_device_config_code_six_characters.sql"
  "20260916120000_device_claim_history.sql"
  "20261004120000_school_capabilities.sql"
  "20261005120000_child_lunch_days.sql"
)

for name in "${MIGRATIONS[@]}"; do
  if [[ ! -f "$MIGRATIONS_DIR/$name" ]]; then
    echo "error: required migration not found: $name" >&2
    exit 1
  fi
done

psql_run() {
  docker exec -i "$CONTAINER" psql -U "$DB_USER" -d "$1" -q -v ON_ERROR_STOP=1
}

echo "== recreating scratch database =="
docker exec "$CONTAINER" psql -U "$DB_USER" -d postgres -q \
  -c "drop database if exists $DATABASE with (force)" \
  -c "create database $DATABASE"

echo "== importing auth schema =="
docker exec "$CONTAINER" pg_dump -U "$DB_USER" -d postgres \
  --schema-only --schema=auth --no-owner --no-privileges \
  | psql_run "$DATABASE" > /dev/null

echo "== applying shared fixture schema (supabase/tests/setup.sql) =="
psql_run "$DATABASE" < "$TESTS_DIR/setup.sql"

echo "== applying RPC migrations under test =="
for name in "${MIGRATIONS[@]}"; do
  psql_run "$DATABASE" < "$MIGRATIONS_DIR/$name"
done

echo "== enabling pgtap =="
docker exec "$CONTAINER" psql -U "$DB_USER" -d "$DATABASE" -q -c "create extension if not exists pgtap"

failures=0
for test_path in "$TESTS_DIR"/*.sql; do
  filename="${test_path##*/}"
  if [[ "$filename" == "setup.sql" ]]; then
    continue
  fi
  printf '== running %s ==\n' "$filename"
  set +e
  output="$(psql_run "$DATABASE" < "$test_path" 2>&1)"
  status=$?
  set -e
  printf '%s\n' "$output"
  if [[ $status -ne 0 ]] || grep -qE 'not ok|^# Failed|ERROR' <<< "$output"; then
    failures=$((failures + 1))
  fi
done

if [[ $failures -gt 0 ]]; then
  echo "RESULT: FAIL ($failures contract test file(s) with failures)"
  exit 1
fi
echo "RESULT: PASS"
