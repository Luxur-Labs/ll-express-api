# Deployment Files

This directory contains all the files needed to deploy the ll-express-api to an EC2 instance.

## Files Overview

### `setup-server.sh`
Initial server setup script. Installs all required dependencies on a fresh Ubuntu EC2 instance:
- Node.js 20.x
- PostgreSQL
- Nginx
- PM2
- Git
- Build tools
- Certbot (for SSL)

**Usage:**
```bash
chmod +x setup-server.sh
./setup-server.sh
```

### `deploy.sh`
Application deployment script. Updates the application with latest code:
- Pulls latest changes from Git
- Installs dependencies
- Runs database migrations
- Builds the application
- Restarts PM2 process

**Usage:**
```bash
cd /var/www/ll-express-api
chmod +x deploy/deploy.sh
./deploy/deploy.sh
```

### `nginx.conf`
Nginx reverse proxy configuration. Handles:
- SSL/TLS termination
- Rate limiting
- Request forwarding to Node.js app
- Security headers
- File upload size limits

**Usage:**
```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/ll-express-api
sudo nano /etc/nginx/sites-available/ll-express-api  # Edit server_name
sudo ln -s /etc/nginx/sites-available/ll-express-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

**Important:** Update `server_name` with your domain or EC2 IP address before using.

### `QUICK_START.md`
Quick reference guide for fast deployment. See this file for a condensed version of the deployment process.

### `env.development.example`
Development environment variables template. Use this when deploying a development instance.

### `DEVELOPMENT_SETUP.md`
Complete guide for setting up a development environment on EC2 with hot reload, debugging, and development-specific configurations.

### `fix-database-permissions.sh`
Script to fix PostgreSQL schema permissions. Run this if you get "permission denied for schema public" errors when running Prisma migrations.

### `DATABASE_TROUBLESHOOTING.md`
Comprehensive troubleshooting guide for common PostgreSQL and Prisma database issues, including permission errors, connection problems, and migration issues.

## Root Directory Files

### `ecosystem.config.js`
PM2 process manager configuration. Defines:
- Application name and entry point
- Environment variables
- Logging configuration
- Auto-restart settings
- Memory limits

**Usage:**
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### `DEPLOYMENT.md`
Comprehensive deployment guide with detailed step-by-step instructions. Read this for complete deployment documentation.

## Deployment Workflow

1. **First Time Setup:**
   - Run `setup-server.sh` on EC2
   - Clone repository
   - Configure `.env` file
   - Setup database
   - Build and start application
   - Configure Nginx

2. **Updates:**
   - Run `deploy/deploy.sh` from application directory

3. **Monitoring:**
   - Use `pm2 logs ll-express-api` for application logs
   - Use `sudo tail -f /var/log/nginx/error.log` for Nginx errors

## Notes

- All scripts use `set -e` to exit on errors
- Scripts are designed for Ubuntu 22.04 LTS
- Make scripts executable: `chmod +x script.sh`
- Always test Nginx config: `sudo nginx -t`
- Keep your `.env` file secure and never commit it

