# EC2 Deployment Guide

This guide will help you deploy the ll-express-api to an AWS EC2 instance running Ubuntu.

## Prerequisites

- AWS EC2 instance with Ubuntu 20.04 LTS or 22.04 LTS (recommended)
- SSH access to your EC2 instance
- Domain name (optional, for SSL)
- PostgreSQL database (RDS recommended, or local PostgreSQL)
- AWS S3 bucket for file storage (if using S3 features)

## Development vs Production Deployment

This guide covers both development and production deployments. Key differences:

- **Development**: More verbose logging, shorter JWT expiration, faster bcrypt rounds, separate dev resources
- **Production**: Optimized logging, longer JWT expiration, secure bcrypt rounds, production resources

See the environment variables section below for specific configuration differences.

## Step 1: EC2 Instance Setup

### Launch EC2 Instance

1. Go to AWS Console → EC2 → Launch Instance
2. Choose **Ubuntu Server 22.04 LTS** (or 20.04 LTS)
3. Select instance type: **t3.medium** or higher (t3.micro works for testing)
4. Configure security group:
   - **SSH (22)**: Your IP only
   - **HTTP (80)**: 0.0.0.0/0
   - **HTTPS (443)**: 0.0.0.0/0
   - **Custom TCP (3000)**: Only if not using Nginx (not recommended)
5. Create/select a key pair for SSH access
6. Launch instance

### Connect to EC2 Instance

```bash
ssh -i your-key.pem ubuntu@your-ec2-ip
```

## Step 2: Initial Server Setup

Run the setup script on your EC2 instance:

```bash
# On your local machine, copy the script to EC2
scp -i your-key.pem deploy/setup-server.sh ubuntu@your-ec2-ip:~/

# SSH into EC2
ssh -i your-key.pem ubuntu@your-ec2-ip

# Make script executable and run
chmod +x setup-server.sh
./setup-server.sh
```

Or manually run these commands:

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20.x (LTS)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install PostgreSQL (if not using RDS)
sudo apt install -y postgresql postgresql-contrib

# Install Nginx
sudo apt install -y nginx

# Install PM2 globally
sudo npm install -g pm2

# Install Git
sudo apt install -y git

# Install build essentials (for native modules)
sudo apt install -y build-essential

# Verify installations
node --version  # Should be v20.x
npm --version
pm2 --version
```

## Step 3: Database Setup

### Option A: AWS RDS (Recommended for Production)

1. Create RDS PostgreSQL instance in AWS Console
2. Note the endpoint, port, username, and password
3. Update security group to allow EC2 instance to connect
4. Use the RDS endpoint in your `DATABASE_URL`

### Option B: Local PostgreSQL

```bash
# Switch to postgres user
sudo -u postgres psql

# Create database and user
CREATE DATABASE ll_express_api;
CREATE USER ll_api_user WITH PASSWORD 'll_express_api_PWD';

# Grant database privileges
GRANT ALL PRIVILEGES ON DATABASE ll_express_api TO ll_api_user;

# Connect to the database to grant schema privileges
\c ll_express_api

# Grant schema privileges (required for Prisma migrations)
GRANT ALL ON SCHEMA public TO ll_api_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ll_api_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ll_api_user;

# Make the user the owner of the schema (alternative approach)
# ALTER SCHEMA public OWNER TO ll_api_user;

\q
```

**Important:** The schema-level permissions are required for Prisma to create tables and run migrations. Without these, you'll get "permission denied for schema public" errors.

## Step 4: Deploy Application

### Clone Repository

You have three options for cloning the repository:

#### Option A: SSH (Recommended)

**Setup SSH on EC2:**

```bash
# Generate SSH key on EC2
ssh-keygen -t ed25519 -C "your-email@example.com"
# Press Enter to accept default location
# Optionally set a passphrase

# Display public key
cat ~/.ssh/id_ed25519.pub
```

**Add SSH key to GitHub:**
1. Copy the public key output
2. Go to GitHub → Settings → SSH and GPG keys → New SSH key
3. Paste the key and save

**Clone using SSH:**
```bash
# Create app directory
sudo mkdir -p /var/www/ll-express-api
sudo chown ubuntu:ubuntu /var/www/ll-express-api
cd /var/www/ll-express-api

# Clone repository
git clone git@github.com:saikumar41/ll-express-api.git .
```

#### Option B: Personal Access Token (HTTPS)

**Create GitHub Personal Access Token:**
1. Go to GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Generate new token (classic)
3. Select scopes: `repo` (for private repos) or `public_repo` (for public repos)
4. Copy the token (you won't see it again!)

**Clone using HTTPS with token:**
```bash
# Create app directory
sudo mkdir -p /var/www/ll-express-api
sudo chown ubuntu:ubuntu /var/www/ll-express-api
cd /var/www/ll-express-api

