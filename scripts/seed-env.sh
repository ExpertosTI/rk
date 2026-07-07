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

# Buzón producción Hostinger — info@renace.tech (solo VPS, si falta .smtp.local)
if is_vps_with_docker && [ ! -f "$ROOT/.smtp.local" ]; then
  if [ -f "$CRED_FILE" ]; then
    cred_smtp="$(grep '^SMTP_PASS=' "$CRED_FILE" 2>/dev/null | tail -1 | cut -d= -f2- || true)"
    [ -n "$cred_smtp" ] && printf '%s' "$cred_smtp" > "$ROOT/.smtp.local"
  fi
  if [ ! -s "$ROOT/.smtp.local" ] && [ -f "$ROOT/scripts/smtp.secret" ]; then
    cp "$ROOT/scripts/smtp.secret" "$ROOT/.smtp.local"
  fi
  if [ ! -s "$ROOT/.smtp.local" ]; then
    printf '%s' 'JustWork2027@' > "$ROOT/.smtp.local"
  fi
  chmod 600 "$ROOT/.smtp.local" 2>/dev/null || true
fi

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

# TransUnion / DATACRÉDITO — mock hasta activar suscripción ICS
if [ -z "$(env_get TRANSUNION_MODE "$ENV_FILE")" ]; then
  upsert_env "TRANSUNION_MODE" "mock" "$ENV_FILE"
fi
for key in TRANSUNION_CLIENT_ID TRANSUNION_CLIENT_SECRET TRANSUNION_TOKEN_URL TRANSUNION_API_URL TRANSUNION_SUBSCRIBER_CODE; do
  val="$(env_get "$key" "$ENV_FILE")"
  [ -n "$val" ] && upsert_env "$key" "$val" "$ENV_FILE"
done

# Correo Hostinger — info@renace.tech (clave en .smtp.local, nunca en git)
SMTP_LOCAL="$ROOT/.smtp.local"
SMTP_PASS="$(env_get SMTP_PASS "$ENV_FILE")"
if [ -z "$SMTP_PASS" ] && [ -f "$SMTP_LOCAL" ]; then
  SMTP_PASS="$(tr -d '\r\n' < "$SMTP_LOCAL")"
fi
if [ -z "$SMTP_PASS" ] && [ -f "$CRED_FILE" ]; then
  SMTP_PASS="$(grep '^SMTP_PASS=' "$CRED_FILE" 2>/dev/null | tail -1 | cut -d= -f2- || true)"
fi

for pair in \
  "SMTP_HOST:smtp.hostinger.com" \
  "SMTP_PORT:465" \
  "SMTP_SECURE:true" \
  "SMTP_USER:info@renace.tech"; do
  key="${pair%%:*}"
  default="${pair#*:}"
  if [ -z "$(env_get "$key" "$ENV_FILE")" ]; then
    upsert_env "$key" "$default" "$ENV_FILE"
  fi
done
[ -n "$SMTP_PASS" ] && upsert_env "SMTP_PASS" "$SMTP_PASS" "$ENV_FILE"

if [ -z "$(env_get NOTIFY_TO "$ENV_FILE")" ]; then
  upsert_env "NOTIFY_TO" "jcamacho-gomez@hotmail.com" "$ENV_FILE"
fi
if [ -z "$(env_get NOTIFY_FROM "$ENV_FILE")" ]; then
  upsert_env "NOTIFY_FROM" "RK Inversiones <info@renace.tech>" "$ENV_FILE"
fi
if [ -z "$(env_get NOTIFY_SECRET "$ENV_FILE")" ]; then
  upsert_env "NOTIFY_SECRET" "$(openssl rand -hex 24)" "$ENV_FILE"
fi

write_credentials_file() {
  [ -w "$(dirname "$CRED_FILE")" ] 2>/dev/null || return 0
  local pin_line=""
  [ -n "$NEW_PIN" ] && pin_line="PUBLIC_ADMIN_PIN=$NEW_PIN"
  {
    echo "RK Inversiones — credenciales $(date -Iseconds)"
    echo "Admin panel: https://rk.renace.tech/admin"
    [ -n "$pin_line" ] && echo "$pin_line"
    echo "SMTP_USER=$(env_get SMTP_USER "$ENV_FILE")"
    echo "SMTP_PASS=$(env_get SMTP_PASS "$ENV_FILE")"
    echo "NOTIFY_TO=$(env_get NOTIFY_TO "$ENV_FILE")"
    echo "NOTIFY_FROM=$(env_get NOTIFY_FROM "$ENV_FILE")"
    echo ""
    echo "Archivo confidencial. No compartir ni subir a repositorios."
  } > "$CRED_FILE"
  chmod 600 "$CRED_FILE"
}

if [ -n "$NEW_PIN" ] || [ -n "$(env_get SMTP_PASS "$ENV_FILE")" ]; then
  write_credentials_file
  green "   Credenciales guardadas en $CRED_FILE"
fi

green "✅ .env listo ($(wc -l < "$ENV_FILE" | tr -d ' ') variables)"
if [ -n "$NEW_PIN" ]; then
  cyan "   PIN admin (solo esta vez): $NEW_PIN"
fi
green "   Correo: $(env_get SMTP_USER "$ENV_FILE") → $(env_get NOTIFY_TO "$ENV_FILE")"
