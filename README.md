# Recura — Universal Digital Products Reseller ERP

A production-ready ERP for digital product resellers. Manages subscriptions, service accounts, license keys, digital files, on-demand merch, orders, renewals, inventory, customers, and WhatsApp notifications.

## Stack

- **Frontend:** React 19 + TypeScript + Tailwind CSS v4
- **Backend:** Node.js + Express (ESM/TypeScript via tsx/esbuild)
- **Database:** SQLite (node:sqlite, WAL mode, FK enforcement)
- **Auth:** Session tokens (HMAC-SHA256 JWT-compatible), PBKDF2-SHA512 password hashing

## Quick Start

**Prerequisites:** Node.js 18+ (or Bun)

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   ```
   Set `ENCRYPTION_KEY` (32-byte hex) and `JWT_SECRET` (minimum 32 chars) in `.env`.

3. **Run development server:**
   ```bash
   npm run dev
   ```
   Opens at http://localhost:3000

4. **Complete the installer** at `/install` to provision the database and create the admin account.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `ENCRYPTION_KEY` | **Required** | 32-byte hex key for AES-256-GCM service credential encryption. Generate: `node -e "require('crypto').randomBytes(32).toString('hex')" \| pbcopy` |
| `JWT_SECRET` | **Required** | Secret for session token signing. Minimum 32 characters. |

> **Security:** Both secrets MUST be set before running in any environment beyond local development. The application will refuse to start if secrets are missing in production.

## Production Build

```bash
npm run build
npm start
```

## Database

The database is a SQLite file at `data/erp.db`. See `db.sql` for the authoritative schema. The schema is initialized automatically on first startup via `server/db.ts`.

## Architecture

```
Category → Product → Plan → Order → Customer
                  ↓
          Service Account → Profiles
          License Keys
          Digital Assets
          Merch Mockups
```
