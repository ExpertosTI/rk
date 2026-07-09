#!/usr/bin/env bash
# Genera .env automáticamente — secretos en .smtp.local / .evolution.local
# Uso: ./scripts/seed-env.sh   o   npm run seed:env
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT/.env}"
CRED_FILE="${CRED_FILE:-/root/.rk-inversiones-credentials.txt}"
SMTP_LOCAL="$ROOT/.smtp.local"
EVOLUTION_LOCAL="$ROOT/.evolution.local"

# shellcheck disable=SC1091
source "$ROOT/scripts/lib-insforge.sh"
# shellcheck disable=SC1091
source "$ROOT/scripts/seed.defaults.sh"
if [ -f "$ROOT/scripts/seed.local.sh" ]; then
  # shellcheck disable=SC1091
  source "$ROOT/scripts/seed.local.sh"
fi

green() { printf '\033[32m%s\033[0m\n' "$*"; }
cyan()  { printf '\033[36m%s\033[0m\n' "$*"; }
warn()  { printf '\033[33m%s\033[0m\n' "$*" >&2; }

cyan "── seed-env: generando .env ───────────────────"

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
    ANON_KEY="$RENACE_INSFORGE_ANON_DEFAULT"
    SERVICE_KEY="$RENACE_INSFORGE_ANON_DEFAULT"
    green "   Claves PostgREST (Renace)"
  else
    warn "   Base de datos no detectada — modo desarrollo"
  fi
else
  warn "   Sin Docker — modo desarrollo (API pública)"
fi

upsert_env "PUBLIC_ADMIN_PIN" "$SEED_ADMIN_PIN" "$ENV_FILE"

upsert_env "PUBLIC_INSFORGE_URL" "$INSFORGE_URL" "$ENV_FILE"
upsert_env "PUBLIC_INSFORGE_MODE" "$INSFORGE_MODE" "$ENV_FILE"
upsert_env "PUBLIC_INSFORGE_ANON_KEY" "$ANON_KEY" "$ENV_FILE"
upsert_env "PUBLIC_INSFORGE_SERVICE_KEY" "$SERVICE_KEY" "$ENV_FILE"
upsert_env "INSFORGE_ANON_KEY" "$ANON_KEY" "$ENV_FILE"
upsert_env "INSFORGE_SERVICE_KEY" "$SERVICE_KEY" "$ENV_FILE"

# TransUnion — mock hasta activar suscripción
if [ -z "$(env_get TRANSUNION_MODE "$ENV_FILE")" ]; then
  upsert_env "TRANSUNION_MODE" "mock" "$ENV_FILE"
fi
for key in TRANSUNION_CLIENT_ID TRANSUNION_CLIENT_SECRET TRANSUNION_TOKEN_URL TRANSUNION_API_URL TRANSUNION_SUBSCRIBER_CODE; do
  val="$(env_get "$key" "$ENV_FILE")"
  [ -n "$val" ] && upsert_env "$key" "$val" "$ENV_FILE"
done

# SMTP — clave SOLO desde .smtp.local o credenciales del VPS (nunca hardcodeada)
upsert_env "SMTP_HOST" "$SEED_SMTP_HOST" "$ENV_FILE"
upsert_env "SMTP_PORT" "$SEED_SMTP_PORT" "$ENV_FILE"
upsert_env "SMTP_SECURE" "$SEED_SMTP_SECURE" "$ENV_FILE"
upsert_env "SMTP_USER" "$SEED_SMTP_USER" "$ENV_FILE"

SMTP_PASS=""
if [ -f "$SMTP_LOCAL" ]; then
  SMTP_PASS="$(tr -d '\r\n' < "$SMTP_LOCAL")"
elif [ -f "$CRED_FILE" ]; then
  SMTP_PASS="$(grep '^SMTP_PASS=' "$CRED_FILE" 2>/dev/null | tail -1 | cut -d= -f2- || true)"
fi
if [ -n "$SMTP_PASS" ]; then
  upsert_env "SMTP_PASS" "$SMTP_PASS" "$ENV_FILE"
