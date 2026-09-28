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
