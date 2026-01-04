#!/bin/bash

# EC2 Server Setup Script for ll-express-api
# Run this script on a fresh Ubuntu 22.04 LTS EC2 instance

set -e  # Exit on error

echo "========================================="
echo "Setting up EC2 server for ll-express-api"
echo "========================================="

# Update system packages
echo "Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install Node.js 20.x (LTS)
echo "Installing Node.js 20.x..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install PostgreSQL (optional - remove if using RDS)
echo "Installing PostgreSQL..."
sudo apt install -y postgresql postgresql-contrib

# Install Nginx
echo "Installing Nginx..."
sudo apt install -y nginx

# Install PM2 globally
echo "Installing PM2..."
sudo npm install -g pm2

# Install Git
echo "Installing Git..."
sudo apt install -y git

# Install build essentials (for native modules)
echo "Installing build essentials..."
sudo apt install -y build-essential

# Install Certbot for SSL (optional)
echo "Installing Certbot..."
sudo apt install -y certbot python3-certbot-nginx

# Configure firewall
echo "Configuring firewall..."
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw --force enable

# Verify installations
echo ""
echo "========================================="
echo "Installation complete! Verifying..."
echo "========================================="
echo "Node.js version: $(node --version)"
echo "npm version: $(npm --version)"
echo "PM2 version: $(pm2 --version)"
echo "PostgreSQL version: $(psql --version)"
echo "Nginx version: $(nginx -v 2>&1)"

echo ""
echo "========================================="
echo "Next steps:"
echo "========================================="
echo "1. Clone your repository to /var/www/ll-express-api"
echo "2. Create .env file with required environment variables"
echo "3. Run: npm install && npm run build"
echo "4. Setup database: npx prisma migrate deploy"
echo "5. Start with PM2: pm2 start ecosystem.config.js"
echo "6. Configure Nginx: sudo cp deploy/nginx.conf /etc/nginx/sites-available/ll-express-api"
echo "7. Enable site: sudo ln -s /etc/nginx/sites-available/ll-express-api /etc/nginx/sites-enabled/"
echo "8. Test and restart Nginx: sudo nginx -t && sudo systemctl restart nginx"
echo "========================================="

