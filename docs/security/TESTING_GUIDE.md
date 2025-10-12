# 🧪 Security Testing Guide

Complete guide for testing all security features in the login API.

## Prerequisites

- API server running on `http://localhost:3000`
- `curl` installed (or Postman)
- Access to server logs

---

## Test Suite

### Test 1: Successful Login ✅

**Purpose:** Verify normal login flow works correctly

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}' \
  -w "\nHTTP Status: %{http_code}\n"
```

**Expected Result:**
- HTTP Status: 200
- Returns token and user info
- `lastLoginAt` field populated
- Server log shows: `INFO: Successful login`

---

### Test 2: Failed Login (Wrong Password) ❌

**Purpose:** Verify failed login is handled correctly

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"wrongpassword"}' \
  -w "\nHTTP Status: %{http_code}\n"
```

**Expected Result:**
- HTTP Status: 401
- Response: `{"message":"Invalid credentials"}`
- Server log shows: `WARN: Failed login attempt - incorrect password`
- `failedLoginAttempts` incremented in database

---

### Test 3: IP Rate Limiting (5 attempts) 🚫

**Purpose:** Test IP-based rate limiter blocks after 5 attempts

```bash
echo "Testing IP Rate Limiting..."
for i in {1..6}; do
  echo -e "\n=== Attempt $i ==="
  curl -s -X POST http://localhost:3000/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"wrong"}' \
    -w "\nHTTP Status: %{http_code}\n"
  sleep 1
done
```

**Expected Result:**
- Attempts 1-4: HTTP 401 (Invalid credentials)
- Attempt 5+: HTTP 429 (Too Many Requests)
- Response: "Too many login attempts from this IP, please try again after 15 minutes."

---

### Test 4: Account Lockout (5 failed passwords) 🔒

**Purpose:** Test account locks after 5 wrong passwords

**Step 1:** Reset the account first
```bash
# Via Prisma Studio: http://localhost:5555
# Set failedLoginAttempts = 0, accountLockedUntil = null
```

**Step 2:** Make 5 failed attempts
```bash
echo "Testing Account Lockout..."
for i in {1..5}; do
  echo -e "\n=== Failed Attempt $i ==="
  curl -s -X POST http://localhost:3000/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@example.com","password":"wrongpassword"}' \
    -w "\nHTTP Status: %{http_code}\n"
  sleep 2  # Wait to avoid IP rate limit
done
```

**Step 3:** Try correct password (should be locked)
```bash
echo -e "\n=== Attempt with correct password (should be locked) ==="
curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}' \
  -w "\nHTTP Status: %{http_code}\n"
```

**Expected Result:**
- First 4 attempts: HTTP 401
- 5th attempt: Account locked
- Subsequent attempts: HTTP 423 (Locked)
- Response: "Account is temporarily locked..."
- Server log shows: `WARN: Account locked due to too many failed login attempts`

---

### Test 5: Forgot Password Rate Limiting 📧

**Purpose:** Test forgot password endpoint rate limiting

```bash
echo "Testing Forgot Password Rate Limiting..."
for i in {1..4}; do
  echo -e "\n=== Attempt $i ==="
  curl -s -X POST http://localhost:3000/api/v1/auth/forgot-password \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@example.com"}' \
    -w "\nHTTP Status: %{http_code}\n"
done
```

**Expected Result:**
- Attempts 1-3: HTTP 202 (Accepted)
- Attempt 4: HTTP 429 (Too Many Requests)
- Response: "Too many password reset attempts, please try again after an hour."

---

### Test 6: Speed Limiter (Progressive Delays) ⏱️

**Purpose:** Verify progressive delays are applied

```bash
echo "Testing Speed Limiter..."
for i in {1..5}; do
  echo -e "\n=== Attempt $i ==="
  start=$(date +%s%N)
  curl -s -X POST http://localhost:3000/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"speedtest@test.com","password":"wrong"}' > /dev/null
  end=$(date +%s%N)
  duration=$((($end - $start) / 1000000))
  echo "Response time: ${duration}ms"
done
```

**Expected Result:**
- Attempts 1-3: Normal response time (~100-200ms)
- Attempt 4: +500ms delay
- Attempt 5: +1000ms delay
- Progressive delays up to 5 seconds

---

### Test 7: Timing Attack Prevention ⏲️

**Purpose:** Verify consistent response times for existing/non-existing users

```bash
echo "Testing Timing Attack Prevention..."

echo -e "\n=== Login with non-existent user ==="
time curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"nonexistent@test.com","password":"wrong"}' > /dev/null

echo -e "\n=== Login with existing user (wrong password) ==="
time curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"wrong"}' > /dev/null
```

