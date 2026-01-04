#!/bin/bash

# Script to fix PostgreSQL permissions for Prisma migrations
# Run this if you're getting "permission denied for schema public" errors

set -e

DB_NAME="${1:-ll_express_api}"
DB_USER="${2:-ll_api_user}"

echo "========================================="
echo "Fixing PostgreSQL permissions"
echo "========================================="
echo "Database: $DB_NAME"
echo "User: $DB_USER"
echo ""

# Check if running as postgres user or with sudo
if [ "$EUID" -ne 0 ] && [ "$USER" != "postgres" ]; then
    echo "This script needs to run as postgres user or with sudo"
    echo "Running with sudo..."
    sudo -u postgres psql <<EOF
-- Connect to the database
\c $DB_NAME

-- Grant schema privileges
GRANT ALL ON SCHEMA public TO $DB_USER;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO $DB_USER;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO $DB_USER;

-- Verify permissions
\dn+ public
\q
EOF
else
    psql <<EOF
-- Connect to the database
\c $DB_NAME

-- Grant schema privileges
GRANT ALL ON SCHEMA public TO $DB_USER;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO $DB_USER;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO $DB_USER;

-- Verify permissions
\dn+ public
\q
EOF
fi

echo ""
echo "========================================="
echo "Permissions fixed!"
echo "========================================="
echo "You can now run: npx prisma migrate deploy"

