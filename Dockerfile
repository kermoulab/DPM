# Multi-stage production Dockerfile for Vectis ERP
# Target: Node.js 22 LTS on Alpine Linux for minimal container footprint

# ─── Stage 1: Build Frontend and Backend ──────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies using committed lockfile for exact reproducibility
COPY package.json package-lock.json ./
RUN npm ci

# Copy application source code
COPY . .

# Run production build (Vite client + esbuild Node server + migration copying)
RUN npm run build

# ─── Stage 2: Production Runtime ──────────────────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install production dependencies only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy built distribution bundle from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json

# Run as non-root user for container security
USER node

EXPOSE 3000

# Start production server
CMD ["node", "dist/server.js"]
