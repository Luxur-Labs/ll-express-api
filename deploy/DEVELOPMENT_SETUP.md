# Development Environment Setup on EC2

This guide helps you set up a development environment on EC2 for active development and testing.

## Quick Setup

### 1. Follow Standard Deployment Steps

Follow the main deployment guide (`DEPLOYMENT.md`) but use development-specific configurations.

### 2. Use Development Environment Variables

Copy the development environment template:

```bash
cd /var/www/ll-express-api
cat deploy/env.development.example > .env
nano .env  # Edit with your actual values
```

Or manually create `.env` with these development settings:

```env
NODE_ENV=development
PORT=3000
LOG_LEVEL=debug

JWT_SECRET=dev-secret-key-minimum-16-characters-long-change-this
JWT_EXPIRES_IN=24h

DATABASE_URL=postgresql://ll_api_user:ll_express_api_PWD@localhost:5432/ll_express_api?schema=public

BCRYPT_SALT_ROUNDS=8

# Add other optional variables as needed
```

### 3. Development-Specific Considerations

#### Database
- Use a separate development database to avoid conflicts
- Local PostgreSQL is fine for development
- Or use a separate RDS instance with `_dev` suffix

#### Logging
- `LOG_LEVEL=debug` provides detailed logs
- Check logs with: `pm2 logs ll-express-api-dev`

#### Hot Reload Options

**Option 1: PM2 with Watch (Not Recommended)**
```bash
# Edit ecosystem.config.dev.js and set watch: true
pm2 start ecosystem.config.dev.js
```

**Option 2: Nodemon (Recommended for Active Development)**
```bash
# Install nodemon
sudo npm install -g nodemon

# Run in development mode
npm run dev
# This watches src/ directory and auto-restarts on changes
```

**Option 3: Manual Restart**
```bash
# After making changes:
npm run build
pm2 restart ll-express-api-dev
```

### 4. Development Workflow

```bash
# 1. Make code changes locally or on EC2
nano src/controllers/your-controller.ts

# 2. Build TypeScript
npm run build

# 3. Restart application
pm2 restart ll-express-api-dev

# 4. Check logs
pm2 logs ll-express-api-dev

# 5. Test API
curl http://localhost:3000/api/v1/health
```

### 5. Development Tools

#### Enable TypeScript Direct Execution (Optional)

For faster iteration without building:

```bash
# Install ts-node globally
sudo npm install -g ts-node

# Run directly (slower, but no build step)
ts-node src/index.ts
```

#### Database Migrations in Development

```bash
# Create new migration
npx prisma migrate dev --name your_migration_name

# Apply migrations
npx prisma migrate deploy

# Reset database (WARNING: Deletes all data)
npx prisma migrate reset
```

#### Seed Development Data

```bash
# Seed database with test data
npm run prisma:seed
```

### 6. Testing in Development

```bash
# Run tests
npm test

# Run tests in watch mode (if configured)
npm test -- --watch
```

### 7. Development vs Production Differences

| Feature | Development | Production |
|---------|------------|------------|
| NODE_ENV | `development` | `production` |
| LOG_LEVEL | `debug` | `info` |
| JWT_EXPIRES_IN | `24h` | `7d` |
| BCRYPT_SALT_ROUNDS | `8` | `10` |
| Database | `ll_express_api` | `ll_express_api` (or separate) |
| S3 Bucket | `ll-express-api-dev-uploads` | `ll-express-api-uploads` |
| Hot Reload | Yes (nodemon) | No |
| Error Details | Full stack traces | Sanitized errors |

### 8. Security Notes for Development

⚠️ **Important:** Even in development:
- Use strong JWT secrets (minimum 16 characters)
- Don't expose sensitive data in logs
- Use separate AWS credentials for dev
- Don't use production database
- Restrict SSH access to your IP only

### 9. Monitoring Development Instance

```bash
# Check application status
pm2 status

# View real-time logs
pm2 logs ll-express-api-dev --lines 50

# Monitor resources
pm2 monit

# Check system resources
htop  # or top
df -h  # disk space
free -h  # memory
```

### 10. Common Development Tasks

```bash
# Pull latest changes
git pull origin main

# Update dependencies
npm install

# Rebuild and restart
npm run build && pm2 restart ll-express-api-dev

# View recent errors
pm2 logs ll-express-api-dev --err --lines 100

# Clear PM2 logs
pm2 flush

# Restart everything
pm2 restart all
```

## Troubleshooting Development Issues

### Application not updating after code changes
- Ensure you ran `npm run build` after changes
- Restart PM2: `pm2 restart ll-express-api-dev`
- Check if TypeScript compilation succeeded

### Database connection issues
- Verify DATABASE_URL in .env
- Check PostgreSQL is running: `sudo systemctl status postgresql`
- Test connection: `psql $DATABASE_URL`

### Port already in use
- Check what's using port 3000: `sudo lsof -i :3000`
- Kill the process or change PORT in .env

### Permission errors
- Fix ownership: `sudo chown -R ubuntu:ubuntu /var/www/ll-express-api`
- Check file permissions: `ls -la`

## Next Steps

Once your development environment is set up:
1. Test all API endpoints
2. Verify database migrations work
3. Test file uploads (if using S3)
4. Verify email functionality (if configured)
5. Run test suite: `npm test`

For production deployment, follow the main `DEPLOYMENT.md` guide with production settings.

