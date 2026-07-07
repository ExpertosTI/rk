#!/usr/bin/env bash
# RK Inversiones — Renace Protocol deploy.sh
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/ExpertosTI/rk.git}"
PROJECT_DIR="${PROJECT_DIR:-/opt/rk}"
STACK_NAME="${STACK_NAME:-rk}"
SERVICE_NAME="${STACK_NAME}_web"
DOMAIN="${DOMAIN:-rk.renace.tech}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"

cyan()  { printf "\033[36m%s\033[0m\n" "$*"; }
green() { printf "\033[32m%s\033[0m\n" "$*"; }

cyan "── 1. Sync source ($DEPLOY_BRANCH) ─────────────"
if [ -d "$PROJECT_DIR/.git" ]; then
  cd "$PROJECT_DIR"
  git fetch origin "$DEPLOY_BRANCH"
  git checkout "$DEPLOY_BRANCH" 2>/dev/null || git checkout -b "$DEPLOY_BRANCH" "origin/$DEPLOY_BRANCH"
  git reset --hard "origin/$DEPLOY_BRANCH"
else
  git clone --branch "$DEPLOY_BRANCH" "$REPO_URL" "$PROJECT_DIR"
  cd "$PROJECT_DIR"
fi

cyan "── 2. Build image ───────────────────────────────"
export DOCKER_BUILDKIT=1
nice -n 19 ionice -c 3 docker compose build --pull

cyan "── 3. Ensure RenaceNet exists ─────────────────"
if ! docker network ls --format '{{.Name}}' | grep -qx "RenaceNet"; then
  docker network create --driver overlay --attachable RenaceNet
fi

cyan "── 4. Deploy stack ($STACK_NAME → $DOMAIN) ────"
docker stack deploy -c docker-compose.yml "$STACK_NAME"

cyan "── 5. Force service update ────────────────────"
docker service update --force "$SERVICE_NAME" >/dev/null 2>&1 || true

docker image prune -f >/dev/null

green ""
green "✅ RK Inversiones deployed."
green "   Site:    https://$DOMAIN"
green "   Service: $SERVICE_NAME"
green "   Commit:  $(git rev-parse --short HEAD)"
