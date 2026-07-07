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

cyan "── 2. Seed (claves + base de datos) ───────────"
if [ ! -f .smtp.local ] && [ -f /root/.rk-inversiones-credentials.txt ]; then
  cred_pass="$(grep '^SMTP_PASS=' /root/.rk-inversiones-credentials.txt 2>/dev/null | tail -1 | cut -d= -f2- || true)"
  if [ -n "$cred_pass" ]; then
    printf '%s' "$cred_pass" > .smtp.local
    chmod 600 .smtp.local
  fi
fi
if [ ! -f .smtp.local ] && ! grep -q '^SMTP_PASS=.\+' .env 2>/dev/null; then
  warn "⚠️  Correo: coloque .smtp.local en $PROJECT_DIR antes del seed (Hostinger)"
fi
if [ -x scripts/seed.sh ]; then
  ./scripts/seed.sh
fi

set -a
[ -f .env ] && source .env
set +a

cyan "── 3. Build imágenes Docker ─────────────────────"
export DOCKER_BUILDKIT=1
nice -n 19 ionice -c 3 docker compose build --pull web bureau notify

cyan "── 4. Red RenaceNet ───────────────────────────"
if ! docker network ls --format '{{.Name}}' | grep -qx "RenaceNet"; then
  docker network create --driver overlay --attachable RenaceNet
fi

cyan "── 5. Stack Swarm + Traefik ───────────────────"
docker stack deploy -c docker-compose.yml "$STACK_NAME"

cyan "── 6. Reiniciar servicios ──────────────────────"
for svc in "${SERVICE_NAME}" "${STACK_NAME}_bureau" "${STACK_NAME}_notify"; do
  for i in 1 2 3 4 5 6 7 8 9 10; do
    if docker service ls --format '{{.Name}}' | grep -qx "$svc"; then
      docker service update --force "$svc" >/dev/null 2>&1 || true
      break
    fi
    sleep 3
  done
done

cyan "── 7. Esperar healthcheck ─────────────────────"
sleep 8
for i in 1 2 3 4 5; do
  if curl -fsS "https://${DOMAIN}/healthz" >/dev/null 2>&1; then
    green "✅ Producción activa: https://${DOMAIN}"
    green "   Stack:   ${STACK_NAME}"
    green "   Service: ${SERVICE_NAME}"
    green "   Commit:  $(git rev-parse --short HEAD)"
    docker image prune -f >/dev/null
    exit 0
  fi
  sleep 5
done

red "⚠️  Stack desplegado pero healthcheck aún no responde."
red "   Verifica: docker service logs ${SERVICE_NAME}"
red "   URL:      https://${DOMAIN}/healthz"
exit 1
