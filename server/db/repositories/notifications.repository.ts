import { query } from '../connection/pool.js';
import crypto from 'crypto';

export interface PushTokenRow {
  id: string;
  user_id: string;
  device_id: string | null;
  token: string;
  platform: string;
  app_version: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_used_at: string | null;
}

export interface NotificationRow {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  entity_type: string | null;
  entity_id: string | null;
  dedup_key: string | null;
  is_read: boolean;
  metadata: any;
  created_at: string;
  sent_at: string | null;
}

export class NotificationsRepository {
  /**
   * Registers or updates a device push token for a user.
   * Multi-device safe: Keeps multiple devices active per user.
   */
  async registerToken(
    userId: string,
    token: string,
    deviceId?: string | null,
    platform: string = 'android',
    appVersion?: string | null
  ): Promise<PushTokenRow> {
    const cleanToken = token.trim();
    const id = 'ptok-' + crypto.randomUUID().slice(0, 12);

    const sql = `
      INSERT INTO push_tokens (id, user_id, device_id, token, platform, app_version, is_active, created_at, updated_at, last_used_at)
      VALUES ($1, $2, $3, $4, $5, $6, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id, token)
      DO UPDATE SET
        device_id = COALESCE(EXCLUDED.device_id, push_tokens.device_id),
        app_version = COALESCE(EXCLUDED.app_version, push_tokens.app_version),
        is_active = TRUE,
        updated_at = CURRENT_TIMESTAMP,
        last_used_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    // 1. Deactivate any previous token for the same deviceId
    if (deviceId) {
      await query(
        `UPDATE push_tokens
         SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $1 AND device_id = $2 AND token != $3`,
        [userId, deviceId, cleanToken]
      );
    }

    // 2. If registering a genuine FCM token, deactivate any old dev fallback tokens for this user
    if (!cleanToken.startsWith('dev-token-')) {
      await query(
        `UPDATE push_tokens
         SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $1 AND token LIKE 'dev-token-%'`,
        [userId]
      );
    }

    const res = await query<PushTokenRow>(sql, [
      id,
      userId,
      deviceId || null,
      cleanToken,
      platform,
      appVersion || null
    ]);

    return res.rows[0];
  }

  /**
   * Unregisters/deactivates a token when a device logs out.
   * Does NOT touch the user's other active devices.
   */
  async unregisterToken(userId: string, token: string): Promise<boolean> {
    const res = await query(
      `UPDATE push_tokens
       SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $1 AND token = $2`,
      [userId, token.trim()]
    );
    return (res.rowCount ?? 0) > 0;
  }

  /**
   * Deactivates all tokens belonging to a specific physical device ID upon device unpairing.
   */
  async deactivateDeviceTokens(deviceId: string): Promise<number> {
    const res = await query(
      `UPDATE push_tokens
       SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
       WHERE device_id = $1`,
      [deviceId]
    );
    return res.rowCount ?? 0;
  }

  /**
   * Gets active push tokens for a user.
   */
  async getActiveTokensForUser(userId: string): Promise<string[]> {
    const res = await query<{ token: string }>(
      `SELECT token FROM push_tokens
       WHERE user_id = $1 AND is_active = TRUE`,
      [userId]
    );
    return res.rows.map(r => r.token);
  }

  /**
   * Gets active push tokens for all users with specified roles (e.g. ['owner', 'admin', 'manager']).
   */
  async getActiveTokensForRoles(roles: string[]): Promise<string[]> {
    const res = await query<{ token: string }>(
      `SELECT DISTINCT pt.token
       FROM push_tokens pt
       JOIN users u ON u.id = pt.user_id
       WHERE u.role = ANY($1) AND u.status = 'active' AND pt.is_active = TRUE`,
      [roles]
    );
    return res.rows.map(r => r.token);
  }

  /**
   * Finds an existing notification by user and dedupKey.
   */
  async findByDedupKey(userId: string, dedupKey: string): Promise<NotificationRow | null> {
    const res = await query<NotificationRow>(
      `SELECT * FROM notifications WHERE user_id = $1 AND dedup_key = $2 LIMIT 1`,
      [userId, dedupKey]
    );
    return res.rows[0] || null;
  }

  /**
   * Marks a notification as having been successfully dispatched to push devices.
   */
  async markPushDispatched(notificationId: string): Promise<void> {
    await query(
      `UPDATE notifications
       SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{push_dispatched}', 'true'::jsonb),
           sent_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [notificationId]
    );
  }

  /**
   * Returns notifications for a user where push was never successfully dispatched
   * (created in the last 30 days). Used to retry push when a device comes online.
   */
  async findPendingPushesForUser(userId: string): Promise<NotificationRow[]> {
    const res = await query<NotificationRow>(
      `SELECT * FROM notifications
       WHERE user_id = $1
         AND created_at >= NOW() - INTERVAL '30 days'
         AND (metadata IS NULL OR (metadata->>'push_dispatched') IS DISTINCT FROM 'true')
       ORDER BY created_at ASC`,
      [userId]
    );
    return res.rows;
  }


  /**
   * Records a notification in the ledger, with duplicate prevention using dedupKey.
   * Returns null if a notification with the same dedupKey has already been sent to this user.
   */
  async createNotification(
    userId: string,
    type: string,
    title: string,
    message: string,
    entityType?: string | null,
    entityId?: string | null,
    dedupKey?: string | null,
    metadata: any = {}
  ): Promise<NotificationRow | null> {
    if (dedupKey) {
      const existing = await this.findByDedupKey(userId, dedupKey);
      if (existing) {
        return null; // Duplicate prevented!
      }
    }

    const id = 'notif-' + crypto.randomUUID().slice(0, 12);
    const sql = `
      INSERT INTO notifications (
        id, user_id, type, title, message, entity_type, entity_id, dedup_key, is_read, metadata, created_at, sent_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, FALSE, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *
    `;

    const res = await query<NotificationRow>(sql, [
      id,
      userId,
      type,
      title,
      message,
      entityType || null,
      entityId || null,
      dedupKey || null,
      JSON.stringify(metadata)
    ]);

    return res.rows[0];
  }

  /**
   * Retrieves user notifications with pagination.
   */
  async findUserNotifications(userId: string, limit: number = 50): Promise<NotificationRow[]> {
    const safeLimit = Math.min(Math.max(1, limit), 100);
    const res = await query<NotificationRow>(
      `SELECT * FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, safeLimit]
    );
    return res.rows;
  }

  /**
   * Gets unread notifications count for badge display.
   */
  async getUnreadCount(userId: string): Promise<number> {
    const res = await query<{ count: string }>(
      `SELECT COUNT(*)::int as count FROM notifications
       WHERE user_id = $1 AND is_read = FALSE`,
      [userId]
    );
    return parseInt(res.rows[0]?.count || '0', 10);
  }

  /**
   * Marks a single notification as read.
   */
  async markAsRead(userId: string, notificationId: string): Promise<boolean> {
    const res = await query(
      `UPDATE notifications SET is_read = TRUE
       WHERE id = $1 AND user_id = $2`,
      [notificationId, userId]
    );
    return (res.rowCount ?? 0) > 0;
  }

  /**
   * Marks all user notifications as read.
   */
  async markAllAsRead(userId: string): Promise<number> {
    const res = await query(
      `UPDATE notifications SET is_read = TRUE
       WHERE user_id = $1 AND is_read = FALSE`,
      [userId]
    );
    return res.rowCount ?? 0;
  }
}

export const notificationsRepo = new NotificationsRepository();
