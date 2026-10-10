import 'dotenv/config';
import express from 'express';
import path from 'path';
import { config } from './server/config/index.js';
import { closePool } from './server/db/connection/pool.js';
import { createApp, initBackgroundTasks } from './server/app.js';

async function startServer() {
  const app = createApp();
  const PORT = config.port;

  // Start background services (migrations, log purges, expiration monitors)
  initBackgroundTasks();

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Universal Digital Products Reseller ERP running at http://localhost:${PORT}`);
  });

  // Graceful shutdown handler for container/cloud platforms (Render, Railway, Fly.io, Cloud Run, K8s)
  const shutdown = async (signal: string) => {
    console.log(`[Server] Received ${signal}. Initiating graceful shutdown...`);
    server.close(async () => {
      console.log('[Server] HTTP connections closed.');
      try {
        await closePool();
        console.log('[DB] PostgreSQL pool terminated.');
      } catch (err) {
        console.error('[DB] Error during pool termination:', err);
      }
      process.exit(0);
    });

    // Force terminate if graceful cleanup exceeds timeout
    setTimeout(() => {
      console.error('[Server] Graceful shutdown timeout exceeded. Forcing exit.');
      process.exit(1);
    }, 10000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

startServer().catch(err => {
  console.error('Fatal server startup failure:', err);
  process.exit(1);
});
