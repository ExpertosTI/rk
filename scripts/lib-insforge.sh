#!/usr/bin/env bash
# Helpers compartidos — Insforge / Docker Renace
set -euo pipefail

# Clave anon por defecto del stack Renace (Insforge compartido)
RENACE_INSFORGE_ANON_DEFAULT='eyJhbGciOiAiSFMyNTYiLCAidHlwIjogIkpXVCJ9.eyJyb2xlIjogImFub24ifQ.YTrshWNWGSWsmc6DUhitFQSXDICh9BTIiz4CK0GX0Cw'

rk_root() {
  cd "$(dirname "${BASH_SOURCE[1]:-${BASH_SOURCE[0]}}")/.." && pwd
}

resolve_pg_container() {
  local hint="${1:-}" name
  if [ -n "$hint" ]; then
    name="$(docker ps --format '{{.Names}}' | grep -E "^${hint}\\.[0-9]+\\.|^${hint}$" | head -1 || true)"
    if [ -n "$name" ] && container_has_psql "$name"; then
      echo "$name"
      return 0
    fi
  fi
  # postgrest contiene la subcadena "postgres" — excluir siempre
  while IFS= read -r name; do
    [ -z "$name" ] && continue
    echo "$name" | grep -qi 'postgrest' && continue
    echo "$name" | grep -qi 'postgres' || continue
    container_has_psql "$name" || continue
    echo "$name"
    return 0
  done < <(docker ps --format '{{.Names}}' | grep -Ei 'insforge|postgres' || true)
  true
}

container_has_psql() {
  local container="${1:-}"
  [ -n "$container" ] || return 1
  docker exec "$container" sh -c 'command -v psql >/dev/null 2>&1' 2>/dev/null
}

docker_env() {
  local container="$1" key="$2"
  docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$container" 2>/dev/null \
    | grep "^${key}=" | head -1 | cut -d= -f2- | tr -d '\r' || true
}

resolve_postgrest_container() {
  docker ps --format '{{.Names}}' | grep -Ei 'insforge.*postgrest|postgrest.*insforge' | head -1 || true
}

read_jwt_secret() {
  local container="${1:-}"
  [ -n "$container" ] || return 0
  local v pg svc
  for key in PGRST_JWT_SECRET JWT_SECRET INSFORGE_JWT_SECRET; do
    v="$(docker_env "$container" "$key")"
    if [ -n "$v" ]; then
      echo "$v"
      return 0
    fi
  done
  pg="$(resolve_pg_container)"
  if [ -n "$pg" ]; then
    for key in PGRST_JWT_SECRET JWT_SECRET INSFORGE_JWT_SECRET POSTGRES_JWT_SECRET; do
      v="$(docker_env "$pg" "$key")"
      if [ -n "$v" ]; then
        echo "$v"
        return 0
      fi
    done
  fi
  svc="$(docker service ls --format '{{.Name}}' | grep -Ei 'insforge.*postgrest|postgrest.*insforge' | head -1 || true)"
  if [ -n "$svc" ]; then
    v="$(docker service inspect "$svc" --format '{{range .Spec.TaskTemplate.ContainerSpec.Env}}{{println .}}{{end}}' 2>/dev/null \
      | grep -E '^(PGRST_JWT_SECRET|JWT_SECRET|INSFORGE_JWT_SECRET)=' | head -1 | cut -d= -f2- || true)"
    if [ -n "$v" ]; then
      echo "$v"
      return 0
    fi
  fi
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
    for key in POSTGRES_USER PGUSER POSTGRESQL_USER; do
      user="$(docker_env "$container" "$key")"
      [ -n "$user" ] && break
    done
  fi

  if [ -z "$db" ]; then
    for key in POSTGRES_DB PGDATABASE POSTGRESQL_DB; do
      db="$(docker_env "$container" "$key")"
      [ -n "$db" ] && break
    done
  fi

  if [ -z "$user" ]; then
    for candidate in postgres insforge supabase admin; do
      if docker exec "$container" psql -U "$candidate" -d postgres -c 'SELECT 1' >/dev/null 2>&1; then
        user="$candidate"
        break
      fi
    done
  fi

  if [ -z "$db" ] && [ -n "$user" ]; then
    for candidate in "$user" postgres insforge supabase; do
      if docker exec "$container" psql -U "$user" -d "$candidate" -c 'SELECT 1' >/dev/null 2>&1; then
        db="$candidate"
        break
      fi
    done
  fi

  if [ -z "$user" ] || [ -z "$db" ]; then
    return 1
  fi

  echo "${user}|${db}"
}

