#!/usr/bin/env bash
# Manual deploy: Express API to ECR and/or EC2.
# GitHub Actions: build/push inlined in deploy-manual.yml; EC2 deploy via SSM Run Command.
#
# Usage (from backend repo root):
#   ./scripts/deploy-aws.sh local          # workstation: AWS SSO + build + push
#   ./scripts/deploy-aws.sh local --ssh    # then SSH to EC2 (needs EC2_HOST, EC2_PEM)
#   ./scripts/deploy-aws.sh ci-local       # build + push when AWS creds are already set
#   ./scripts/deploy-aws.sh ec2            # on EC2: SSM env, pull image, restart, migrate
#
# Required env (or .env.deploy): see .env.deploy.example
# Optional: SKIP_MIGRATE=1, SKIP_AWS_LOGIN=1, ECR_IMAGE_TAG (default: latest), COMPOSE_FILE

set -euo pipefail

_self="${BASH_SOURCE[0]}"
[[ "$_self" != /* ]] && _self="$(pwd)/$_self"
APP_DIR="$(cd "$(dirname "$_self")/.." && pwd)"

if [[ -f "$APP_DIR/.env.deploy" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$APP_DIR/.env.deploy"
  set +a
fi

require_vars() {
  local missing=()
  for name in "$@"; do
    if [[ -z "${!name:-}" ]]; then
      missing+=("$name")
    fi
  done
  if ((${#missing[@]})); then
    echo "Missing required environment variables:" >&2
    printf '  %s\n' "${missing[@]}" >&2
    echo "Set them in the environment, in .env.deploy, or in GitHub Secrets for CI." >&2
    exit 1
  fi
}

require_backend_config() {
  require_vars AWS_REGION AWS_ACCOUNT_ID ECR_REPOSITORY SSM_PREFIX
  ECR_REGISTRY="${ECR_REGISTRY:-${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com}"
  ECR_IMAGE="${ECR_IMAGE:-${ECR_REGISTRY}/${ECR_REPOSITORY}:${ECR_IMAGE_TAG:-latest}}"
}

usage() {
  echo "Usage: $0 {local|ci-local|ec2} [--ssh]"
  exit 1
}

require_app_dir() {
  if [[ ! -f "$APP_DIR/docker-compose.yml" ]]; then
    echo "docker-compose.yml not found in $APP_DIR" >&2
    exit 1
  fi
}

build_and_push_image() {
  require_backend_config
  require_app_dir
  echo "==> ECR login"
  aws ecr get-login-password --region "$AWS_REGION" | \
    docker login --username AWS --password-stdin "$ECR_REGISTRY"
  echo "==> Docker build"
  docker build -t ll-express-api:latest "$APP_DIR"
  docker tag ll-express-api:latest "$ECR_IMAGE"
  docker push "$ECR_IMAGE"
  echo "OK: Image pushed to $ECR_IMAGE"
}

cmd_local() {
  local do_ssh=false
  [[ "${1:-}" == "--ssh" ]] && do_ssh=true
  aws configure sso
  build_and_push_image
  if $do_ssh; then
    require_vars EC2_HOST EC2_PEM
    ssh -i "$EC2_PEM" "$EC2_HOST"
  else
    echo "Next on EC2: cd \$EC2_APP_DIR && ./scripts/deploy-aws.sh ec2"
  fi
}

cmd_ci_local() {
  build_and_push_image
}

cmd_ec2() {
  require_backend_config
  require_app_dir
  cd "$APP_DIR"
  export COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"

  if [[ "${GITHUB_ACTIONS:-}" != "true" && "${SKIP_AWS_LOGIN:-0}" != "1" ]]; then
    aws login --remote
  fi

  aws ecr get-login-password --region "$AWS_REGION" | \
    docker login --username AWS --password-stdin "$ECR_REGISTRY"
  ./scripts/deploy-ecr-with-ssm.sh "$AWS_ACCOUNT_ID" "$AWS_REGION" "$SSM_PREFIX"

  if [[ "${SKIP_MIGRATE:-0}" != "1" ]]; then
    docker compose run --rm api npx prisma migrate deploy
  fi

  curl -sS http://127.0.0.1:3000/api/v1/health || true
  echo "OK: Backend deployed."
}

case "${1:-}" in
  local) cmd_local "${2:-}" ;;
  ci-local) cmd_ci_local ;;
  ec2) cmd_ec2 ;;
  *) usage ;;
esac
