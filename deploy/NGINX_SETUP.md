# Nginx Setup Guide

This guide helps you configure Nginx for your ll-express-api deployment.

## Quick Decision: Which Config to Use?

- **No domain, no SSL?** → Use `nginx.conf.http` (HTTP only)
- **Have domain, want SSL?** → Use `nginx.conf` (with SSL) + Let's Encrypt

## Option 1: HTTP Only (Development/Testing)

Best for:
- Development instances
- Testing without a domain
- Quick setup without SSL

### Setup Steps

```bash
# 1. Copy HTTP-only config
sudo cp deploy/nginx.conf.http /etc/nginx/sites-available/ll-express-api

# 2. Create symlink
sudo ln -s /etc/nginx/sites-available/ll-express-api /etc/nginx/sites-enabled/

# 3. Remove default site (optional)
sudo rm /etc/nginx/sites-enabled/default

# 4. Edit config to set your server name
sudo nano /etc/nginx/sites-available/ll-express-api
```

In the editor, find this line:
```nginx
server_name _;  # Replace with your EC2 IP or domain
```

Replace `_` with:
- Your EC2 public IP: `54.123.45.67`
- Or your domain: `api.yourdomain.com`

Example:
```nginx
server_name 54.123.45.67;
```

Save and exit (Ctrl+X, Y, Enter).

```bash
# 5. Test configuration
sudo nginx -t

# 6. If test passes, restart Nginx
sudo systemctl restart nginx

# 7. Test your API
curl http://your-ec2-ip/api/v1/health
```

## Option 2: With SSL (Production)

Best for:
- Production deployments
- When you have a domain name
- When you need HTTPS

### Prerequisites

1. **Domain name** pointing to your EC2 instance
2. **DNS A record** configured:
   ```
   api.yourdomain.com → Your EC2 Public IP
   ```
3. **Security group** allows:
   - Port 80 (HTTP) from anywhere
   - Port 443 (HTTPS) from anywhere

### Setup Steps

#### Step 1: Initial HTTP Config

```bash
# Copy HTTP-only config first (needed for Let's Encrypt)
sudo cp deploy/nginx.conf.http /etc/nginx/sites-available/ll-express-api
sudo ln -s /etc/nginx/sites-available/ll-express-api /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default

# Edit config
sudo nano /etc/nginx/sites-available/ll-express-api
```

Set `server_name` to your domain:
```nginx
server_name api.yourdomain.com;
```

```bash
# Test and restart
sudo nginx -t
sudo systemctl restart nginx
```

#### Step 2: Get SSL Certificate

```bash
# Install Certbot (if not installed)
sudo apt install -y certbot python3-certbot-nginx

# Get SSL certificate (replace with your domain)
sudo certbot --nginx -d api.yourdomain.com -d www.api.yourdomain.com
```

Certbot will:
- Automatically obtain SSL certificate
- Update your Nginx config with SSL settings
- Configure HTTP to HTTPS redirect
- Set up auto-renewal

#### Step 3: Verify

```bash
# Test SSL
curl https://api.yourdomain.com/api/v1/health

# Check auto-renewal
sudo certbot renew --dry-run
```

## Manual SSL Configuration

If you want to manually configure SSL (not recommended, Certbot is easier):

```bash
# 1. Copy SSL config
sudo cp deploy/nginx.conf /etc/nginx/sites-available/ll-express-api

# 2. Edit config
sudo nano /etc/nginx/sites-available/ll-express-api
```

Update these lines:
```nginx
server_name your-domain.com www.your-domain.com;  # Your actual domain
ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;  # Your cert path
ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;  # Your key path
```

```bash
# 3. Test and restart
sudo nginx -t
sudo systemctl restart nginx
```

## Common Issues

### Error: cannot load certificate

**Problem:** Nginx can't find SSL certificate files.

**Solutions:**
1. **Use HTTP-only config** if you don't have SSL:
   ```bash
   sudo cp deploy/nginx.conf.http /etc/nginx/sites-available/ll-express-api
   sudo nginx -t && sudo systemctl restart nginx
   ```

2. **Get SSL certificate first:**
   ```bash
   sudo certbot --nginx -d your-domain.com
   ```

3. **Update certificate paths** in nginx.conf if using custom certificates

### Error: nginx: configuration file test failed

**Check:**
```bash
# Test configuration
sudo nginx -t

# Check for syntax errors
sudo nginx -T 2>&1 | grep error
```

**Common causes:**
- Missing semicolons
- Incorrect file paths
- SSL certificates don't exist
- Invalid server_name

### 502 Bad Gateway

**Problem:** Nginx can't connect to your Node.js app.

**Solutions:**
```bash
# Check if app is running
pm2 status

# Check if app is listening on port 3000
sudo lsof -i :3000

# Check app logs
pm2 logs ll-express-api

# Restart app
pm2 restart ll-express-api
```

### Connection Refused

**Problem:** Can't access API from outside.

**Check:**
1. Security group allows port 80 (and 443 if using SSL)
2. Firewall allows Nginx:
   ```bash
   sudo ufw status
   sudo ufw allow 'Nginx Full'
   ```
3. App is running: `pm2 status`

## Switching Between HTTP and SSL Config

### From HTTP to SSL

```bash
# 1. Get SSL certificate
sudo certbot --nginx -d your-domain.com

# Certbot will automatically update your config
```

### From SSL to HTTP (for testing)

```bash
# 1. Backup SSL config
sudo cp /etc/nginx/sites-available/ll-express-api /etc/nginx/sites-available/ll-express-api.ssl.backup

# 2. Switch to HTTP config
sudo cp deploy/nginx.conf.http /etc/nginx/sites-available/ll-express-api
sudo nano /etc/nginx/sites-available/ll-express-api  # Update server_name

# 3. Test and restart
sudo nginx -t
sudo systemctl restart nginx
```

## Testing Your Setup

```bash
# Test HTTP endpoint
curl http://your-ec2-ip/api/v1/health

# Test HTTPS endpoint (if SSL is configured)
curl https://your-domain.com/api/v1/health

# Test from browser
# http://your-ec2-ip/api/v1/health
# or
# https://your-domain.com/api/v1/health
```

## Maintenance

### View Logs

```bash
# Access logs
sudo tail -f /var/log/nginx/ll-express-api-access.log

# Error logs
sudo tail -f /var/log/nginx/ll-express-api-error.log

# All Nginx logs
sudo tail -f /var/log/nginx/*.log
```

### Reload Configuration

```bash
# Test config
sudo nginx -t

# Reload (no downtime)
sudo nginx -s reload

# Or restart
sudo systemctl restart nginx
```

### Renew SSL Certificate

```bash
# Manual renewal
sudo certbot renew

# Test renewal (dry run)
sudo certbot renew --dry-run

# Certbot auto-renewal is set up automatically
# Check with: sudo systemctl status certbot.timer
```

## Security Recommendations

1. **Use SSL in production** - Always use HTTPS for production
2. **Keep Nginx updated** - `sudo apt update && sudo apt upgrade nginx`
3. **Monitor logs** - Regularly check for suspicious activity
4. **Rate limiting** - Already configured in both configs
5. **Security headers** - Already included in configs
6. **Firewall** - Use UFW to restrict access
7. **Regular backups** - Backup your Nginx configs

## Quick Reference

```bash
# Test config
sudo nginx -t

# Reload config
sudo nginx -s reload

# Restart Nginx
sudo systemctl restart nginx

# Check status
sudo systemctl status nginx

# View logs
sudo tail -f /var/log/nginx/error.log
```

