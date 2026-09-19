# DPM — Database Reference

## Architecture

`
React 19 (TypeScript)
        │
        │  HTTPS REST API
        ▼
Node.js + Express (TypeScript / ESM)
        │
        │  pg (node-postgres)
        ▼
    PostgreSQL
  (any standard server)
`

The Express backend is the **only** layer that connects to PostgreSQL.
React never holds database credentials, hostnames, or SQL.

---

## Database Technology

| Item | Value |
|---|---|
| Database engine | PostgreSQL |
| Minimum version | PostgreSQL 14 |
| Recommended version | PostgreSQL 15 or 16 |
| Driver | `pg` (node-postgres) `^8.x` |
| Extensions required | None |
| Provider-specific SDKs | None |

---

## Supported PostgreSQL Providers

DPM connects through a standard `postgresql://` connection string.
It works with **any properly configured PostgreSQL server**:

| Environment | Example URL |
|---|---|
| Local PostgreSQL | `postgresql://postgres:postgres@localhost:5432/dpm_erp` |
| Docker PostgreSQL | `postgresql://postgres:postgres@localhost:5432/dpm_erp` |
| Render Managed PostgreSQL | `postgres://user:pass@dpg-xxx.render.com/dpm_db` |
| Neon Serverless PostgreSQL | `postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require` |
| Supabase PostgreSQL | `postgresql://postgres.xxx:pass@pooler.supabase.com:6543/postgres` |
| Railway PostgreSQL | `postgresql://postgres:pass@monorail.proxy.rlwy.net:port/railway` |
| AWS RDS PostgreSQL | `postgresql://user:pass@xxx.rds.amazonaws.com:5432/dpm_erp` |
| Google Cloud SQL | `postgresql://user:pass@xxx/dpm_erp` |
| Azure Database for PostgreSQL | `postgresql://user:pass@xxx.postgres.database.azure.com:5432/dpm_erp` |

The application does not know or care which provider is hosting PostgreSQL.

---

## Environment Variables

### Required

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (`postgresql://...` or `postgres://...`) |
| `JWT_SECRET` | HMAC-SHA256 signing key (min 32 chars) |
| `ENCRYPTION_KEY` | AES-256-GCM key (64 hex chars = 32 bytes) |

### Optional — SSL/TLS

| Variable | Default | Description |
|---|---|---|
| `DATABASE_SSL` | unset (off) | Set `true` or `1` to enable SSL. Overridden by `sslmode=` in the URL. |
| `DATABASE_SSL_REJECT_UNAUTHORIZED` | `true` | Set `false` to skip certificate verification (self-signed certs). |

**SSL resolution order** (first match wins):

1. `sslmode=disable` in DATABASE_URL → SSL **off**
2. `sslmode=require` in DATABASE_URL → SSL **on**
3. `DATABASE_SSL=true` / `DATABASE_SSL=1` → SSL **on**
4. `DATABASE_SSL=false` / `DATABASE_SSL=0` → SSL **off**
5. Default → SSL **off** (safe for local development)

### Optional — Connection Pool

| Variable | Default | Description |
|---|---|---|
| `DATABASE_POOL_MAX` | `20` | Maximum pool connections. Reduce for constrained plans. |

### Optional — Server

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Express listen port. Cloud platforms inject this automatically. |
| `NODE_ENV` | `development` | Set `production` to enable strict secrets validation. |

---

## Schema

The authoritative schema lives in:

    server/db/migrations/001_initial_schema.sql

It uses only standard PostgreSQL types — no provider-specific extensions.

Types used: VARCHAR(n), TEXT, INTEGER, SMALLINT, NUMERIC(12,2), BOOLEAN, DATE, TIMESTAMPTZ, JSONB.

Primary Keys: Application-generated VARCHAR(64) IDs. No uuid-ossp extension required.

---

## No Provider Lock-In

DPM does not use:

- Supabase client SDK
- Neon serverless driver
- Provider-specific authentication APIs
- Provider-specific extensions
- Provider-specific SQL syntax
- Hardcoded provider hostnames in application logic

The codebase is transferable to any PostgreSQL provider by changing DATABASE_URL.
