#!/usr/bin/env bash
# Genera .env automáticamente — sin editar archivos a mano.
# Uso: ./scripts/seed-env.sh   o   npm run seed:env
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT/.env}"
CRED_FILE="${CRED_FILE:-/root/.rk-inversiones-credentials.txt}"

# shellcheck disable=SC1091
source "$ROOT/scripts/lib-insforge.sh"

green() { printf '\033[32m%s\033[0m\n' "$*"; }
cyan()  { printf '\033[36m%s\033[0m\n' "$*"; }
warn()  { printf '\033[33m%s\033[0m\n' "$*" >&2; }

gen_admin_pin() {
  printf 'RK%s' "$(openssl rand -hex 3 | tr 'a-f' 'A-F')"
}

is_weak_admin_pin() {
  local pin="${1:-}"
  [ -z "$pin" ] && return 0
  [ "$pin" = "RK2026" ] && return 0
  [ "${#pin}" -lt 6 ] && return 0
  return 1
}

cyan "── seed-env: generando .env ───────────────────"

touch "$ENV_FILE"
chmod 600 "$ENV_FILE" 2>/dev/null || true

ANON_KEY="$RENACE_INSFORGE_ANON_DEFAULT"
SERVICE_KEY="$RENACE_INSFORGE_ANON_DEFAULT"
INSFORGE_URL="https://insforge.renace.tech"
INSFORGE_MODE="insforge"
NEW_PIN=""

if is_vps_with_docker; then
  postgrest="$(resolve_postgrest_container)"
  if [ -n "$postgrest" ]; then
    INSFORGE_URL="/api/insforge"
    INSFORGE_MODE="postgrest"
    cyan "   Detectado PostgREST: $postgrest"

    svc="$(read_service_key_from_container "$postgrest")"
    if [ -n "$svc" ]; then
      SERVICE_KEY="$svc"
      green "   SERVICE_KEY leída del contenedor"
    else
      jwt_secret="$(read_jwt_secret "$postgrest")"
      if [ -n "$jwt_secret" ]; then
        minted="$(mint_jwt service_role "$jwt_secret" "$ROOT")"
        if [ -n "$minted" ]; then
          SERVICE_KEY="$minted"
          minted_anon="$(mint_jwt anon "$jwt_secret" "$ROOT")"
          [ -n "$minted_anon" ] && ANON_KEY="$minted_anon"
          green "   JWT firmados desde PGRST_JWT_SECRET"
        fi
      fi
    fi
  else
    warn "   PostgREST no encontrado — usando API pública Insforge"
  fi
else
  warn "   Sin Docker — modo desarrollo (API pública)"
fi

EXISTING_PIN="$(env_get PUBLIC_ADMIN_PIN "$ENV_FILE")"
if is_weak_admin_pin "$EXISTING_PIN"; then
  NEW_PIN="$(gen_admin_pin)"
  upsert_env "PUBLIC_ADMIN_PIN" "$NEW_PIN" "$ENV_FILE"
  green "   PUBLIC_ADMIN_PIN generado"
else
  NEW_PIN=""
  green "   PUBLIC_ADMIN_PIN existente conservado"
fi

upsert_env "PUBLIC_INSFORGE_URL" "$INSFORGE_URL" "$ENV_FILE"
upsert_env "PUBLIC_INSFORGE_MODE" "$INSFORGE_MODE" "$ENV_FILE"
upsert_env "INSFORGE_ANON_KEY" "$ANON_KEY" "$ENV_FILE"
upsert_env "INSFORGE_SERVICE_KEY" "$SERVICE_KEY" "$ENV_FILE"

if [ -n "$NEW_PIN" ] && [ -w "$(dirname "$CRED_FILE")" ] 2>/dev/null; then
  {
    echo "RK Inversiones — credenciales $(date -Iseconds)"
    echo "Admin panel: https://rk.renace.tech/admin"
    echo "PUBLIC_ADMIN_PIN=$NEW_PIN"
    echo ""
    echo "Guarde en gestor de contraseñas. No se vuelve a mostrar en consola."
  } > "$CRED_FILE"
  chmod 600 "$CRED_FILE"
  green "   Credenciales guardadas en $CRED_FILE"
fi

green "✅ .env listo ($(wc -l < "$ENV_FILE" | tr -d ' ') variables)"
if [ -n "$NEW_PIN" ]; then
  cyan "   PIN admin (solo esta vez): $NEW_PIN"
fi
