# ll-express-api

A TypeScript Express API with a clean layered architecture.

## Structure
src/
  app/            Express app factory
  config/         Env/config handling
  controllers/    Route handlers
  middleware/     Reusable middlewares
  routes/         Routers (v1 mounted at /api/v1)
  services/       Business logic
  utils/          Helpers (logger, etc.)
  types/          Shared types

## Scripts
- dev: nodemon with ts-node
- build: tsc compile to dist
- start: run compiled app
- lint: ESLint TypeScript
- format: Prettier write
- test: Jest + Supertest e2e tests

## Getting Started
1. Copy `.env.example` to `.env` and set values
2. Install deps: `npm install`
3. Generate Prisma client: `npx prisma generate`
4. Run migrations: `npx prisma migrate dev --name init`
5. Seed data: `npm run prisma:seed`
6. Start dev server: `npm run dev`
7. Health check: `GET http://localhost:3000/api/v1/health`

## Env
See `.env.example` for full list.
Required:
- JWT_SECRET: string (>=16 chars)
- JWT_EXPIRES_IN: string (e.g., 1h, 7d)
- DATABASE_URL: Postgres URL (e.g., `postgresql://postgres:postgres@localhost:5432/ll_express_api?schema=public`)
Optional (email):
- SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASSWORD
- or GMAIL_USER, GMAIL_APP_PASSWORD
- EMAIL_FROM
Optional (reset):
- RESET_PASSWORD_URL_BASE (frontend URL to handle reset token)
Optional (BetterAuth for SUPER_ADMIN):
- BETTERAUTH_BASE_URL, BETTERAUTH_API_TOKEN, BETTERAUTH_FORGOT_PATH

## Authentication & Authorization
JWT-based auth. `login` issues JWT; `me` returns token claims. Role-based routes use middleware.

## Database (Prisma + Postgres)
1. Ensure Postgres is running and `DATABASE_URL` is set
2. Generate client: `npx prisma generate`
3. Run migrations: `npx prisma migrate dev --name init`
4. Seed data: `npm run prisma:seed`


### Roles
- SUPER_ADMIN, DOCTOR, EMPLOYEE

### Employee Types (extensible)
- QC, TECHNICIAN, and can add more at runtime

### Technician Groups (extensible)
- CAD_TECHNICIAN, CAM_TECHNICIAN, and can add more at runtime

### Endpoints
- POST `/api/v1/auth/login`
  - Body: `{ email: string, password: string }` (validated)
  - Returns: `{ token }`
- POST `/api/v1/auth/forgot-password`
  - Body: `{ email: string }` (validated)
  - SUPER_ADMIN => BetterAuth; others => email via SMTP/Gmail
  - Always returns `202` to avoid user enumeration
- GET `/api/v1/auth/me`
  - Header: `Authorization: Bearer <token>`
  - Returns: `{ user }`
- GET `/api/v1/admin/types` (SUPER_ADMIN)
  - Returns: `{ employeeTypes: string[], technicianGroups: string[] }`
- POST `/api/v1/admin/employee-types` (SUPER_ADMIN)
  - Body: `{ type: string }`
- POST `/api/v1/admin/technician-groups` (SUPER_ADMIN)
  - Body: `{ group: string }`
- Users (SUPER_ADMIN):
  - GET `/api/v1/users`
  - POST `/api/v1/users`
  - PUT `/api/v1/users/:id`
  - DELETE `/api/v1/users/:id`

## Testing
Run end-to-end tests:

```
npm test
```

## Postman
Import `postman_collection.json`. Set variables:
- `baseUrl`: `http://localhost:3000/api/v1`
- `token`: set after login