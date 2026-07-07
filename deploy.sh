#!/usr/bin/env bash
# RK Inversiones — Despliegue PRINCIPAL a producción (Renace Protocol)
# Dominio: https://rk.renace.tech
# VPS:     root@45.9.191.18  ·  /opt/rk
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/ExpertosTI/rk.git}"
PROJECT_DIR="${PROJECT_DIR:-/opt/rk}"
STACK_NAME="${STACK_NAME:-rk}"
SERVICE_NAME="${STACK_NAME}_web"
DOMAIN="${DOMAIN:-rk.renace.tech}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"

cyan()  { printf "\033[36m%s\033[0m\n" "$*"; }
green() { printf "\033[32m%s\033[0m\n" "$*"; }
red()   { printf "\033[31m%s\033[0m\n" "$*" >&2; }
warn()  { printf "\033[33m%s\033[0m\n" "$*" >&2; }

cyan "══════════════════════════════════════════════"
cyan "  RK INVERSIONES — DESPLIEGUE PRODUCCIÓN"
cyan "  https://${DOMAIN}"
cyan "══════════════════════════════════════════════"

cyan "── 1. Clonar / sincronizar repo ───────────────"
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

# Tras git pull, re-ejecutar con el deploy.sh actualizado (evita script viejo en memoria)
if [ "${RK_DEPLOY_REEXEC:-}" != "1" ]; then
  RK_DEPLOY_REEXEC=1 exec "$PROJECT_DIR/deploy.sh"
fi

cyan "── 2. Seed (claves + base de datos) ───────────"
if [ -x scripts/seed-env.sh ]; then
  ./scripts/seed-env.sh
fi
if [ -x scripts/seed-db.sh ]; then
  ./scripts/seed-db.sh || warn "⚠️  seed-db falló — el deploy continúa; reintente: ./scripts/seed-db.sh"
fi

set -a
[ -f .env ] && source .env
set +a
export PUBLIC_BUILD_ID="$(git rev-parse --short HEAD)"

cyan "── 3. Build imágenes Docker ─────────────────────"
export DOCKER_BUILDKIT=1
nice -n 19 ionice -c 3 docker compose build --pull web bureau notify insforge-proxy

cyan "── 4. Red RenaceNet ───────────────────────────"
if ! docker network ls --format '{{.Name}}' | grep -qx "RenaceNet"; then
  docker network create --driver overlay --attachable RenaceNet
fi

# PostgREST debe estar en RenaceNet (lo alcanza insforge-proxy del stack rk)
postgrest_svc="$(docker service ls --format '{{.Name}}' | grep -Ei 'insforge.*postgrest|postgrest.*insforge' | head -1 || true)"
if [ -n "$postgrest_svc" ]; then
  docker service update --network-add RenaceNet "$postgrest_svc" >/dev/null 2>&1 || true
  cyan "   RenaceNet: ${postgrest_svc}"
fi

cyan "── 5. Stack Swarm + Traefik ───────────────────"
docker stack deploy -c docker-compose.yml "$STACK_NAME"

# Swarm no reinicia contenedores si el tag :latest no cambió en registry
cyan "── 6. Aplicar imágenes ────────────────────────"
docker service update --force --detach=true "${SERVICE_NAME}" >/dev/null
docker service update --force --detach=true "${STACK_NAME}_bureau" >/dev/null 2>&1 || true
docker service update --force --detach=true "${STACK_NAME}_notify" >/dev/null 2>&1 || true
docker service update --force --detach=true "${STACK_NAME}_insforge-proxy" >/dev/null 2>&1 || true

cyan "── 7. Esperar healthcheck ─────────────────────"
sleep 8
for i in 1 2 3 4 5 6 7 8; do
  if curl -fsS "https://${DOMAIN}/healthz" >/dev/null 2>&1; then
    api_head="$(curl -fsS "https://${DOMAIN}/api/insforge/rk_solicitudes?limit=0" -H 'Accept: application/json' 2>/dev/null | head -c 1 || true)"
    green "✅ Producción activa: https://${DOMAIN}"
    green "   Commit:  $(git rev-parse --short HEAD)"
    if [ "$api_head" = "[" ] || [ "$api_head" = "{" ]; then
      green "   Base de datos: conectada"
    elif [ "$i" -lt 8 ]; then
      warn "   API aún iniciando… (${i}/8)"
      sleep 4
      continue
    else
      warn "⚠️  API base de datos no responde JSON"
    fi
    docker image prune -f >/dev/null
    exit 0
  fi
  sleep 2
done

red "⚠️  Stack desplegado pero healthcheck aún no responde."
red "   Verifica: docker service logs ${SERVICE_NAME}"
red "   URL:      https://${DOMAIN}/healthz"
exit 1
