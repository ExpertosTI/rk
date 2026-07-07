#!/usr/bin/env bash
# Aplica schema + permisos RK en Insforge/PostgreSQL
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SQL_SCHEMA="${ROOT}/insforge/schema.sql"
SQL_SEED="${ROOT}/insforge/seed.sql"

# shellcheck disable=SC1091
source "$ROOT/scripts/lib-insforge.sh"

green() { printf '\033[32m%s\033[0m\n' "$*"; }
cyan()  { printf '\033[36m%s\033[0m\n' "$*"; }
warn()  { printf '\033[33m%s\033[0m\n' "$*" >&2; }
red()   { printf '\033[31m%s\033[0m\n' "$*" >&2; }

if [ "${1:-}" = "discover" ]; then
  discover_pg_print
  exit $?
fi

run_sql() {
  local file="$1"
  docker exec -i "$container" psql -U "$user" -d "$db" < "$file"
}

cyan "── seed-db: tablas Insforge ───────────────────"

if ! is_vps_with_docker; then
  warn "⚠️  Sin Docker — schema se aplicará en el VPS con deploy"
  exit 0
fi

container="$(resolve_pg_container "${POSTGRES_CONTAINER:-}")"
if [ -z "$container" ]; then
  warn "⚠️  Postgres Insforge no encontrado — omitiendo schema"
  exit 0
fi

if ! container_has_psql "$container"; then
  red "❌ Contenedor sin psql (¿postgrest?): $container"
  red "   Ejecute: ./scripts/seed-db.sh discover"
  exit 1
fi

if ! creds="$(discover_pg_credentials "$container")"; then
  red "❌ No se pudieron detectar credenciales PostgreSQL."
  red "   Ejecute: POSTGRES_USER=postgres POSTGRES_DB=insforge ./scripts/seed-db.sh"
  red "   O: ./scripts/seed-db.sh discover"
  exit 1
fi

user="${creds%%|*}"
db="${creds#*|}"

if [ -z "$user" ] || [ -z "$db" ]; then
  red "❌ Credenciales vacías (user/db). Use discover o defina POSTGRES_USER/POSTGRES_DB."
  exit 1
fi

cyan "   Contenedor: $container"
cyan "   DB: $user@$db"

run_sql "$SQL_SCHEMA"
green "   schema.sql aplicado"

for migrate in "$ROOT"/insforge/migrate-*.sql; do
  [ -f "$migrate" ] || continue
  run_sql "$migrate"
  green "   $(basename "$migrate") aplicado"
done

if [ -f "$SQL_SEED" ]; then
  run_sql "$SQL_SEED"
  green "   seed.sql aplicado"
fi

restart_postgrest
green "✅ Base de datos RK lista"
