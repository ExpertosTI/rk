#!/usr/bin/env bash
# RK Inversiones — checks antes de push (build + seguridad básica)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

red()   { printf "\033[31m✗ %s\033[0m\n" "$*" >&2; }
green() { printf "\033[32m✓ %s\033[0m\n" "$*"; }
cyan()  { printf "\033[36m→ %s\033[0m\n" "$*"; }

cyan "prepush — RK Inversiones"

# 1. Archivos sensibles no deben estar en staging
FORBIDDEN_PATHS=(
  .env
  .env.local
  .env.production
  scripts/seed.local.sh
  scripts/smtp.secret
  .smtp.local
  .evolution.local
)

STAGED="$(git diff --cached --name-only 2>/dev/null || true)"
if [ -n "$STAGED" ]; then
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    for bad in "${FORBIDDEN_PATHS[@]}"; do
      if [ "$f" = "$bad" ] || [[ "$f" == .env.* && "$f" != ".env.example" ]]; then
        red "Archivo sensible en staging: $f"
        exit 1
      fi
    done
  done <<< "$STAGED"
fi

# 2. Patrones de secretos en diff (staged + unstaged del commit pendiente)
PATTERNS=(
  'SMTP_PASS\s*=\s*[^$\s]'
  'GEMINI_API_KEY\s*=\s*[^$\s]'
  'INSFORGE_.*KEY\s*=\s*[^$\s]'
  'JWT_SECRET\s*=\s*[^$\s]'
  'AKIA[0-9A-Z]{16}'
  '-----BEGIN (RSA |OPENSSH )?PRIVATE KEY-----'
)

scan_diff() {
  local diff="$1"
  [ -z "$diff" ] && return 0
  for pat in "${PATTERNS[@]}"; do
    if echo "$diff" | grep -qE "^\+.*${pat}"; then
      red "Posible secreto en diff (+ línea coincide: ${pat})"
      red "Revisa antes de commitear. Usa variables de entorno en .env (gitignored)."
      return 1
    fi
  done
  return 0
}

DIFF_CACHED="$(git diff --cached 2>/dev/null || true)"
DIFF_WORK="$(git diff 2>/dev/null || true)"
scan_diff "$DIFF_CACHED" || exit 1
scan_diff "$DIFF_WORK" || exit 1

green "Sin archivos sensibles ni patrones de secretos en diff"

# 3. Build de producción
cyan "npm run build"
npm run build --silent 2>/dev/null || npm run build

green "Build OK"

# 4. Resumen git
BRANCH="$(git branch --show-current)"
AHEAD="$(git rev-list --count @{u}..HEAD 2>/dev/null || echo 0)"
cyan "rama: ${BRANCH} · commits por push: ${AHEAD} (+ pendientes de commit)"

green "prepush listo — seguro para commit/push"
