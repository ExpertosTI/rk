#!/usr/bin/env bash
# Configura correo Hostinger (info@renace.tech) en el VPS — una sola vez.
# Uso: ./scripts/setup-smtp.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SMTP_LOCAL="$ROOT/.smtp.local"
CRED_FILE="${CRED_FILE:-/root/.rk-inversiones-credentials.txt}"

cyan() { printf '\033[36m%s\033[0m\n' "$*"; }
green() { printf '\033[32m%s\033[0m\n' "$*"; }
warn() { printf '\033[33m%s\033[0m\n' "$*" >&2; }

if [ -f "$SMTP_LOCAL" ]; then
  warn "Ya existe $SMTP_LOCAL — no se sobrescribe."
  warn "Para cambiar la clave, borre ese archivo y vuelva a ejecutar este script."
  exit 0
fi

cyan "Configuración SMTP — buzón info@renace.tech (Hostinger)"
printf 'Clave del buzón (no se muestra en pantalla): '
read -rs SMTP_PASS
echo ""

if [ -z "$SMTP_PASS" ]; then
  warn "Clave vacía — cancelado."
  exit 1
fi

printf '%s' "$SMTP_PASS" > "$SMTP_LOCAL"
chmod 600 "$SMTP_LOCAL"
unset SMTP_PASS

green "✅ Guardado en .smtp.local"

if [ -x "$ROOT/scripts/seed-env.sh" ]; then
  "$ROOT/scripts/seed-env.sh"
fi

green "Listo. Ejecute: ./deploy.sh"
