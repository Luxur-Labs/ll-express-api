#!/usr/bin/env bash
# On EC2: refresh .env.prod from SSM, log in to ECR, pull image, restart API container.
#
# Prerequisites:
#   - IAM instance profile: ECR pull + ssm:GetParametersByPath on your prefix (see iam-ssm-ec2-policy.example.json).
#   - ECR_IMAGE set in the environment, or a one-line file .env.deploy in ll-express-api/: ECR_IMAGE=...full uri...
#
# Usage:
#   chmod +x scripts/deploy-ecr-with-ssm.sh
#   export ECR_IMAGE=<ACCOUNT>.dkr.ecr.ap-south-2.amazonaws.com/<repo>:<tag>
#   ./scripts/deploy-ecr-with-ssm.sh <aws-account-id> <region> <ssm-prefix>
#
# Optional: run migrations after (when schema changed):
#   docker compose run --rm api npx prisma migrate deploy
set -euo pipefail

ACCOUNT="${1:?Usage: $0 <aws-account-id> <region> <ssm-prefix>}"
REGION="${2:?Missing region argument}"
PREFIX="${3:?Missing ssm-prefix argument}"

_self="${BASH_SOURCE[0]}"
[[ "$_self" != /* ]] && _self="$(pwd)/$_self"
ROOT="$(cd "$(dirname "$_self")/.." && pwd)"
cd "$ROOT"

export COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"

./scripts/ssm-to-env-prod.sh "$REGION" "$PREFIX" "$ROOT/.env.prod"
./scripts/ecr-login.sh "$ACCOUNT" "$REGION"
docker compose pull
docker compose up -d --remove-orphans
echo "OK: API updated. Health: curl -sS http://127.0.0.1:3000/api/v1/health"
echo "Migrations (if needed): docker compose run --rm api npx prisma migrate deploy"
