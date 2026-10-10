import 'dotenv/config';
import express, { Express } from 'express';
import path from 'path';
import { config } from './config/index.js';
import { getPool, testConnection } from './db/connection/pool.js';
import { runMigrations } from './db/migrator.js';
import { errorHandler, NotFoundError } from './middleware/error.middleware.js';

// Import route handlers
import { installRouter } from './routes/install.js';
import { authRouter } from './routes/auth.js';
import { dashboardRouter } from './routes/dashboard.js';
import { categoriesRouter } from './routes/categories.js';
import { productsRouter } from './routes/products.js';
import { plansRouter } from './routes/plans.js';
import { customersRouter } from './routes/customers.js';
import { inventoryRouter } from './routes/inventory.js';
import { ordersRouter } from './routes/orders.js';
import { renewalsRouter } from './routes/renewals.js';
import { alertsRouter } from './routes/alerts.js';
import { whatsappRouter } from './routes/whatsapp.js';
import { currenciesRouter } from './routes/currencies.js';
import { usersRouter } from './routes/users.js';
import { devicesRouter } from './routes/devices.js';
import { auditRouter } from './routes/audit.js';
import { settingsRouter } from './routes/settings.js';
import { searchRouter } from './routes/search.js';
import { notificationsRouter } from './routes/notifications.js';
import { auditRepo } from './db/repositories/audit.repository.js';
import { notificationService } from './services/notification.service.js';

let backgroundTasksStarted = false;

export function initBackgroundTasks(): void {
  if (backgroundTasksStarted) return;
  backgroundTasksStarted = true;

  if (config.databaseUrl) {
    // Run PostgreSQL migrations on startup if DATABASE_URL is configured
    runMigrations(getPool())
      .then((migResult) => {
        if (migResult.applied.length > 0) {
          console.log(`[DB] Applied ${migResult.applied.length} pending PostgreSQL migrations.`);
        }
      })
      .catch((migErr) => {
        console.error('[DB] Migration error on startup:', migErr);
      });

    // Auto-purge audit logs and notification history older than 30 days on startup and every 24 hours
    auditRepo.purgeOldLogs(30).catch((err) => console.error('[Audit] Startup purge failed:', err));
    notificationService.purgeOldNotifications(30).catch((err) => console.error('[Notification] Startup purge failed:', err));
    setInterval(() => {
      auditRepo.purgeOldLogs(30).catch((err) => console.error('[Audit] Scheduled purge failed:', err));
      notificationService.purgeOldNotifications(30).catch((err) => console.error('[Notification] Scheduled purge failed:', err));
    }, 24 * 60 * 60 * 1000).unref();

    // Periodic subscription, service account, and license inventory expiration notification checks
    const runExpirationCheck = async () => {
      try {
        await Promise.all([
          notificationService.checkExpiringOrders(),
          notificationService.checkExpiringServiceAccounts(),
          notificationService.checkExpiringLicenseKeys(),
        ]);
      } catch (err) {
        console.error('[NotificationEngine] Expiration check error:', err);
      }
    };
    setTimeout(runExpirationCheck, 3 * 1000).unref();
    setInterval(runExpirationCheck, 2 * 60 * 1000).unref();
  }
}

export function createApp(): Express {
  const app = express();

  // Middleware
  // JSON body limit of 2MB — no legitimate API payload requires more than this.
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));

  // CORS middleware: allow authorized origins & handle OPTIONS preflight
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Device-Id, X-Device-Token');
      res.setHeader('Access-Control-Expose-Headers', 'X-New-Token, X-Device-Revoked');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  // Security response headers
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '0'); // Deprecated; CSP is the modern control
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data: https:; font-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';");
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet, noimageindex, notranslate');
    if (process.env.NODE_ENV === 'production') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
  });

  // Dedicated robots.txt handler to prevent AI scraping and cloning
  app.get('/robots.txt', (req, res) => {
    const robotsPath = path.join(process.cwd(), 'public', 'robots.txt');
    res.type('text/plain');
    res.sendFile(robotsPath);
  });

  // API Routes
  app.use('/api/install', installRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/categories', categoriesRouter);
  app.use('/api/products', productsRouter);
  app.use('/api/plans', plansRouter);
  app.use('/api/customers', customersRouter);
  app.use('/api/inventory', inventoryRouter);
  app.use('/api/orders', ordersRouter);
  app.use('/api/renewals', renewalsRouter);
  app.use('/api/alerts', alertsRouter);
  app.use('/api/whatsapp', whatsappRouter);
  app.use('/api/currencies', currenciesRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/devices', devicesRouter);
  app.use('/api/audit', auditRouter);
  app.use('/api/settings', settingsRouter);
  app.use('/api/search', searchRouter);
  app.use('/api/notifications', notificationsRouter);

  // Health check
  app.get('/api/health', async (req, res) => {
    const dbTest = await testConnection();
    const uptimeSeconds = Math.floor(process.uptime());
    const isHealthy = dbTest.ok;
    const isConfigured = Boolean(config.databaseUrl);

    // In production or when DB is configured, an unreachable DB returns 503 Service Unavailable
    // In local dev without DATABASE_URL configured yet, return 200 setup_required to allow installer access
    const httpStatus = isHealthy ? 200 : (config.isProduction || isConfigured ? 503 : 200);

    res.status(httpStatus).json({
      status: isHealthy ? 'ok' : 'unhealthy',
      database: isHealthy ? 'connected' : (isConfigured ? 'disconnected' : 'unconfigured'),
      latencyMs: dbTest.latencyMs,
      uptimeSeconds,
      timestamp: new Date().toISOString(),
      ...(dbTest.error && !config.isProduction ? { error: dbTest.error } : {})
    });
  });

  // 404 Handler for all API routes (prevents fallback to index.html)
  app.use('/api', (req, res, next) => {
    next(new NotFoundError(`API endpoint ${req.method} ${req.originalUrl} not found`));
  });

  // Global Error Handler for API routes
  app.use(errorHandler);

  return app;
}
