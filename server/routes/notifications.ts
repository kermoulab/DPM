import { Router } from 'express';
import { notificationsRepo } from '../db/repositories/notifications.repository.js';
import { notificationService } from '../services/notification.service.js';
import { requireAuth, requireRole, type AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { validateBody, v } from '../middleware/validation.middleware.js';

export const notificationsRouter = Router();

// POST /api/notifications/register-token
notificationsRouter.post(
  '/register-token',
  requireAuth,
  validateBody({
    token: v.required('Push token is required.')
  }),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { token, device_id, platform = 'android', app_version } = req.body;
      const registered = await notificationsRepo.registerToken(
        req.user!.id,
        token,
        device_id,
        platform,
        app_version
      );

      res.json({
        success: true,
        message: 'Push device token registered successfully.',
        id: registered.id
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/notifications/unregister-token
notificationsRouter.post(
  '/unregister-token',
  requireAuth,
  validateBody({
    token: v.required('Push token is required.')
  }),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { token } = req.body;
      await notificationsRepo.unregisterToken(req.user!.id, token);
      res.json({
        success: true,
        message: 'Push device token unregistered successfully.'
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/notifications
notificationsRouter.get('/', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const limit = parseInt(req.query.limit as string, 10) || 50;
    const notifications = await notificationsRepo.findUserNotifications(req.user!.id, limit);
    const unreadCount = await notificationsRepo.getUnreadCount(req.user!.id);

    res.json({
      success: true,
      notifications,
      unreadCount
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/notifications/:id/read
notificationsRouter.patch('/:id/read', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const { id } = req.params;
    await notificationsRepo.markAsRead(req.user!.id, id);
    res.json({ success: true, message: 'Notification marked as read.' });
  } catch (err) {
    next(err);
  }
});

// POST /api/notifications/read-all
notificationsRouter.post('/read-all', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const count = await notificationsRepo.markAllAsRead(req.user!.id);
    res.json({ success: true, message: `${count} notifications marked as read.` });
  } catch (err) {
    next(err);
  }
});

// POST /api/notifications/check-expirations (Admin / Manager manual or cron trigger)
notificationsRouter.post('/check-expirations', requireAuth, requireRole('manager'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const orderResults = await notificationService.checkExpiringOrders();
    const saResults = await notificationService.checkExpiringServiceAccounts();

    res.json({
      success: true,
      orders: orderResults,
      serviceAccounts: saResults
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/notifications/config (Admin only)
notificationsRouter.get('/config', requireAuth, requireRole('admin'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const status = await notificationService.getFirebaseStatus();
    res.json({
      success: true,
      status
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/notifications/client-config (All authenticated users / Android app)
notificationsRouter.get('/client-config', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const config = await notificationService.getClientConfig();
    res.json({
      success: true,
      configured: !!config,
      config: config || null
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/notifications/client-config (Admin only - upload or update google-services.json)
notificationsRouter.post('/client-config', requireAuth, requireRole('admin'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { clientConfigJson } = req.body;
    if (!clientConfigJson) {
      res.status(400).json({ success: false, error: 'Client configuration JSON is required.' });
      return;
    }

    const config = await notificationService.configureClientConfig(clientConfigJson);
    res.json({
      success: true,
      message: 'Android client configuration saved successfully.',
      config: {
        projectId: config.projectId,
        appId: config.appId,
        gcmSenderId: config.gcmSenderId
      }
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: err.message || 'Failed to parse and save client configuration.'
    });
  }
});

// POST /api/notifications/config (Admin only - upload or paste serviceAccount JSON)
notificationsRouter.post('/config', requireAuth, requireRole('admin'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { serviceAccountJson, clientConfigJson } = req.body;
    if (!serviceAccountJson) {
      res.status(400).json({ success: false, error: 'Firebase service account JSON is required.' });
      return;
    }

    const result = await notificationService.configureFirebase(serviceAccountJson, clientConfigJson);
    res.json({
      success: true,
      message: 'Firebase configuration saved and activated successfully.',
      projectId: result.projectId,
      clientEmail: result.clientEmail,
      clientConfigured: !!result.clientConfig
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: err.message || 'Failed to configure Firebase credentials.'
    });
  }
});

// DELETE /api/notifications/config (Admin only - remove configuration)
notificationsRouter.delete('/config', requireAuth, requireRole('admin'), async (req: AuthenticatedRequest, res, next) => {
  try {
    await notificationService.removeFirebaseConfig();
    res.json({
      success: true,
      message: 'Firebase configuration removed successfully.'
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/notifications/test-connection (Admin only - test Firebase connection)
notificationsRouter.post('/test-connection', requireAuth, requireRole('admin'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const result = await notificationService.testConnection();
    res.json(result);
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: err.message || 'Firebase connection test failed.'
    });
  }
});

// POST /api/notifications/test-push (Admin only - send test notification to caller's registered devices)
notificationsRouter.post('/test-push', requireAuth, requireRole('admin'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const result = await notificationService.sendTestPush(req.user!.id);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: err.message || 'Failed to dispatch test push notification.'
    });
  }
});

