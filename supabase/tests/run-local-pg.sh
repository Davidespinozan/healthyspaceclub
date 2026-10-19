#!/usr/bin/env bash
# Ejecuta un test SQL de migración contra un Postgres DESECHABLE (nunca producción).
#   supabase/tests/run-local-pg.sh [migración[:migración…]] [test]
# Varias migraciones se aplican en el orden dado (separadas por «:»).
# Requiere binarios de Postgres 17 (initdb/pg_ctl/psql). Crea stubs mínimos de
# Supabase: roles anon/authenticated/service_role, auth.users y auth.uid().
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
MIGRATIONS="${1:-$ROOT/supabase/migrations/20261014120000_nutrition_adaptive_calibration.sql}"
TEST="${2:-$ROOT/supabase/tests/nutrition_adaptive_calibration.test.sql}"
PGBIN="${PGBIN:-$(ls -d /opt/homebrew/opt/postgresql@17/bin 2>/dev/null || dirname "$(command -v initdb)")}"

DATA="$(mktemp -d)"
PORT="${PGPORT_TEST:-54329}"
cleanup() { "$PGBIN/pg_ctl" -D "$DATA" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$DATA"; }
trap cleanup EXIT

"$PGBIN/initdb" -D "$DATA" -U postgres --auth=trust >/dev/null
"$PGBIN/pg_ctl" -D "$DATA" -o "-p $PORT -k $DATA -c listen_addresses=''" -l "$DATA/log" start -w >/dev/null
PSQL=("$PGBIN/psql" -h "$DATA" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q)

"${PSQL[@]}" <<'SQL'
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth, public to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated;
-- privilegios por defecto de Supabase sobre tablas nuevas de public
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
SQL

IFS=':' read -r -a MIGRATION_LIST <<<"$MIGRATIONS"
for m in "${MIGRATION_LIST[@]}"; do "${PSQL[@]}" -f "$m"; done
"${PSQL[@]}" -f "$TEST"
