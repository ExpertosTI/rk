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

ADMIN_PIN_DEFAULT="RK2026"

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
normalize_env_file "$ENV_FILE"

ANON_KEY="$RENACE_INSFORGE_ANON_DEFAULT"
SERVICE_KEY="$RENACE_INSFORGE_ANON_DEFAULT"
INSFORGE_URL="https://insforge.renace.tech"
INSFORGE_MODE="insforge"

if is_vps_with_docker; then
  postgrest="$(resolve_postgrest_container)"
  if [ -n "$postgrest" ]; then
    INSFORGE_URL="/api/insforge"
    INSFORGE_MODE="postgrest"
    # Clave compartida del stack Renace — válida en PostgREST (no mintear JWT)
    ANON_KEY="$RENACE_INSFORGE_ANON_DEFAULT"
    SERVICE_KEY="$RENACE_INSFORGE_ANON_DEFAULT"
    green "   Claves PostgREST (Renace)"
  else
    warn "   Base de datos no detectada — modo desarrollo"
  fi
else
  warn "   Sin Docker — modo desarrollo (API pública)"
fi

upsert_env "PUBLIC_ADMIN_PIN" "$ADMIN_PIN_DEFAULT" "$ENV_FILE"

upsert_env "PUBLIC_INSFORGE_URL" "$INSFORGE_URL" "$ENV_FILE"
upsert_env "PUBLIC_INSFORGE_MODE" "$INSFORGE_MODE" "$ENV_FILE"
upsert_env "PUBLIC_INSFORGE_ANON_KEY" "$ANON_KEY" "$ENV_FILE"
upsert_env "PUBLIC_INSFORGE_SERVICE_KEY" "$SERVICE_KEY" "$ENV_FILE"
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

notify_to="$(env_get NOTIFY_TO "$ENV_FILE")"
[ -z "$notify_to" ] && notify_to="jcamacho-gomez@hotmail.com"
upsert_env "NOTIFY_TO" "$notify_to" "$ENV_FILE"
upsert_env "NOTIFY_FROM" "RK Inversiones <info@renace.tech>" "$ENV_FILE"
if [ -z "$(env_get NOTIFY_SECRET "$ENV_FILE")" ]; then
  upsert_env "NOTIFY_SECRET" "$(openssl rand -hex 24)" "$ENV_FILE"
fi

normalize_env_file "$ENV_FILE"

write_credentials_file() {
  [ -w "$(dirname "$CRED_FILE")" ] 2>/dev/null || return 0
  {
    echo "RK Inversiones — credenciales $(date -Iseconds)"
    echo "Admin panel: https://rk.renace.tech/admin"
    echo "PUBLIC_ADMIN_PIN=$ADMIN_PIN_DEFAULT"
    echo "SMTP_USER=$(env_get SMTP_USER "$ENV_FILE")"
    echo "SMTP_PASS=$(env_get SMTP_PASS "$ENV_FILE")"
    echo "NOTIFY_TO=$(env_get NOTIFY_TO "$ENV_FILE")"
    echo "NOTIFY_FROM=$(env_get NOTIFY_FROM "$ENV_FILE")"
    echo ""
    echo "Archivo confidencial. No compartir ni subir a repositorios."
  } > "$CRED_FILE"
  chmod 600 "$CRED_FILE"
}

if [ -n "$(env_get SMTP_PASS "$ENV_FILE")" ]; then
  write_credentials_file
  green "   Credenciales guardadas en $CRED_FILE"
fi

green "✅ .env listo ($(wc -l < "$ENV_FILE" | tr -d ' ') variables)"
green "   Correo: $(env_get SMTP_USER "$ENV_FILE") → $(env_get NOTIFY_TO "$ENV_FILE")"
