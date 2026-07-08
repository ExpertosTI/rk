#!/usr/bin/env bash
# RK Inversiones — Despliegue producción (Renace)
# Traefik → rk_web · seed · build · stack deploy
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/ExpertosTI/rk.git}"
PROJECT_DIR="${PROJECT_DIR:-/opt/rk}"
STACK_NAME="${STACK_NAME:-rk}"
DOMAIN="${DOMAIN:-rk.renace.tech}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"

cyan()  { printf "\033[36m%s\033[0m\n" "$*"; }
green() { printf "\033[32m%s\033[0m\n" "$*"; }
red()   { printf "\033[31m%s\033[0m\n" "$*" >&2; }
warn()  { printf "\033[33m%s\033[0m\n" "$*" >&2; }

api_returns_json() {
  local url="$1" body
  body="$(curl -fsS "$url" -H 'Accept: application/json' 2>/dev/null || true)"
  case "$body" in
    \[*|{*) return 0 ;;
    *) return 1 ;;
  esac
}

wait_http_ok() {
  local url="$1" label="$2" tries="${3:-24}" i
  for i in $(seq 1 "$tries"); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      return 0
    fi
    warn "   ${label}… (${i}/${tries})"
    sleep 5
  done
  return 1
}

wait_notify_smtp() {
  local url="https://${DOMAIN}/api/notify/healthz" i body
  for i in $(seq 1 15); do
    body="$(curl -fsS "$url" 2>/dev/null || true)"
    case "$body" in
      *'"smtp":true'*) return 0 ;;
    esac
    [ "$i" -lt 15 ] && warn "   notify/SMTP iniciando… (${i}/15)" && sleep 4
  done
  return 1
}

cyan "══════════════════════════════════════════════"
cyan "  RK INVERSIONES — DESPLIEGUE PRODUCCIÓN"
cyan "  https://${DOMAIN}"
cyan "  Rama: ${DEPLOY_BRANCH}"
cyan "══════════════════════════════════════════════"

cyan "── 1. Sincronizar repo ────────────────────────"
if [ -d "$PROJECT_DIR/.git" ]; then
  cd "$PROJECT_DIR"
  git fetch origin "$DEPLOY_BRANCH"
  git checkout "$DEPLOY_BRANCH" 2>/dev/null || git checkout -b "$DEPLOY_BRANCH" "origin/$DEPLOY_BRANCH"
  git reset --hard "origin/$DEPLOY_BRANCH"
else
  git clone --branch "$DEPLOY_BRANCH" "$REPO_URL" "$PROJECT_DIR"
  cd "$PROJECT_DIR"
fi
chmod +x deploy.sh scripts/*.sh 2>/dev/null || true

if [ "${RK_DEPLOY_REEXEC:-}" != "1" ]; then
  RK_DEPLOY_REEXEC=1 exec "$PROJECT_DIR/deploy.sh"
fi

cyan "── 2. Seed ────────────────────────────────────"
./scripts/seed.sh

set -a
# shellcheck disable=SC1091
source .env
set +a
export PUBLIC_BUILD_ID="$(git rev-parse --short HEAD)"

if [ -n "${SMTP_PASS:-}" ]; then
  green "   SMTP_PASS cargado en entorno de deploy"
else
  warn "⚠️  SMTP_PASS vacío — crea .smtp.local y vuelve a ejecutar ./deploy.sh"
fi

cyan "── 3. Build ───────────────────────────────────"
export DOCKER_BUILDKIT=1
# web sin caché: nginx.conf y claves JWT van embebidas en la imagen
docker compose build --no-cache web
docker compose build --no-cache bureau notify

cyan "── 4. Red + PostgREST ─────────────────────────"
docker network inspect RenaceNet >/dev/null 2>&1 \
  || docker network create --driver overlay --attachable RenaceNet
postgrest_svc="$(docker service ls --format '{{.Name}}' | grep -Ei 'insforge.*postgrest|postgrest.*insforge' | head -1 || true)"
if [ -n "$postgrest_svc" ]; then
  docker service update --network-add RenaceNet "$postgrest_svc" >/dev/null 2>&1 || true
  cyan "   RenaceNet: ${postgrest_svc}"
fi

cyan "── 5. Stack (Traefik) ───────────────────────────"
docker service rm "${STACK_NAME}_insforge-proxy" >/dev/null 2>&1 || true
docker stack deploy -c docker-compose.yml "$STACK_NAME"

cyan "── 6. Aplicar imágenes + env notify ───────────"
docker service update --force --detach=false "${STACK_NAME}_web" >/dev/null
docker service update --force --detach=true "${STACK_NAME}_bureau" >/dev/null 2>&1 || true
./scripts/sync-notify-env.sh

cyan "── 7. Verificar ───────────────────────────────"
if ! wait_http_ok "https://${DOMAIN}/healthz" "Sitio iniciando"; then
  red "❌ /healthz no responde — revisa:"
  red "   docker service ps ${STACK_NAME}_web"
  red "   docker service logs ${STACK_NAME}_web --tail 40"
  exit 1
fi

api_ok=0
for i in $(seq 1 12); do
  if api_returns_json "https://${DOMAIN}/api/insforge/rk_solicitudes?limit=1"; then
    api_ok=1
    break
  fi
  warn "   API iniciando… (${i}/12)"
  sleep 5
done

green "✅ Producción activa: https://${DOMAIN}"
green "   Commit: $(git rev-parse --short HEAD)"
if [ "$api_ok" -eq 1 ]; then
  green "   Base de datos: conectada"
  anon_key="$(grep -E '^PUBLIC_INSFORGE_ANON_KEY=' .env 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '"' || true)"
  if [ -n "$anon_key" ]; then
  auth_head="$(curl -fsS "https://${DOMAIN}/api/insforge/rk_solicitudes?limit=1" \
    -H 'Accept: application/json' \
    -H "apikey: ${anon_key}" -H "Authorization: Bearer ${anon_key}" 2>/dev/null | head -c 1 || true)"
  if [ "$auth_head" = "[" ] || [ "$auth_head" = "{" ]; then
    green "   Panel admin: claves OK"
  else
    warn "⚠️  API con auth falló — rehacer deploy tras seed-env"
  fi
  fi
  if api_returns_json "https://${DOMAIN}/api/bureau/healthz"; then
    green "   Bureau: ok"
  fi
  notify_smtp=""
  if wait_notify_smtp; then
    notify_smtp='"smtp":true'
  fi
  if [ -n "$notify_smtp" ]; then
    green "   Correo SMTP: configurado"
  else
    warn "⚠️  SMTP sin clave en notify — ./scripts/sync-notify-env.sh"
    warn "   Revisa: docker service inspect ${STACK_NAME}_notify --format '{{range .Spec.TaskTemplate.ContainerSpec.Env}}{{println .}}{{end}}' | grep SMTP"
  fi
  notify_wa="$(curl -fsS "https://${DOMAIN}/api/notify/healthz" 2>/dev/null | grep -o '"whatsapp":true' || true)"
  if [ -n "$notify_wa" ]; then
    green "   WhatsApp: configurado"
  else
    warn "⚠️  WhatsApp pendiente — Evolution API (.evolution.local)"
  fi
else
  red "❌ API no responde JSON — revisa:"
  red "   docker service logs ${STACK_NAME}_web --tail 40"
  docker image prune -f >/dev/null
  exit 1
fi
docker image prune -f >/dev/null
