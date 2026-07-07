#!/usr/bin/env bash
# Aplica schema + permisos RK en Insforge/PostgreSQL
# Uso: ./scripts/seed-db.sh   o   npm run seed:db
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SQL_SCHEMA="${ROOT}/insforge/schema.sql"
SQL_SEED="${ROOT}/insforge/seed.sql"

# shellcheck disable=SC1091
source "$ROOT/scripts/lib-insforge.sh"

green() { printf '\033[32m%s\033[0m\n' "$*"; }
cyan()  { printf '\033[36m%s\033[0m\n' "$*"; }
warn()  { printf '\033[33m%s\033[0m\n' "$*" >&2; }

cyan "── seed-db: tablas Insforge ───────────────────"

if ! is_vps_with_docker; then
  warn "⚠️  Sin Docker — schema se aplicará en el VPS con deploy"
  exit 0
fi

container="$(resolve_pg_container "${POSTGRES_CONTAINER:-}")"
if [ -z "$container" ]; then
  warn "⚠️  Postgres Insforge no encontrado — omitiendo schema"
  warn "   En el VPS ejecute de nuevo: npm run seed"
  exit 0
fi

creds="$(discover_pg_credentials "$container")"
user="${creds%%|*}"
db="${creds#*|}"

cyan "   Contenedor: $container"
cyan "   DB: $user@$db"

docker exec -i "$container" psql -U "$user" -d "$db" < "$SQL_SCHEMA"
green "   schema.sql aplicado"

SQL_MIGRATE="${ROOT}/insforge/migrate-v2-cedula.sql"
if [ -f "$SQL_MIGRATE" ]; then
  docker exec -i "$container" psql -U "$user" -d "$db" < "$SQL_MIGRATE"
  green "   migrate-v2-cedula.sql aplicado"
fi

if [ -f "$SQL_SEED" ]; then
  docker exec -i "$container" psql -U "$user" -d "$db" < "$SQL_SEED"
  green "   seed.sql aplicado"
fi

restart_postgrest
green "✅ Base de datos RK lista"
