#!/usr/bin/env bash
# Docker login to Amazon ECR. Run on your workstation or on EC2 before compose pull.
#
# Usage: ./scripts/ecr-login.sh <aws-account-id> [region]
# Example: ./scripts/ecr-login.sh 123456789012 ap-south-2
set -euo pipefail

ACCOUNT="${1:?AWS account ID required}"
REGION="${2:-ap-south-2}"
REGISTRY="${ACCOUNT}.dkr.ecr.${REGION}.amazonaws.com"

aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "$REGISTRY"
echo "Logged in to $REGISTRY"
