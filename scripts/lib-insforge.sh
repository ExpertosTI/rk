#!/usr/bin/env bash
# Helpers compartidos — Insforge / Docker Renace
set -euo pipefail

# Clave anon por defecto del stack Renace (Insforge compartido)
RENACE_INSFORGE_ANON_DEFAULT='eyJhbGciOiAiSFMyNTYiLCAidHlwIjogIkpXVCJ9.eyJyb2xlIjogImFub24ifQ.YTrshWNWGSWsmc6DUhitFQSXDICh9BTIiz4CK0GX0Cw'

rk_root() {
  cd "$(dirname "${BASH_SOURCE[1]:-${BASH_SOURCE[0]}}")/.." && pwd
}

resolve_pg_container() {
  local hint="${1:-}"
  if [ -n "$hint" ]; then
    docker ps --format '{{.Names}}' | grep -E "^${hint}\\.[0-9]+\\.|^${hint}$" | head -1 && return 0
  fi
  docker ps --format '{{.Names}}' | grep -Ei 'insforge.*postgres|postgres.*insforge' | head -1 || true
}

resolve_postgrest_container() {
  docker ps --format '{{.Names}}' | grep -Ei 'insforge.*postgrest|postgrest.*insforge' | head -1 || true
}

docker_env() {
  local container="$1" key="$2"
  docker exec "$container" printenv "$key" 2>/dev/null | tr -d '\r' || true
}

read_jwt_secret() {
  local container="${1:-}"
  [ -n "$container" ] || return 0
  local v
  for key in PGRST_JWT_SECRET JWT_SECRET INSFORGE_JWT_SECRET; do
    v="$(docker_env "$container" "$key")"
    if [ -n "$v" ]; then
      echo "$v"
      return 0
    fi
  done
}

read_service_key_from_container() {
  local container="${1:-}"
  [ -n "$container" ] || return 0
  local v
  for key in SERVICE_ROLE_KEY SUPABASE_SERVICE_ROLE_KEY INSFORGE_SERVICE_KEY PGRST_SERVICE_KEY; do
    v="$(docker_env "$container" "$key")"
    if [ -n "$v" ]; then
      echo "$v"
      return 0
    fi
  done
}

discover_pg_credentials() {
  local container="$1"
  local user="${POSTGRES_USER:-}" db="${POSTGRES_DB:-}"

  if [ -z "$user" ]; then
    for candidate in insforge admin postgres supabase; do
      if docker exec "$container" psql -U "$candidate" -d postgres -c 'SELECT 1' >/dev/null 2>&1; then
        user="$candidate"
        break
      fi
    done
  fi

  if [ -z "$db" ] && [ -n "$user" ]; then
    for candidate in "$user" postgres insforge; do
      if docker exec "$container" psql -U "$user" -d "$candidate" -c 'SELECT 1' >/dev/null 2>&1; then
        db="$candidate"
        break
      fi
    done
  fi

  echo "${user}|${db}"
}

upsert_env() {
  local key="$1" val="$2" file="$3"
  [ -n "$val" ] || return 0
  touch "$file"
  if grep -q "^${key}=" "$file" 2>/dev/null; then
    grep -v "^${key}=" "$file" > "${file}.tmp"
    mv "${file}.tmp" "$file"
  fi
  printf '%s=%s\n' "$key" "$val" >> "$file"
}

env_get() {
  local key="$1" file="${2:-}"
  [ -f "$file" ] || return 0
  grep "^${key}=" "$file" 2>/dev/null | tail -1 | cut -d= -f2- || true
}

is_vps_with_docker() {
  command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1
}

mint_jwt() {
  local role="$1" secret="$2" root="$3"
  node "$root/scripts/jwt-sign.mjs" "$role" "$secret" 2>/dev/null || true
}

restart_postgrest() {
  local postgrest
  postgrest="$(resolve_postgrest_container)"
  [ -n "$postgrest" ] || return 0
  docker service update --force "${postgrest%%.*}" >/dev/null 2>&1 \
    || docker restart "$postgrest" >/dev/null 2>&1 \
    || true
}
