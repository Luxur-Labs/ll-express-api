# 🔒 Security Features Overview

This document provides a comprehensive overview of all security measures implemented in the API.

## Table of Contents
- [Security Layers](#security-layers)
- [Database Security Fields](#database-security-fields)
- [Implementation Details](#implementation-details)
- [Configuration](#configuration)
- [Testing](#testing)
- [Best Practices](#best-practices)

---

## Security Layers

### 1. **Rate Limiting**

#### Global Rate Limiter
- **Limit:** 100 requests per 15 minutes per IP
- **Applies to:** All routes
- **Purpose:** Prevent general API abuse
- **Implementation:** `src/middleware/rateLimiter.middleware.ts`

#### Auth Rate Limiter (Login)
- **Limit:** 5 login attempts per 15 minutes per IP
- **Applies to:** `/auth/login`
- **Purpose:** Prevent brute force attacks
- **HTTP Status:** 429 (Too Many Requests)

#### Forgot Password Rate Limiter
- **Limit:** 3 requests per hour per IP
- **Applies to:** `/auth/forgot-password`
- **Purpose:** Prevent email enumeration and abuse
- **HTTP Status:** 429 (Too Many Requests)

#### Speed Limiter
- **Behavior:** Adds progressive delays after 3 requests
- **Delay:** 500ms per request (max 5 seconds)
- **Applies to:** Login endpoint
- **Purpose:** Slow down attackers without blocking legitimate users

### 2. **Account Lockout System**

- **Trigger:** 5 failed login attempts
- **Duration:** 30 minutes
- **Behavior:** Account automatically unlocks after duration
- **HTTP Status:** 423 (Locked)
- **Database Tracking:** `failedLoginAttempts` and `accountLockedUntil` fields

### 3. **Login Attempt Tracking**

New fields added to User model:
- `failedLoginAttempts` - Counter for failed attempts
- `accountLockedUntil` - Timestamp for lockout expiration
- `lastLoginAt` - Timestamp of last successful login
- `lastLoginIp` - IP address of last successful login

### 4. **Timing Attack Prevention**

- Random delays (50-150ms) added to all login attempts
- Prevents attackers from determining if user exists based on response time
- Applied to both successful and failed attempts
- Applied even for non-existent users

### 5. **IP Address Tracking**

- Records IP address for each login attempt
- Handles proxy headers: `X-Forwarded-For`, `X-Real-IP`
- Logged for security audit trail
- Used for forensic analysis

### 6. **Security Logging**

All security events are logged with structured data:
- Successful logins with IP
- Failed login attempts with reason
- Account lockouts with details
- Login attempts on non-existent accounts
- Suspicious activities

**Log Format:**
```json
{
  "level": "info|warn|error",
  "time": "ISO timestamp",
  "email": "user@example.com",
  "ip": "192.168.1.1",
  "msg": "Event description"
}
```

### 7. **Security Headers (Helmet)**

Automatically adds security headers:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security` (HSTS)
- Removes `X-Powered-By` header

### 8. **Password Security**

- Bcrypt hashing with configurable salt rounds (default: 10)
- Passwords never stored in plain text
- Password verification uses constant-time comparison
- Configured via `BCRYPT_SALT_ROUNDS` environment variable

### 9. **User Enumeration Prevention**

- Same error message for non-existent users and wrong passwords
- Forgot password always returns 202 status
- Random delays prevent timing-based enumeration
- No indication of whether email exists

### 10. **JWT Token Security**

- Configurable expiration time (default: 7 days)
- Secure secret key (minimum 16 characters)
- Token includes minimal user data
- No sensitive information in token payload
- Signed with HS256 algorithm

---

## Database Security Fields

### User Table Additions

```prisma
model User {
  // ... existing fields ...
  
  // Security fields
  failedLoginAttempts   Int               @default(0)
  accountLockedUntil    DateTime?
  lastLoginAt           DateTime?
  lastLoginIp           String?
}
```

**Field Descriptions:**

| Field | Type | Purpose |
|-------|------|---------|
| `failedLoginAttempts` | Integer | Tracks consecutive failed login attempts |
| `accountLockedUntil` | DateTime (nullable) | When account lockout expires |
| `lastLoginAt` | DateTime (nullable) | Timestamp of last successful login |
| `lastLoginIp` | String (nullable) | IP address of last successful login |

---

## Implementation Details

### Files Modified/Created

**New Files:**
- `src/middleware/rateLimiter.middleware.ts` - Rate limiting configurations
- `src/services/security.service.ts` - Security utility functions
- `docs/security/SECURITY_OVERVIEW.md` - This file
- `docs/security/IMPLEMENTATION_GUIDE.md` - Implementation details
- `docs/security/TESTING_GUIDE.md` - Testing procedures

**Modified Files:**
- `prisma/schema.prisma` - Added security fields
- `src/controllers/auth.controller.ts` - Enhanced login logic
- `src/routes/index.ts` - Added rate limiters
- `src/app/app.ts` - Global security setup

### Security Service Functions

```typescript
// Check if account is locked
isAccountLocked(email: string): Promise<boolean>

// Record failed login attempt
recordFailedLogin(email: string, ip: string): Promise<void>

// Record successful login
recordSuccessfulLogin(email: string, ip: string): Promise<void>

// Get client IP from request
getClientIp(req: Request): string

// Add random delay to prevent timing attacks
addRandomDelay(): Promise<void>
```

---

## Configuration

### Environment Variables

```env
# JWT Configuration
JWT_SECRET=your-secret-key-minimum-16-characters
JWT_EXPIRES_IN=7d

# Bcrypt Configuration
BCRYPT_SALT_ROUNDS=10
```

### Rate Limiting Configuration

**File:** `src/middleware/rateLimiter.middleware.ts`

```typescript
// Global rate limiter
windowMs: 15 * 60 * 1000,  // 15 minutes
max: 100,                   // 100 requests

// Auth rate limiter
windowMs: 15 * 60 * 1000,  // 15 minutes
max: 5,                     // 5 attempts

// Forgot password limiter
windowMs: 60 * 60 * 1000,  // 1 hour
max: 3,                     // 3 requests
```

### Account Lockout Configuration

**File:** `src/services/security.service.ts`

```typescript
const MAX_FAILED_ATTEMPTS = 5;           // Failed attempts before lock
const LOCKOUT_DURATION_MINUTES = 30;     // Duration in minutes
```

---

## Response Examples

### Successful Login (HTTP 200)
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "role": "SUPER_ADMIN",
    "employeeType": "QC",
    "technicianGroup": "CAD_TECHNICIAN",
    "lastLoginAt": "2025-10-12T04:37:10.398Z"
  }
}
```

### Failed Login (HTTP 401)
```json
{
  "message": "Invalid credentials"
}
```

### Rate Limit Exceeded (HTTP 429)
```json
"Too many login attempts from this IP, please try again after 15 minutes."
```

### Account Locked (HTTP 423)
```json
{
  "message": "Account is temporarily locked due to multiple failed login attempts. Please try again later."
}
```

---

## Testing

### Test Rate Limiting
```bash
# Try 6 login attempts rapidly
for i in {1..6}; do
  curl -X POST http://localhost:3000/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"wrong"}'
  echo "\nAttempt $i"
done
```

### Test Account Lockout
```bash
# Make 5 failed login attempts
for i in {1..5}; do
  curl -X POST http://localhost:3000/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@example.com","password":"wrongpassword"}'
  sleep 1
done
```

### Test Forgot Password Rate Limiting
```bash
# Try 4 forgot password requests
for i in {1..4}; do
  curl -X POST http://localhost:3000/api/v1/auth/forgot-password \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@example.com"}'
  echo "\nAttempt $i"
done
```

---

## Best Practices

### For Developers

1. **Never log passwords** - Even hashed passwords should be handled carefully
2. **Use HTTPS in production** - All communication should be encrypted
3. **Keep dependencies updated** - Regularly update npm packages
4. **Review security logs** - Monitor for suspicious activities
5. **Use strong JWT secrets** - Generate long, random secrets
6. **Test security features** - Regularly test rate limiting and lockout

### For Deployment

1. **Enable HTTPS/TLS** - Use valid SSL certificates
2. **Set up reverse proxy** - Use nginx/Apache for additional security
3. **Configure CORS properly** - Restrict allowed origins in production
4. **Use environment variables** - Never commit secrets to version control
5. **Enable database backups** - Regular automated backups
6. **Monitor rate limit hits** - Alert on excessive rate limit violations
7. **Set up logging aggregation** - Centralized log management

### Production Configuration

```env
# Production JWT secret (use a strong random value)
JWT_SECRET=$(openssl rand -base64 32)

# Shorter JWT expiration for production
JWT_EXPIRES_IN=1h

# Higher bcrypt rounds for production
BCRYPT_SALT_ROUNDS=12

# Database with SSL
DATABASE_URL=postgresql://user:password@host:5432/db?sslmode=require
```

---

## Attack Mitigation Matrix

| Attack Type | Protection | How It Works |
|-------------|-----------|--------------|
| **Brute Force (Single IP)** | ✅ IP Rate Limiter | Blocks after 5 attempts/15min |
| **Brute Force (Multiple IPs)** | ✅ Account Lockout | Locks account after 5 failed attempts |
| **Timing Attacks** | ✅ Random Delays | 50-150ms random delay on all attempts |
| **User Enumeration** | ✅ Generic Messages | Same error for all failures |
| **DDoS** | ✅ Global Rate Limiter | 100 requests/15min per IP |
| **Password Spraying** | ✅ Multi-layer | Rate limits + account lockout |
| **Credential Stuffing** | ✅ Account Lockout | Locks after 5 attempts |

---

## Monitoring & Alerts

### Logs to Monitor

```typescript
// Successful login
logger.info({ email, ip }, 'Successful login');

// Failed login
logger.warn({ email, ip }, 'Failed login attempt - incorrect password');

// Account locked
logger.warn({ email, ip, attempts, lockUntil }, 'Account locked');
```

### Metrics to Track

- Failed login attempts per hour
- Account lockouts per day
- Rate limit hits per endpoint
- Unique IPs attempting to log in
- Geographic distribution of login attempts

---

## Future Enhancements

1. **Two-Factor Authentication (2FA)** - SMS or authenticator app
2. **Refresh Tokens** - Short-lived access tokens with refresh capability
3. **CAPTCHA Integration** - After multiple failed attempts
4. **Device Fingerprinting** - Track and verify known devices
5. **Geolocation Verification** - Alert on unusual locations
6. **Password Strength Meter** - Enforce strong passwords
7. **Session Management** - Track and revoke active sessions

---

## Support

For security issues or questions, please contact the development team.

**⚠️ Never disclose security vulnerabilities publicly.**

---

**Last Updated:** October 12, 2025
**Version:** 1.0.0