**Expected Result:**
- Both requests should take similar time (within 50-100ms)
- Random delays (50-150ms) make timing analysis difficult
- No way to determine if user exists based on response time

---

### Test 8: User Enumeration Prevention 👥

**Purpose:** Verify same error message for all failure types

```bash
echo "Testing User Enumeration Prevention..."

echo -e "\n=== Test 1: Non-existent user ==="
curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"nobody@test.com","password":"anything"}'

echo -e "\n\n=== Test 2: Existing user, wrong password ==="
curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"wrongpassword"}'
```

**Expected Result:**
- Both should return: `{"message":"Invalid credentials"}`
- Same HTTP status: 401
- No indication of whether email exists

---

### Test 9: IP Tracking 🌍

**Purpose:** Verify IP addresses are tracked correctly

**Step 1:** Login successfully
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}'
```

**Step 2:** Check database
```sql
SELECT email, "lastLoginAt", "lastLoginIp" 
FROM "User" 
WHERE email = 'admin@example.com';
```

**Expected Result:**
- `lastLoginAt` updated to current timestamp
- `lastLoginIp` contains IP address (e.g., `::1` for localhost)
- Server log shows IP in structured format

---

### Test 10: Security Logging 📝

**Purpose:** Verify all security events are logged

**Monitor server logs while running these:**

```bash
# Failed login
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"wrong"}'

# Successful login
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}'
```

**Expected Logs:**
```json
// Failed attempt
{"level":"warn","time":"...","email":"admin@example.com","ip":"::1","msg":"Failed login attempt - incorrect password"}

// Successful attempt
{"level":"info","time":"...","email":"admin@example.com","ip":"::1","msg":"Successful login"}
```

---

## Database Verification

### Check Failed Attempts Counter

```sql
SELECT email, "failedLoginAttempts", "accountLockedUntil" 
FROM "User" 
WHERE email = 'admin@example.com';
```

### Check Last Login Info

```sql
SELECT email, "lastLoginAt", "lastLoginIp" 
FROM "User" 
WHERE email = 'admin@example.com';
```

### Reset Account (For Testing)

```sql
UPDATE "User" 
SET 
  "failedLoginAttempts" = 0,
  "accountLockedUntil" = NULL
WHERE email = 'admin@example.com';
```

---

## Automated Test Script

Save as `test-security.sh`:

```bash
#!/bin/bash

BASE_URL="http://localhost:3000/api/v1"
EMAIL="admin@example.com"
PASSWORD="admin123"
WRONG_PASSWORD="wrongpassword"

echo "🔒 Security Test Suite"
echo "====================="

echo -e "\n✅ Test 1: Successful Login"
curl -s -X POST $BASE_URL/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" | jq

echo -e "\n❌ Test 2: Failed Login"
curl -s -X POST $BASE_URL/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$WRONG_PASSWORD\"}" | jq

echo -e "\n🚫 Test 3: Rate Limiting (5 attempts)"
for i in {1..6}; do
  echo "Attempt $i:"
  curl -s -X POST $BASE_URL/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"wrong"}' \
    -w "HTTP: %{http_code}\n"
  sleep 1
done

echo -e "\n✅ All tests complete!"
```

Make it executable and run:
```bash
chmod +x test-security.sh
./test-security.sh
```

---

## Manual Testing with Postman

### Setup Collection

1. Import `postman_collection.json`
2. Set variables:
   - `baseUrl`: `http://localhost:3000/api/v1`
   - `email`: `admin@example.com`
   - `password`: `admin123`

### Test Scenarios

1. **Happy Path:** Login with correct credentials
2. **Wrong Password:** Try wrong password multiple times
3. **Account Lockout:** Make 5 failed attempts
4. **Rate Limiting:** Make 6 rapid requests
5. **Unlock Account:** Wait 30 minutes or reset in DB

---

## Troubleshooting

### Issue: Rate limit not working

**Check:**
- Is `app.set('trust proxy', 1)` configured?
- Are you behind a proxy?
- Check server logs for rate limit middleware

### Issue: Account not locking

**Check:**
- Database migration applied?
- `failedLoginAttempts` field exists?
- Check server logs for errors

### Issue: Random delays not working

**Check:**
- `addRandomDelay()` called in controller?
- Check function implementation in `security.service.ts`

---

## Security Checklist

After running all tests, verify:

- [x] Successful logins work
- [x] Failed logins are tracked
- [x] IP rate limiting blocks after 5 attempts
- [x] Account locks after 5 wrong passwords
- [x] Account unlocks after 30 minutes
- [x] Forgot password is rate limited
- [x] Random delays are applied
- [x] Same error message for all failures
- [x] IP addresses are tracked
- [x] All events are logged

---

**Happy Testing! 🧪**


