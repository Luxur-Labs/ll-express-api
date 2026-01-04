# Quick Start Deployment Guide

## TL;DR - Fastest Path to Deployment

### 1. Launch EC2 Instance
- Ubuntu 22.04 LTS
- t3.medium (or t3.small for testing)
- Security Group: SSH (22), HTTP (80), HTTPS (443)

### 2. Connect and Setup
```bash
ssh -i your-key.pem ubuntu@your-ec2-ip
wget https://raw.githubusercontent.com/your-repo/ll-express-api/main/deploy/setup-server.sh
chmod +x setup-server.sh
./setup-server.sh
```

### 3. Setup Git Authentication
```bash
# Option A: SSH (Recommended)
ssh-keygen -t ed25519 -C "your-email@example.com"
cat ~/.ssh/id_ed25519.pub  # Copy and add to GitHub → Settings → SSH keys

# Option B: Personal Access Token
# Create token at: GitHub → Settings → Developer settings → Personal access tokens
```

### 4. Deploy App
```bash
sudo mkdir -p /var/www/ll-express-api
sudo chown ubuntu:ubuntu /var/www/ll-express-api
cd /var/www/ll-express-api

# Clone with SSH
git clone git@github.com:saikumar41/ll-express-api.git .

# OR clone with HTTPS + token
# git clone https://YOUR_TOKEN@github.com/saikumar41/ll-express-api.git .

npm install
```

### 4. Configure Environment
```bash
nano .env
# Copy from DEPLOYMENT.md and fill in your values
```

### 5. Setup Database
```bash
# If using local PostgreSQL:
sudo -u postgres psql
CREATE DATABASE ll_express_api;
CREATE USER ll_api_user WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE ll_express_api TO ll_api_user;
\q
```

### 6. Build and Start
```bash
npm run prisma:generate
npx prisma migrate deploy
npm run build
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # Follow instructions
```

### 7. Configure Nginx
```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/ll-express-api
sudo nano /etc/nginx/sites-available/ll-express-api  # Update server_name
sudo ln -s /etc/nginx/sites-available/ll-express-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 8. SSL (Optional)
```bash
sudo certbot --nginx -d your-domain.com
```

### 9. Test
```bash
curl http://localhost:3000/api/v1/health
# Or from browser: http://your-ec2-ip/api/v1/health
```

## Common Commands

```bash
# View logs
pm2 logs ll-express-api

# Restart app
pm2 restart ll-express-api

# Update app
cd /var/www/ll-express-api
./deploy/deploy.sh

# Check status
pm2 status
sudo systemctl status nginx
```

## Troubleshooting

**502 Bad Gateway?**
- Check if app is running: `pm2 status`
- Check logs: `pm2 logs ll-express-api`

**Can't connect to database?**
- Verify DATABASE_URL in .env
- Check RDS security group allows EC2
- Test: `psql $DATABASE_URL`

**Permission denied?**
- Fix ownership: `sudo chown -R ubuntu:ubuntu /var/www/ll-express-api`