# Clone repository (use token as password when prompted)
git clone https://github.com/saikumar41/ll-express-api.git .

# Or embed token in URL (less secure, but works)
# git clone https://YOUR_TOKEN@github.com/saikumar41/ll-express-api.git .
```

#### Option C: Public Repository (if repository is public)

If your repository is public, you can clone without authentication:

```bash
# Create app directory
sudo mkdir -p /var/www/ll-express-api
sudo chown ubuntu:ubuntu /var/www/ll-express-api
cd /var/www/ll-express-api

# Clone repository
git clone https://github.com/saikumar41/ll-express-api.git .
```

### Install Dependencies

```bash
cd /var/www/ll-express-api
npm install
```

### Configure Environment Variables

```bash
# Create .env file
nano .env
```

#### For Production Environment:

Add the following (adjust values as needed):

```env
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-minimum-16-characters
JWT_EXPIRES_IN=7d

# Database
DATABASE_URL=postgresql://ll_api_user:your_password@localhost:5432/ll_express_api?schema=public
# Or for RDS:
# DATABASE_URL=postgresql://username:password@your-rds-endpoint:5432/ll_express_api?schema=public

# Bcrypt
BCRYPT_SALT_ROUNDS=10

# Email Configuration (optional)
EMAIL_FROM=noreply@yourdomain.com
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your-app-password
# Or use SMTP:
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_SECURE=false
# SMTP_USER=your-email@gmail.com
# SMTP_PASSWORD=your-password

# Reset Password URL
RESET_PASSWORD_URL_BASE=https://your-frontend-domain.com

# BetterAuth (optional, for SUPER_ADMIN)
BETTERAUTH_BASE_URL=https://your-betterauth-url.com
BETTERAUTH_API_TOKEN=your-api-token
BETTERAUTH_FORGOT_PATH=/api/auth/forgot-password

# AWS S3 Configuration (optional)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
S3_BUCKET_NAME=your-bucket-name
S3_PUBLIC_URL=https://your-bucket-name.s3.amazonaws.com
```

#### For Development Environment:

If deploying as a development instance, use these settings:

```env
NODE_ENV=development
PORT=3000
LOG_LEVEL=debug

# JWT Configuration (still keep it secure, but can be simpler for dev)
JWT_SECRET=dev-secret-key-minimum-16-characters-long-change-this
JWT_EXPIRES_IN=24h

# Database
DATABASE_URL=postgresql://ll_api_user:ll_express_api_PWD@localhost:5432/ll_express_api?schema=public
# Or for RDS development instance:
# DATABASE_URL=postgresql://username:password@your-rds-endpoint:5432/ll_express_api_dev?schema=public

# Bcrypt (lower rounds for faster development)
BCRYPT_SALT_ROUNDS=8

# Email Configuration (optional - can use test email service)
EMAIL_FROM=dev-noreply@yourdomain.com
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your-gmail-app-password
# Or use SMTP:
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_SECURE=false
# SMTP_USER=your-email@gmail.com
# SMTP_PASSWORD=your-password

# Reset Password URL (Development frontend URL)
RESET_PASSWORD_URL_BASE=http://localhost:3000
# Or if you have a development frontend deployed:
# RESET_PASSWORD_URL_BASE=http://your-dev-frontend-domain.com

# BetterAuth Integration (Optional, for SUPER_ADMIN)
BETTERAUTH_BASE_URL=https://your-betterauth-dev-url.com
BETTERAUTH_API_TOKEN=your-dev-api-token
BETTERAUTH_FORGOT_PATH=/api/auth/forgot-password

# AWS S3 Configuration (Optional - use separate dev bucket)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-dev-aws-access-key-id
AWS_SECRET_ACCESS_KEY=your-dev-aws-secret-access-key
S3_BUCKET_NAME=ll-express-api-dev-uploads
S3_PUBLIC_URL=https://ll-express-api-dev-uploads.s3.amazonaws.com
```

**Key Differences for Development:**
- `NODE_ENV=development` - Enables development mode
- `LOG_LEVEL=debug` - More verbose logging for debugging
- `JWT_EXPIRES_IN=24h` - Shorter token expiration for testing
- `BCRYPT_SALT_ROUNDS=8` - Faster hashing (less secure, but fine for dev)
- Separate database/bucket names to avoid conflicts with production

Save and exit (Ctrl+X, then Y, then Enter).

### Build and Setup Database

```bash
# Generate Prisma client
npm run prisma:generate

# Run migrations
npx prisma migrate deploy

# Seed database (optional)
npm run prisma:seed

