# Vectis — Universal Digital Products Reseller ERP

A production-grade Enterprise Resource Planning (ERP) platform purpose-built for digital product resellers. Manages recurring subscriptions, shared streaming service accounts, software license keys, digital files, on-demand merchandise, automated order fulfillment, renewals, customer accounts, and WhatsApp notifications.

---

## Modern Technology Stack

- **Frontend:** React 19, TypeScript, Tailwind CSS v4, Motion, Lucide Icons, Vite 6
- **API & Backend:** Node.js 22 LTS, Express 4 (ESM), Layered Architecture (`Routes → Services → Repositories`), Declarative Validation Middleware, Centralized Error Handling & PostgreSQL Code Translation
- **Database:** PostgreSQL 16+ (Managed instance, connection pooling via `pg.Pool`, atomic transactional migrations, row-level locking)
- **Security & Cryptography:** PBKDF2-SHA512 password hashing (100,000 iterations), HMAC-SHA256 JWT session tokens, AES-256-GCM credential encryption, 5-tier RBAC hierarchy (`owner > admin > manager > agent > viewer`), Content Security Policy (CSP), Strict-Transport-Security (HSTS), fail-closed production guards

---

## Prerequisites

- **Node.js:** 20.x or 22.x LTS (Recommended)
- **Package Manager:** `npm` (v10+)
- **Database:** PostgreSQL 16+ (Local, Render Postgres, Neon, Supabase, AWS RDS, or Docker)

---

## Quick Start (Local Development)

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Copy the sample environment template and populate your database credentials:
```bash
cp .env.example .env
```

Generate secure 32-byte cryptographic keys using Node's crypto utility:
```bash
# Generate JWT_SECRET (32+ characters)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate ENCRYPTION_KEY (32-byte / 64 hex characters)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Configure your PostgreSQL connection string in `.env`:
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/vectis_erp
JWT_SECRET=your_generated_jwt_secret_at_least_32_characters_long
ENCRYPTION_KEY=your_generated_64_character_hex_encryption_key
PORT=3000
NODE_ENV=development
```

### 3. Run Database Migrations
Initialize the PostgreSQL schema and indexes:
```bash
npm run db:migrate
```

*(Optional)* Seed development reference products, plans, categories, currencies, and test accounts:
```bash
npm run db:seed
```

*(Optional)* If migrating from a legacy SQLite database (`data/erp.db`):
```bash
npm run db:import
```

### 4. Start Development Server
```bash
npm run dev
```
The application will boot at **http://localhost:3000** with integrated Vite Hot Module Replacement (HMR).

If starting on a fresh database without seed data, navigate to `/install` to complete the interactive setup wizard.

---

## Database Management CLI

Vectis includes a typed database management CLI at [`server/db/cli.ts`](file:///server/db/cli.ts):

| Command | Script | Description |
|---|---|---|
| `npm run db:migrate` | `tsx server/db/cli.ts migrate` | Executes unapplied SQL migrations in [`server/db/migrations/`](file:///server/db/migrations) atomically. |
| `npm run db:seed` | `tsx server/db/cli.ts seed` | Loads opt-in development reference data. **Guarded against production execution.** |
| `npm run db:import` | `tsx server/db/cli.ts import` | Migrates data from legacy SQLite (`data/erp.db`) to PostgreSQL with table-by-table record verification. |
| `npm run db:setup` | `tsx server/db/cli.ts setup` | Runs migrations followed by SQLite data import in one step. |

---

## Testing & Quality Assurance

The codebase includes full static analysis and an automated 75-assertion end-to-end regression test suite:

```bash
# Type-check TypeScript codebase (0 errors)
npm run lint

# Run full regression test suite (75 passed, 0 failed)
npm test

# Cross-platform build artifact cleanup
npm run clean
```

### What `npm test` Verifies:
- **Static Assets & SPA Routing:** `/robots.txt`, React root mounting, client-side routing fallback.
- **HTTP Security Headers:** `nosniff`, `DENY`, `strict-origin-when-cross-origin`, CSP, production HSTS.
- **Health Diagnostics:** `/api/health` status codes (HTTP 200 vs HTTP 503), latency measurement, uptime, error sanitization.
- **API 404 Guard:** Non-existent API endpoints return JSON errors with `code: 'NOT_FOUND'`, never HTML.
- **Request Validation:** Rejection of empty/malformed bodies, email validation, minimum string lengths.
- **Authentication & JWT Security:** Missing tokens, malformed tokens, tampered signatures, expired tokens.
- **Route Mounting:** All 18 route handlers verified properly mounted and guarded.
- **Cryptographic Primitives:** PBKDF2-SHA512 constant-time verification, AES-256-GCM authenticated encryption and tamper detection.

---

## Production Build & Deployment

### Local Production Build
```bash
# 1. Clean previous build
npm run clean

# 2. Build Vite frontend + bundle Node ESM server + copy SQL migrations
npm run build

# 3. Start production server
npm start
```

### Render Cloud Deployment (1-Click Blueprint)
The repository includes an authoritative [`render.yaml`](file:///render.yaml) blueprint specification:

1. Connect your repository to [Render](https://render.com).
2. Create a new **Blueprint** and select this repository.
3. Render will automatically provision:
   - **Web Service:** Node.js 22 LTS, auto-scaling, health check probe at `/api/health`.
   - **Managed Database:** PostgreSQL 16 instance in the same region.
   - **Environment Variables:** `DATABASE_URL` linked via private connection string; `JWT_SECRET` and `ENCRYPTION_KEY` generated cryptographically.
   - **Pre-Deploy Hook:** Automatically executes `npm run db:migrate` before switching production traffic.

---

## Environment Configuration

| Variable | Type | Default | Required in Prod | Description |
|---|---|---|:---:|---|
| `DATABASE_URL` | String | - | **YES** | PostgreSQL connection URI (`postgresql://user:pass@host:5432/dbname?sslmode=require`). |
| `JWT_SECRET` | String | - | **YES** | Cryptographic secret for signing HMAC-SHA256 session tokens. Minimum 32 characters. |
| `ENCRYPTION_KEY` | String | - | **YES** | 32-byte hex string (64 characters) or 32+ character passphrase for AES-256-GCM credential encryption. |
| `PORT` | Integer | `3000` | No | Server listen port (1–65535). Defaults to `3000` or `$PORT` provided by cloud host. |
| `NODE_ENV` | String | `development` | No | Environment mode (`development` or `production`). Enables HSTS, strict secrets, and error sanitization in production. |
| `DB_POOL_MAX` | Integer | `20` | No | Maximum number of concurrent connections in the PostgreSQL pool. |

---

## Architecture & Data Flow

```
HTTP Request
     │
     ▼
[Security Headers & Body Limit (2MB)]
     │
     ▼
[Authentication Middleware (verifySessionToken & live DB status)]
     │
     ▼
[RBAC Authorization (requireRole: owner > admin > manager > agent > viewer)]
     │
     ▼
[Declarative Request Validation (validateBody schema)]
     │
     ▼
[Route Handlers (server/routes/)] ───► [Service Layer (server/services/)]
                                                 │
                                                 ▼
                                     [Repositories (server/db/repositories/)]
                                                 │
                                                 ▼
                                     [PostgreSQL Connection Pool (pg.Pool)]
                                     - FOR UPDATE OF sp SKIP LOCKED (concurrency)
                                     - Parameterized Queries ($1, $2, ...)
                                     - Atomic Transactions (BEGIN / COMMIT / ROLLBACK)
```

---

## License

Private & Confidential. All rights reserved. Vectis ERP.
