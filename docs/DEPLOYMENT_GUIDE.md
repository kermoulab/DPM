# Vectis ERP — Universal Hosting & Deployment Guide

This guide covers deployment instructions for all major hosting platforms and PostgreSQL database providers.

---

## 1. Environment Variables Reference

| Variable | Required | Default | Description |
| :--- | :---: | :---: | :--- |
| `DATABASE_URL` | **Yes** | - | PostgreSQL connection URI (`postgresql://user:pass@host:5432/dbname`) |
| `JWT_SECRET` | **Yes** | - | HMAC-SHA256 session secret (minimum 32 characters) |
| `ENCRYPTION_KEY` | **Yes** | - | AES-256-GCM encryption key (64 hex characters / 32 bytes) |
| `PORT` | No | `3000` | Port Express listens on (injected automatically by cloud hosts) |
| `NODE_ENV` | No | `development` | Set to `production` for production deployments |
| `DATABASE_SSL` | No | `false` | Force SSL connection (`true` / `1`) |
| `DATABASE_SSL_REJECT_UNAUTHORIZED` | No | `true` | Set to `false` only if using self-signed certificates |
| `DATABASE_POOL_MAX` | No | `20` | Maximum connections in the pool |

---

## 2. Platform Deployment Instructions

### A. Render (1-Click Blueprint)
1. Fork or push this repository to GitHub.
2. In Render, select **New +** → **Blueprint**.
3. Select this repository. The [`render.yaml`](../render.yaml) will provision:
   - Web service on Node.js 22 LTS
   - Managed PostgreSQL 16 database
   - Automatic migrations via pre-deploy command: `npm run db:migrate`

### B. Railway
1. Click **New Project** → **Deploy from GitHub repo**.
2. Add a **PostgreSQL** database service from the Railway dashboard.
3. In the Web service variables:
   - Link `DATABASE_URL` to `${{Postgres.DATABASE_URL}}`
   - Set `NODE_ENV=production`
   - Set `JWT_SECRET` and `ENCRYPTION_KEY`
4. Railway will automatically detect the `Procfile` or `npm start`.

### C. Fly.io
1. Install `flyctl` and authenticate.
2. Launch the application:
   ```bash
   fly launch
   ```
3. Set secrets:
   ```bash
   fly secrets set DATABASE_URL="postgresql://..." JWT_SECRET="..." ENCRYPTION_KEY="..."
   ```
4. Deploy:
   ```bash
   fly deploy
   ```

### D. Heroku / Dokku
1. Create a new Heroku app:
   ```bash
   heroku create vectis-erp
   heroku addons:create heroku-postgresql:essential-0
   ```
2. Set configuration secrets:
   ```bash
   heroku config:set NODE_ENV=production JWT_SECRET="..." ENCRYPTION_KEY="..."
   ```
3. Deploy via git push:
   ```bash
   git push heroku main
   ```

### E. Google Cloud Run
1. Build and push the container image:
   ```bash
   gcloud builds submit --tag gcr.io/PROJECT_ID/vectis-erp
   ```
2. Deploy to Cloud Run:
   ```bash
   gcloud run deploy vectis-erp \
     --image gcr.io/PROJECT_ID/vectis-erp \
     --platform managed \
     --region us-central1 \
     --set-env-vars NODE_ENV=production \
     --set-secrets DATABASE_URL=db-url-secret:latest,JWT_SECRET=jwt-secret:latest,ENCRYPTION_KEY=enc-key:latest \
     --allow-unauthenticated
   ```

### F. DigitalOcean App Platform
1. Create App → Connect GitHub repository.
2. Add a Managed Database component (PostgreSQL).
3. Set environment variables (`NODE_ENV=production`, `JWT_SECRET`, `ENCRYPTION_KEY`).
4. Build command: `npm run build`, Run command: `npm start`.

### G. Generic Linux VPS (Ubuntu / Debian + Nginx + PM2)
1. Install Node.js 22 LTS and PostgreSQL 16:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
   sudo apt-get install -y nodejs postgresql nginx
   sudo npm install -g pm2
   ```
2. Clone repo and build:
   ```bash
   git clone <repo_url> /var/www/vectis
   cd /var/www/vectis
   npm ci
   cp .env.example .env # Edit secrets and DATABASE_URL
   npm run build
   npm run db:migrate
   ```
3. Start process with PM2:
   ```bash
   pm2 start dist/server.js --name "vectis-erp"
   pm2 save
   pm2 startup
   ```
4. Configure Nginx reverse proxy passing to `http://127.0.0.1:3000`.

### H. Vercel
1. Import the repository into your Vercel Dashboard.
2. In Project Settings → **Environment Variables**, configure:
   - `DATABASE_URL`: PostgreSQL connection string (use a pooled connection like Supabase/Neon).
   - `JWT_SECRET`: Minimum 32-character secret.
   - `ENCRYPTION_KEY`: 64-hex-character AES key.
   - `NODE_ENV`: `production`
3. Vercel automatically detects [`vercel.json`](../vercel.json), builds the frontend SPA into `dist/`, and mounts `/api/*` requests to the serverless function adapter in [`api/index.ts`](../api/index.ts).

### I. Netlify
1. Connect the repository in the Netlify Dashboard.
2. Under Site configuration → **Environment variables**, set:
   - `DATABASE_URL`, `JWT_SECRET`, `ENCRYPTION_KEY`, and `NODE_ENV=production`.
3. Netlify automatically reads [`netlify.toml`](../netlify.toml), builds the static assets to `dist/`, and routes `/api/*` requests to [`netlify/functions/api.ts`](../netlify/functions/api.ts).

---

## 3. PostgreSQL Provider Portability

### Neon
- Ensure your connection string includes `?sslmode=require`.
- Example: `postgresql://user:pass@ep-cool-fog-123456.us-east-2.aws.neon.tech/neondb?sslmode=require`

### Supabase
- **Direct Connection (Session Mode - Port 5432)**:
  `postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres`
- **Connection Pooler (Transaction Mode - Port 6543)**:
  `postgresql://postgres.[REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres`
  *(Vectis includes built-in graceful fallback for PgBouncer transaction-mode locking)*

### AWS RDS / Aurora
- Standard connection URI. If connecting through private VPC or public endpoint with SSL:
  `postgresql://user:pass@mydb.c9xyz.us-east-1.rds.amazonaws.com:5432/vectis_erp?sslmode=require`