# Build TypeScript
npm run build
```

## Step 5: Configure PM2

### For Production:

```bash
# Start application with PM2
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 to start on system boot
pm2 startup
# Follow the instructions it outputs (usually involves running a sudo command)
```

### For Development:

You have two options:

**Option A: Use PM2 (Recommended for EC2 deployment)**
```bash
# Start application with development PM2 config
pm2 start ecosystem.config.dev.js

# Save PM2 configuration
pm2 save

# Setup PM2 to start on system boot (optional for dev)
pm2 startup
```

**Option B: Use Nodemon (For active development with hot reload)**
```bash
# Install nodemon globally (if not already installed)
sudo npm install -g nodemon

# Run with nodemon (this will watch for file changes)
cd /var/www/ll-express-api
npm run dev
# Or manually:
# nodemon --watch src --exec ts-node src/index.ts
```

**Note:** For development, you might want to skip PM2 startup on boot since you'll be actively developing. PM2 is still useful for keeping the app running if you disconnect from SSH.

## Step 6: Configure Nginx

```bash
# Copy the Nginx configuration
sudo cp deploy/nginx.conf /etc/nginx/sites-available/ll-express-api
sudo ln -s /etc/nginx/sites-available/ll-express-api /etc/nginx/sites-enabled/

# Remove default site (optional)
sudo rm /etc/nginx/sites-enabled/default

# Test Nginx configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

Edit the Nginx config to match your domain:

```bash
sudo nano /etc/nginx/sites-available/ll-express-api
```

Update `server_name` with your domain or EC2 public IP.

## Step 7: Setup SSL with Let's Encrypt (Optional but Recommended)

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get SSL certificate (replace with your domain)
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Certbot will automatically configure Nginx and set up auto-renewal
```

## Step 8: Firewall Configuration

```bash
# Configure UFW firewall
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

## Step 9: Verify Deployment

1. Check PM2 status:
   ```bash
   pm2 status
   pm2 logs
   ```

2. Check Nginx status:
   ```bash
   sudo systemctl status nginx
   ```

3. Test API:
   ```bash
   curl http://localhost:3000/api/v1/health
   # Or from outside:
   curl http://your-ec2-ip/api/v1/health
   ```

## Maintenance Commands

### Update Application

```bash
cd /var/www/ll-express-api
git pull
npm install
npm run build
npx prisma migrate deploy
pm2 restart ll-express-api
```

**Note:** If using HTTPS with personal access token, you may need to configure Git credentials:
```bash
# Store credentials (one-time setup)
git config --global credential.helper store
# On next git pull, enter your GitHub username and token as password
```

### View Logs

```bash
# PM2 logs
pm2 logs ll-express-api

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### Restart Services

```bash
# Restart application
pm2 restart ll-express-api

# Restart Nginx
sudo systemctl restart nginx
```

## Security Recommendations

1. **Keep system updated**: `sudo apt update && sudo apt upgrade -y`
2. **Use RDS** instead of local PostgreSQL for production
3. **Restrict SSH access** to your IP only
4. **Use strong passwords** and JWT secrets
5. **Enable AWS CloudWatch** for monitoring
6. **Setup automated backups** for database
7. **Use AWS Secrets Manager** for sensitive environment variables
8. **Enable AWS WAF** if handling sensitive data
9. **Regular security audits** and dependency updates

## Troubleshooting

### Application won't start
- Check PM2 logs: `pm2 logs ll-express-api`
- Verify environment variables: `cat .env`
- Check database connection
- Verify port 3000 is not in use: `sudo lsof -i :3000`

### Nginx 502 Bad Gateway
- Check if app is running: `pm2 status`
- Check app logs: `pm2 logs ll-express-api`
- Verify Nginx config: `sudo nginx -t`

### Database connection errors
- Verify DATABASE_URL in .env
- Check RDS security group allows EC2 instance
- Test connection: `psql $DATABASE_URL`

### Permission denied for schema public
- This is a common Prisma issue. The user needs schema-level permissions, not just database-level.
- Run the fix script: `./deploy/fix-database-permissions.sh`
- Or manually: Connect as postgres user and run:
  ```sql
  \c ll_express_api
  GRANT ALL ON SCHEMA public TO ll_api_user;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ll_api_user;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ll_api_user;
  ```
- See `deploy/DATABASE_TROUBLESHOOTING.md` for detailed solutions

### Permission errors
- Ensure ubuntu user owns app directory: `sudo chown -R ubuntu:ubuntu /var/www/ll-express-api`
- Check file permissions: `ls -la /var/www/ll-express-api`

## Cost Optimization

- Use **t3.small** or **t3.medium** for small to medium traffic
- Enable **EC2 Auto Scaling** if traffic varies
- Use **RDS db.t3.micro** for development/testing
- Consider **AWS Lightsail** for simpler, cheaper hosting
- Use **CloudFront** for static assets
- Enable **S3 lifecycle policies** for old files

