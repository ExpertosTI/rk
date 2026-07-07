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

cyan "══════════════════════════════════════════════"
cyan "  RK INVERSIONES — DESPLIEGUE PRODUCCIÓN"
cyan "  https://${DOMAIN}"
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
./scripts/seed-env.sh
./scripts/seed-db.sh

set -a
# shellcheck disable=SC1091
source .env
set +a
export PUBLIC_BUILD_ID="$(git rev-parse --short HEAD)"

cyan "── 3. Build ───────────────────────────────────"
export DOCKER_BUILDKIT=1
# web sin caché: nginx.conf y claves JWT van embebidas en la imagen
docker compose build --no-cache web
docker compose build bureau notify

cyan "── 4. Red + PostgREST ─────────────────────────"
docker network inspect RenaceNet >/dev/null 2>&1 \
  || docker network create --driver overlay --attachable RenaceNet
postgrest_svc="$(docker service ls --format '{{.Name}}' | grep -Ei 'insforge.*postgrest|postgrest.*insforge' | head -1 || true)"
if [ -n "$postgrest_svc" ]; then
  docker service update --network-add RenaceNet "$postgrest_svc" >/dev/null 2>&1 || true
  cyan "   RenaceNet: ${postgrest_svc}"
fi

cyan "── 5. Stack (Traefik) ───────────────────────────"
# Quitar servicio legacy si quedó de despliegues anteriores
docker service rm "${STACK_NAME}_insforge-proxy" >/dev/null 2>&1 || true
docker stack deploy -c docker-compose.yml "$STACK_NAME"

cyan "── 6. Aplicar imágenes ────────────────────────"
for svc in web bureau notify; do
  docker service update --force --detach=true "${STACK_NAME}_${svc}" >/dev/null
done

cyan "── 7. Verificar ───────────────────────────────"
sleep 10
curl -fsS "https://${DOMAIN}/healthz" >/dev/null

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
  if api_returns_json "https://${DOMAIN}/api/bureau/healthz"; then
    green "   Bureau: ok"
  fi
else
  red "❌ API no responde JSON — revisa:"
  red "   docker service logs ${STACK_NAME}_web --tail 40"
  docker image prune -f >/dev/null
  exit 1
fi
docker image prune -f >/dev/null
