# Vectis — Database Setup Guide

## Prerequisites

- Node.js 22 or later
- Any PostgreSQL server (version 14+)
- `DATABASE_URL` for your PostgreSQL instance

---

## Quick Start

### Step 1 — Create a PostgreSQL database

Using psql:

    createdb vectis_erp

Or via your provider's dashboard/CLI. Any empty PostgreSQL database works.

### Step 2 — Configure environment

    copy .env.example .env

Edit `.env` and set at minimum:

    DATABASE_URL=postgresql://user:password@host:5432/vectis_erp
    JWT_SECRET=<random 32+ char string>
    ENCRYPTION_KEY=<64 hex characters>

Generate secrets:

    node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

### Step 3 — Install dependencies

    npm install

### Step 4 — Run migrations

    npm run db:migrate

This creates all 17 tables and the schema_migrations tracking table on a fresh database.
Re-running is safe — applied migrations are skipped automatically.

### Step 5 — Start the application

Development mode (with Vite HMR):

    npm run dev

Production mode:

    npm run build
    npm start

### Step 6 — First-time setup

Navigate to http://localhost:3000 and follow the setup wizard to create the first admin account.

---

## SSL Configuration

### Local development (no SSL)

No configuration needed. Leave DATABASE_SSL unset or:

    DATABASE_SSL=false

### Remote PostgreSQL (SSL via URL parameter)

    DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=require

### Remote PostgreSQL (SSL via environment variable)

    DATABASE_SSL=true

### Self-signed certificates

    DATABASE_SSL=true
    DATABASE_SSL_REJECT_UNAUTHORIZED=false

---

## Switching PostgreSQL Providers

To migrate from one provider to another:

1. Take a backup from the old database:

    pg_dump  > backup.sql

2. Restore to the new database:

    psql  < backup.sql

3. Update DATABASE_URL in your .env (or platform secrets).
4. Restart the application. No code changes required.

---

## Common Issues

### Connection refused on localhost

Ensure PostgreSQL is running:

    pg_isready -h localhost -p 5432

### SSL errors on managed providers

Add `?sslmode=require` to DATABASE_URL or set `DATABASE_SSL=true`.

### FATAL: DATABASE_URL not configured

Set DATABASE_URL in your `.env` file before running the server.

### Migrations fail

Check that the database user has CREATE TABLE privileges on the target database.
