#!/bin/bash

# Deployment script for updating the application
# Run this from the application directory: /var/www/ll-express-api

set -e  # Exit on error

APP_DIR="/var/www/ll-express-api"
APP_NAME="ll-express-api"

echo "========================================="
echo "Deploying ll-express-api"
echo "========================================="

cd $APP_DIR

# Pull latest changes
echo "Pulling latest changes..."
# Detect current branch or use main/master
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")
git pull origin $BRANCH

# Install/update dependencies
echo "Installing dependencies..."
npm install --production

# Generate Prisma client
echo "Generating Prisma client..."
npm run prisma:generate

# Run database migrations
echo "Running database migrations..."
npx prisma migrate deploy

# Build TypeScript
echo "Building TypeScript..."
npm run build

# Restart application with PM2
echo "Restarting application..."
pm2 restart $APP_NAME

# Show status
echo ""
echo "========================================="
echo "Deployment complete!"
echo "========================================="
pm2 status
pm2 logs $APP_NAME --lines 20

echo ""
echo "Check logs with: pm2 logs $APP_NAME"

