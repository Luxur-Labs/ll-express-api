# Database Troubleshooting Guide

Common PostgreSQL and Prisma issues and their solutions.

## Error: permission denied for schema public

### Problem
When running `npx prisma migrate deploy`, you get:
```
Error: ERROR: permission denied for schema public
```

### Cause
The database user doesn't have permissions on the `public` schema. `GRANT ALL PRIVILEGES ON DATABASE` only grants database-level privileges, not schema-level privileges.

### Solution

**Option 1: Use the fix script (Recommended)**

```bash
# Make script executable
chmod +x deploy/fix-database-permissions.sh

# Run the script (defaults to ll_express_api database and ll_api_user)
./deploy/fix-database-permissions.sh

# Or specify custom database and user
./deploy/fix-database-permissions.sh your_database_name your_user_name
```

**Option 2: Manual Fix**

```bash
# Connect as postgres superuser
sudo -u postgres psql

# Connect to your database
\c ll_express_api

# Grant schema privileges
GRANT ALL ON SCHEMA public TO ll_api_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ll_api_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ll_api_user;

# Exit
\q
```

**Option 3: Make User Schema Owner (Alternative)**

```bash
sudo -u postgres psql

\c ll_express_api
ALTER SCHEMA public OWNER TO ll_api_user;
\q
```

### Verify Fix

```bash
# Test connection and permissions
psql postgresql://ll_api_user:ll_express_api_PWD@localhost:5432/ll_express_api

# Try creating a test table
CREATE TABLE test_permissions (id SERIAL PRIMARY KEY);
DROP TABLE test_permissions;
\q
```

If the test table creation works, permissions are fixed!

## Error: database does not exist

### Problem
```
Error: P1003: Database `ll_express_api` does not exist
```

### Solution

```bash
sudo -u postgres psql

CREATE DATABASE ll_express_api;
\q
```

## Error: role "ll_api_user" does not exist

### Problem
```
Error: P1000: Authentication failed against database server
```

### Solution

```bash
sudo -u postgres psql

CREATE USER ll_api_user WITH PASSWORD 'll_express_api_PWD';
GRANT ALL PRIVILEGES ON DATABASE ll_express_api TO ll_api_user;

\c ll_express_api
GRANT ALL ON SCHEMA public TO ll_api_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ll_api_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ll_api_user;

\q
```

## Error: connection refused

### Problem
```
Error: P1001: Can't reach database server
```

### Solutions

**Check PostgreSQL is running:**
```bash
sudo systemctl status postgresql
sudo systemctl start postgresql
```

**Check PostgreSQL is listening:**
```bash
sudo netstat -tlnp | grep 5432
# Should show: 127.0.0.1:5432 or 0.0.0.0:5432
```

**Check pg_hba.conf (if connection still fails):**
```bash
sudo nano /etc/postgresql/*/main/pg_hba.conf
```

Ensure there's a line like:
```
local   all             all                                     peer
host    all             all             127.0.0.1/32            md5
host    all             all             ::1/128                 md5
```

Then restart PostgreSQL:
```bash
sudo systemctl restart postgresql
```

## Error: password authentication failed

### Problem
```
Error: P1000: Authentication failed
```

### Solutions

**Reset password:**
```bash
sudo -u postgres psql

ALTER USER ll_api_user WITH PASSWORD 'new_password';
\q
```

**Update DATABASE_URL in .env:**
```env
DATABASE_URL=postgresql://ll_api_user:new_password@localhost:5432/ll_express_api?schema=public
```

## Error: relation already exists

### Problem
```
Error: P2009: relation "User" already exists
```

### Cause
Migrations were partially applied or tables already exist.

### Solutions

**Option 1: Reset database (WARNING: Deletes all data)**
```bash
npx prisma migrate reset
```

**Option 2: Mark migrations as applied (if tables are correct)**
```bash
npx prisma migrate resolve --applied <migration_name>
```

**Option 3: Drop and recreate (Development only)**
```bash
sudo -u postgres psql

DROP DATABASE ll_express_api;
CREATE DATABASE ll_express_api;
GRANT ALL PRIVILEGES ON DATABASE ll_express_api TO ll_api_user;

\c ll_express_api
GRANT ALL ON SCHEMA public TO ll_api_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ll_api_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ll_api_user;

\q

# Then run migrations
npx prisma migrate deploy
```

## Complete Database Setup (Fresh Install)

If you need to start from scratch:

```bash
# Connect as postgres user
sudo -u postgres psql

# Drop existing database and user (if they exist)
DROP DATABASE IF EXISTS ll_express_api;
DROP USER IF EXISTS ll_api_user;

# Create new user
CREATE USER ll_api_user WITH PASSWORD 'll_express_api_PWD';

# Create database
CREATE DATABASE ll_express_api;

# Grant database privileges
GRANT ALL PRIVILEGES ON DATABASE ll_express_api TO ll_api_user;

# Connect to database
\c ll_express_api

# Grant schema privileges (CRITICAL for Prisma)
GRANT ALL ON SCHEMA public TO ll_api_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ll_api_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ll_api_user;

# Verify
\dn+ public
\l+ ll_express_api

\q
```

## Testing Database Connection

```bash
# Test with psql
psql postgresql://ll_api_user:ll_express_api_PWD@localhost:5432/ll_express_api

# If successful, you'll see:
# ll_express_api=>

# Test Prisma connection
npx prisma db pull

# Test migrations
npx prisma migrate deploy
```

## RDS-Specific Issues

### Security Group Configuration

Ensure your EC2 security group can connect to RDS:
1. Go to RDS → Your instance → Connectivity & security
2. Click on the security group
3. Edit inbound rules
4. Add rule: PostgreSQL (5432) from your EC2 security group

### Connection String Format

For RDS, use this format:
```
DATABASE_URL=postgresql://username:password@your-rds-endpoint.region.rds.amazonaws.com:5432/dbname?schema=public
```

### RDS Permissions

RDS master user has full permissions. If using a non-master user:
```sql
-- Connect as master user
GRANT ALL ON SCHEMA public TO your_app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO your_app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO your_app_user;
```

## Quick Reference Commands

```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Start PostgreSQL
sudo systemctl start postgresql

# Restart PostgreSQL
sudo systemctl restart postgresql

# Connect to database
psql postgresql://ll_api_user:password@localhost:5432/ll_express_api

# List databases
sudo -u postgres psql -l

# List users
sudo -u postgres psql -c "\du"

# Check schema permissions
sudo -u postgres psql -d ll_express_api -c "\dn+ public"
```