discover_pg_print() {
  local container
  container="$(resolve_pg_container "${POSTGRES_CONTAINER:-}")"
  echo "=== Postgres containers ==="
  docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}' | grep -Ei 'postgres|NAMES' || true
  echo ""
  if [ -z "$container" ]; then
    echo "No hay contenedor postgres"
    return 1
  fi
  echo "Seleccionado: $container"
  echo "POSTGRES_USER=$(docker_env "$container" POSTGRES_USER)"
  echo "POSTGRES_DB=$(docker_env "$container" POSTGRES_DB)"
  echo "PGUSER=$(docker_env "$container" PGUSER)"
  echo "PGDATABASE=$(docker_env "$container" PGDATABASE)"
  if creds="$(discover_pg_credentials "$container" 2>/dev/null)"; then
    echo "Credenciales: ${creds%%|*}@${creds#*|}"
  else
    echo "Credenciales: no detectadas"
  fi
}

upsert_env() {
  local key="$1" val="$2" file="$3"
  [ -n "$val" ] || return 0
  touch "$file"
  if grep -qE "^${key}=" "$file" 2>/dev/null; then
    grep -vE "^${key}=" "$file" > "${file}.tmp"
    mv "${file}.tmp" "$file"
  fi
  local escaped="${val//\\/\\\\}"
  escaped="${escaped//\"/\\\"}"
  escaped="${escaped//\$/\\\$}"
  printf '%s="%s"\n' "$key" "$escaped" >> "$file"
}

env_get() {
  local key="$1" file="${2:-}"
  local val
  [ -f "$file" ] || return 0
  val="$(grep -E "^${key}=" "$file" 2>/dev/null | tail -1 | cut -d= -f2- || true)"
  val="${val#\"}"
  val="${val%\"}"
  printf '%s' "$val"
}

normalize_env_file() {
  local file="$1"
  local tmp="${file}.norm" key val escaped line
  [ -f "$file" ] || return 0
  : > "$tmp"
  while IFS= read -r line || [ -n "$line" ]; do
  case "$line" in
    \#*|'') printf '%s\n' "$line" >> "$tmp"; continue ;;
  esac
  [[ "$line" != *"="* ]] && continue
  key="${line%%=*}"
  val="${line#*=}"
  val="${val#\"}"; val="${val%\"}"
  escaped="${val//\\/\\\\}"
  escaped="${escaped//\"/\\\"}"
  escaped="${escaped//\$/\\\$}"
  printf '%s="%s"\n' "$key" "$escaped" >> "$tmp"
  done < "$file"
  mv "$tmp" "$file"
  chmod 600 "$file" 2>/dev/null || true
}

is_vps_with_docker() {
  command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1
}

mint_jwt() {
  local role="$1" secret="$2" root="${3:-}"
  if [ -n "$root" ] && command -v node >/dev/null 2>&1 && [ -f "$root/scripts/jwt-sign.mjs" ]; then
    local out
    out="$(node "$root/scripts/jwt-sign.mjs" "$role" "$secret" 2>/dev/null || true)"
    if [ -n "$out" ]; then
      printf '%s' "$out"
      return 0
    fi
  fi
  local header payload data sig
  header="$(printf '{"alg": "HS256", "typ": "JWT"}' | openssl base64 -e -A | tr -d '\n' | sed 's/=*$//')"
  payload="$(printf '{"role": "%s"}' "$role" | openssl base64 -e -A | tr -d '\n' | sed 's/=*$//')"
  data="${header}.${payload}"
  sig="$(printf '%s' "$data" | openssl dgst -binary -sha256 -hmac "$secret" | openssl base64 -e -A | tr -d '\n' | sed 's/=*$//')"
  printf '%s.%s' "$data" "$sig"
}

restart_postgrest() {
  local postgrest
  postgrest="$(resolve_postgrest_container)"
  [ -n "$postgrest" ] || return 0
  docker service update --force "${postgrest%%.*}" >/dev/null 2>&1 \
    || docker restart "$postgrest" >/dev/null 2>&1 \
    || true
}
