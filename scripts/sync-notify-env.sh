#!/usr/bin/env bash
# Sincroniza variables de notify en Docker Swarm (SMTP, Evolution, etc.)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT/.env}"
STACK_NAME="${STACK_NAME:-rk}"
SVC="${STACK_NAME}_notify"

# shellcheck disable=SC1091
source "$ROOT/scripts/lib-insforge.sh"

if [ ! -f "$ENV_FILE" ]; then
  echo "❌ No existe $ENV_FILE — ejecuta ./scripts/seed.sh primero" >&2
  exit 1
fi

read_env() {
  env_get "$1" "$ENV_FILE"
}

SMTP_HOST="$(read_env SMTP_HOST)"
SMTP_PORT="$(read_env SMTP_PORT)"
SMTP_SECURE="$(read_env SMTP_SECURE)"
SMTP_USER="$(read_env SMTP_USER)"
SMTP_PASS="$(read_env SMTP_PASS)"
NOTIFY_FROM="$(read_env NOTIFY_FROM)"
NOTIFY_TO="$(read_env NOTIFY_TO)"
NOTIFY_SECRET="$(read_env NOTIFY_SECRET)"
NOTIFY_WHATSAPP_TO="$(read_env NOTIFY_WHATSAPP_TO)"
BRAND_PHONE="$(read_env BRAND_PHONE)"
EVOLUTION_API_URL="$(read_env EVOLUTION_API_URL)"
EVOLUTION_API_KEY="$(read_env EVOLUTION_API_KEY)"
EVOLUTION_INSTANCE="$(read_env EVOLUTION_INSTANCE)"
WHATSAPP_NOTIFY_APPLICANT="$(read_env WHATSAPP_NOTIFY_APPLICANT)"

[ -n "$SMTP_PORT" ] || SMTP_PORT="465"
[ -n "$SMTP_SECURE" ] || SMTP_SECURE="true"
[ -n "$WHATSAPP_NOTIFY_APPLICANT" ] || WHATSAPP_NOTIFY_APPLICANT="true"

if [ -z "$SMTP_PASS" ]; then
  echo "⚠️  SMTP_PASS vacío en .env — revisa .smtp.local" >&2
fi

ENV_KEYS=(
  SMTP_HOST SMTP_PORT SMTP_SECURE SMTP_USER SMTP_PASS
  NOTIFY_FROM NOTIFY_TO NOTIFY_SECRET NOTIFY_WHATSAPP_TO BRAND_PHONE
  EVOLUTION_API_URL EVOLUTION_API_KEY EVOLUTION_INSTANCE WHATSAPP_NOTIFY_APPLICANT
)

args=()
for key in "${ENV_KEYS[@]}"; do
  args+=(--env-rm "$key")
done

args+=(
  --env-add "SMTP_HOST=${SMTP_HOST}"
  --env-add "SMTP_PORT=${SMTP_PORT}"
  --env-add "SMTP_SECURE=${SMTP_SECURE}"
  --env-add "SMTP_USER=${SMTP_USER}"
  --env-add "SMTP_PASS=${SMTP_PASS}"
  --env-add "NOTIFY_FROM=${NOTIFY_FROM}"
  --env-add "NOTIFY_TO=${NOTIFY_TO}"
  --env-add "NOTIFY_SECRET=${NOTIFY_SECRET}"
  --env-add "NOTIFY_WHATSAPP_TO=${NOTIFY_WHATSAPP_TO}"
  --env-add "BRAND_PHONE=${BRAND_PHONE}"
  --env-add "EVOLUTION_API_URL=${EVOLUTION_API_URL}"
  --env-add "EVOLUTION_API_KEY=${EVOLUTION_API_KEY}"
  --env-add "EVOLUTION_INSTANCE=${EVOLUTION_INSTANCE}"
  --env-add "WHATSAPP_NOTIFY_APPLICANT=${WHATSAPP_NOTIFY_APPLICANT}"
  --force
)

echo "── sync-notify-env: ${SVC} ────────────────────"
docker service update --detach=false "$SVC" "${args[@]}"

if [ -n "$SMTP_PASS" ]; then
  echo "✅ notify actualizado (SMTP_PASS presente)"
else
  echo "⚠️  notify actualizado sin SMTP_PASS"
fi