else
  warn "   SMTP: sin clave — crea $SMTP_LOCAL (una línea con la clave Hostinger)"
fi

# Notificaciones
upsert_env "NOTIFY_TO" "$SEED_NOTIFY_TO" "$ENV_FILE"
upsert_env "NOTIFY_FROM" "RK Inversiones <${SEED_SMTP_USER}>" "$ENV_FILE"
upsert_env "NOTIFY_WHATSAPP_TO" "$SEED_NOTIFY_WHATSAPP_TO" "$ENV_FILE"
upsert_env "BRAND_PHONE" "$SEED_BRAND_PHONE" "$ENV_FILE"
upsert_env "WHATSAPP_NOTIFY_APPLICANT" "$SEED_WHATSAPP_NOTIFY_APPLICANT" "$ENV_FILE"

# WhatsApp — Evolution API (cuando esté desplegada)
load_evolution_local() {
  [ -f "$EVOLUTION_LOCAL" ] || return 0
  while IFS= read -r line || [ -n "$line" ]; do
    line="${line%%#*}"
    line="$(echo "$line" | tr -d '\r')"
    [ -z "$line" ] && continue
    key="${line%%=*}"
    val="${line#*=}"
    case "$key" in
      EVOLUTION_API_URL|EVOLUTION_API_KEY|EVOLUTION_INSTANCE)
        upsert_env "$key" "$val" "$ENV_FILE"
        ;;
    esac
  done < "$EVOLUTION_LOCAL"
}
load_evolution_local

for evo_key in EVOLUTION_API_URL EVOLUTION_API_KEY EVOLUTION_INSTANCE; do
  val="$(env_get "$evo_key" "$ENV_FILE")"
  [ -n "$val" ] && upsert_env "$evo_key" "$val" "$ENV_FILE"
done

if [ -z "$(env_get NOTIFY_SECRET "$ENV_FILE")" ]; then
  upsert_env "NOTIFY_SECRET" "$(openssl rand -hex 24)" "$ENV_FILE"
fi
upsert_env "PUBLIC_NOTIFY_SECRET" "$(env_get NOTIFY_SECRET "$ENV_FILE")" "$ENV_FILE"

normalize_env_file "$ENV_FILE"

write_credentials_file() {
  [ -w "$(dirname "$CRED_FILE")" ] 2>/dev/null || return 0
  {
    echo "RK Inversiones — credenciales $(date -Iseconds)"
    echo "Admin panel: https://rk.renace.tech/admin"
    echo "PUBLIC_ADMIN_PIN=$SEED_ADMIN_PIN"
    echo "SMTP_USER=$(env_get SMTP_USER "$ENV_FILE")"
    echo "SMTP_PASS=$(env_get SMTP_PASS "$ENV_FILE")"
    echo "NOTIFY_TO=$(env_get NOTIFY_TO "$ENV_FILE")"
    echo "NOTIFY_FROM=$(env_get NOTIFY_FROM "$ENV_FILE")"
    echo "NOTIFY_WHATSAPP_TO=$(env_get NOTIFY_WHATSAPP_TO "$ENV_FILE")"
    echo ""
    echo "Secretos en VPS: $SMTP_LOCAL · $EVOLUTION_LOCAL"
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
if [ -n "$(env_get SMTP_PASS "$ENV_FILE")" ]; then
  green "   SMTP: clave cargada desde seed"
else
  warn "⚠️  SMTP_PASS vacío — ejecuta: echo 'TU_CLAVE' > $SMTP_LOCAL && npm run seed"
fi
if [ -n "$(env_get EVOLUTION_API_URL "$ENV_FILE")" ] && [ -n "$(env_get EVOLUTION_API_KEY "$ENV_FILE")" ]; then
  green "   WhatsApp: Evolution API configurada"
  green "   WhatsApp solicitante: $(env_get WHATSAPP_NOTIFY_APPLICANT "$ENV_FILE")"
else
  warn "⚠️  WhatsApp: pendiente Evolution API — cp evolution.local.example .evolution.local"
fi
