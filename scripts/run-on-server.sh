#!/usr/bin/env bash
# Run TypeScript maintenance scripts on EC2 (or any host with docker + app checkout).
#
# Usage (from /opt/luxur/ll-express-api):
#   chmod +x scripts/run-on-server.sh
#   ./scripts/run-on-server.sh admin
#   EMAIL=admin@luxur.com PASSWORD='your-secret' ./scripts/run-on-server.sh admin
#   ./scripts/run-on-server.sh seed
#   ./scripts/run-on-server.sh demo
#
# Uses .env.prod in the project root for DATABASE_URL (override with ENV_FILE=...).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$APP_DIR"

TASK="${1:-admin}"
ENV_FILE="${ENV_FILE:-.env.prod}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE in $APP_DIR"
  echo "Run: ./scripts/ssm-to-env-prod.sh  (or create .env.prod manually)"
  exit 1
fi

run_in_node_container() {
  local ts_file="$1"
  docker run --rm \
    -v "$APP_DIR":/app \
    -w /app \
    --env-file "$ENV_FILE" \
    -e EMAIL="${EMAIL:-}" \
    -e PASSWORD="${PASSWORD:-}" \
    -e BCRYPT_SALT_ROUNDS="${BCRYPT_SALT_ROUNDS:-}" \
    -e ENV_FILE="$ENV_FILE" \
    node:22-alpine sh -lc "
      apk add --no-cache openssl libc6-compat >/dev/null
      npm ci
      npx prisma generate
      npx ts-node $ts_file
    "
}

run_via_compose_exec() {
  local ts_file="$1"
  if docker compose ps --status running api 2>/dev/null | grep -q api; then
    docker compose exec \
      -e EMAIL="${EMAIL:-}" \
      -e PASSWORD="${PASSWORD:-}" \
      -e BCRYPT_SALT_ROUNDS="${BCRYPT_SALT_ROUNDS:-}" \
      -e ENV_FILE="$ENV_FILE" \
      api npx ts-node "$ts_file"
    return 0
  fi
  return 1
}

run_ts() {
  local ts_file="$1"
  if run_via_compose_exec "$ts_file"; then
    return
  fi
  echo "api container not running — using one-off node:22-alpine container..."
  run_in_node_container "$ts_file"
}

run_in_node_container_npm() {
  local npm_script="$1"
  docker run --rm \
    -v "$APP_DIR":/app \
    -w /app \
    --env-file "$ENV_FILE" \
    -e EMAIL="${EMAIL:-}" \
    -e PASSWORD="${PASSWORD:-}" \
    -e BCRYPT_SALT_ROUNDS="${BCRYPT_SALT_ROUNDS:-}" \
    -e ENV_FILE="$ENV_FILE" \
    node:22-alpine sh -lc "
      apk add --no-cache openssl libc6-compat >/dev/null
      npm ci
      npx prisma generate
      npm run $npm_script
    "
}

run_via_compose_exec_npm() {
  local npm_script="$1"
  if docker compose ps --status running api 2>/dev/null | grep -q api; then
    docker compose exec \
      -e EMAIL="${EMAIL:-}" \
      -e PASSWORD="${PASSWORD:-}" \
      -e BCRYPT_SALT_ROUNDS="${BCRYPT_SALT_ROUNDS:-}" \
      -e ENV_FILE="$ENV_FILE" \
      api npm run "$npm_script"
    return 0
  fi
  return 1
}

run_npm() {
  local npm_script="$1"
  if run_via_compose_exec_npm "$npm_script"; then
    return
  fi
  echo "api container not running — using one-off node:22-alpine container..."
  run_in_node_container_npm "$npm_script"
}

case "$TASK" in
  admin)
    run_npm prisma:seed:admin
    ;;
  seed)
    run_npm prisma:seed
    ;;
  demo)
    run_npm prisma:seed:demo
    ;;
  *)
    echo "Unknown task: $TASK"
    echo "Usage: $0 {admin|seed|demo}"
    exit 1
    ;;
esac
