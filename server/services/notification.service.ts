import { query } from '../db/connection/pool.js';
import { notificationsRepo, type NotificationRow } from '../db/repositories/notifications.repository.js';
import { usersRepo } from '../db/repositories/users.repository.js';
import { ordersRepo } from '../db/repositories/orders.repository.js';
import { systemSettingsRepo } from '../db/repositories/system-settings.repository.js';

export interface PushPayload {
  type: string;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, any>;
}

export interface FirebaseClientConfig {
  projectId: string;
  gcmSenderId: string;
  appId: string;
  apiKey: string;
}

export class NotificationService {
  private fcmInitialized = false;
  private fcmMessaging: any = null;
  private currentProjectId?: string;
  private currentClientEmail?: string;
  private credentialSource: 'database' | 'env' | 'none' = 'none';
  private currentClientConfig?: FirebaseClientConfig | null;

  constructor() {
    this.tryInitFirebase().catch(() => {});
  }

  /**
   * Initializes Firebase Admin SDK from database system_settings or environment variable.
   * Safe & graceful: operates cleanly without throwing if credentials are not configured yet.
   */
  async tryInitFirebase(): Promise<void> {
    if (this.fcmInitialized) return;

    try {
      // 1. Check system_settings in database first
      let serviceAccountJson: string | null = null;
      try {
        serviceAccountJson = await systemSettingsRepo.get('firebase_service_account_json');
      } catch {
        // Table may not exist yet during initial installation
      }

      let source: 'database' | 'env' = 'database';
      // 2. Fall back to process.env if not in DB
      if (!serviceAccountJson) {
        serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || null;
        source = 'env';
      }

      if (serviceAccountJson && serviceAccountJson.trim()) {
        await this.initFirebaseWithJson(serviceAccountJson, source);
      }
    } catch (err) {
      console.warn('[NotificationService] Could not initialize Firebase Admin:', err);
    }
  }

  /**
   * Strictly sanitizes and whitelists incoming service account data:
   * 1. Rejects non-objects and prototype pollution keys.
   * 2. Validates format of project_id, client_email, and private_key.
   * 3. Discards ALL unexpected or extraneous fields.
   */
  private sanitizeServiceAccount(input: any): {
    type: string;
    project_id: string;
    private_key_id?: string;
    private_key: string;
    client_email: string;
    client_id?: string;
  } {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new Error('Invalid JSON: payload must be a JSON object.');
    }

    const {
      type = 'service_account',
      project_id,
      private_key_id,
      private_key,
      client_email,
      client_id
    } = input;

    if (typeof project_id !== 'string' || !/^[a-z0-9-]+$/.test(project_id.trim())) {
      throw new Error('Invalid project_id: must be a valid Google Cloud project identifier.');
    }

    if (typeof client_email !== 'string' || !client_email.includes('@') || !client_email.includes('.')) {
      throw new Error('Invalid client_email: must be a valid Google Service Account email.');
    }

    if (typeof private_key !== 'string' || !private_key.includes('BEGIN PRIVATE KEY')) {
      throw new Error('Invalid private_key: must be a valid PEM formatted RSA private key.');
    }

    // Whitelist only legitimate properties — strictly strips all arbitrary fields
    return {
      type: String(type),
      project_id: project_id.trim(),
      ...(private_key_id ? { private_key_id: String(private_key_id).trim() } : {}),
      private_key: private_key.trim(),
      client_email: client_email.trim(),
      ...(client_id ? { client_id: String(client_id).trim() } : {})
    };
  }

  /**
   * Internal helper to parse, validate, and instantiate Firebase Admin app.
   */
  async initFirebaseWithJson(jsonStrOrObj: string | object, source: 'database' | 'env' = 'database'): Promise<{ success: boolean; projectId: string; clientEmail: string }> {
    const raw = typeof jsonStrOrObj === 'string' ? JSON.parse(jsonStrOrObj) : jsonStrOrObj;
    const sanitized = this.sanitizeServiceAccount(raw);

    const { initializeApp, cert, getApps, deleteApp } = await import('firebase-admin/app');
    const { getMessaging } = await import('firebase-admin/messaging');

    // Clean up existing apps if already instantiated so new credentials replace in memory
    const existingApps = getApps();
    for (const app of existingApps) {
      await deleteApp(app).catch(() => {});
    }

    const app = initializeApp({
      credential: cert(sanitized as any)
    });
    this.fcmMessaging = getMessaging(app);
    this.fcmInitialized = true;
    this.currentProjectId = sanitized.project_id;
    this.currentClientEmail = sanitized.client_email;
    this.credentialSource = source;
    console.log(`[NotificationService] Firebase Cloud Messaging initialized (${source}) for project: ${sanitized.project_id}`);

    // Automatically resolve Android client configuration so generic APK requires zero device setup
    await this.tryResolveClientConfig(app);

    return {
      success: true,
      projectId: sanitized.project_id,
      clientEmail: sanitized.client_email
    };
  }

  /**
   * Parses public, non-sensitive Android client configuration from google-services.json or direct config.
   */
  parseClientConfig(raw: any): FirebaseClientConfig | null {
    try {
      if (!raw || typeof raw !== 'object') return null;

      // Format 1: Standard google-services.json
      if (raw.project_info && Array.isArray(raw.client)) {
        const projectId = raw.project_info.project_id;
        const gcmSenderId = raw.project_info.project_number;
        const targetClient = raw.client.find((c: any) =>
          c?.client_info?.android_client_info?.package_name === 'com.vectis.erp'
        ) || raw.client[0];
        const appId = targetClient?.client_info?.mobilesdk_app_id;
        const apiKey = targetClient?.api_key?.[0]?.current_key;

        if (projectId && gcmSenderId && appId && apiKey) {
          return {
            projectId: String(projectId).trim(),
            gcmSenderId: String(gcmSenderId).trim(),
            appId: String(appId).trim(),
            apiKey: String(apiKey).trim()
          };
        }
      }

      // Format 2: Direct client config object
      if (raw.projectId && raw.gcmSenderId && raw.appId && raw.apiKey) {
        return {
          projectId: String(raw.projectId).trim(),
          gcmSenderId: String(raw.gcmSenderId).trim(),
          appId: String(raw.appId).trim(),
          apiKey: String(raw.apiKey).trim()
        };
      }
    } catch {}
    return null;
  }

  /**
   * Attempts to auto-resolve Android client config:
   * 1. Checks PostgreSQL system_settings first.
   * 2. If not stored, queries Firebase Project Management API using the admin SDK.
   */
  private async tryResolveClientConfig(app?: any): Promise<void> {
    try {
      // 1. Check if already stored in database
      const savedConfig = await systemSettingsRepo.get('firebase_client_config');
      if (savedConfig && savedConfig.trim()) {
        try {
          this.currentClientConfig = JSON.parse(savedConfig);
          return;
        } catch {}
      }

      // 2. Query Firebase Project Management API if app is available
      if (app) {
        try {
          const { getProjectManagement } = await import('firebase-admin/project-management');
          const pm = getProjectManagement(app);
          const androidApps = await pm.listAndroidApps();
          let targetApp: any = null;
          for (const a of androidApps) {
            try {
              const meta = await a.getMetadata();
              if (meta.packageName === 'com.vectis.erp') {
                targetApp = a;
                break;
              }
            } catch {}
          }
          if (!targetApp && androidApps.length > 0) {
            targetApp = androidApps[0];
          }
          if (!targetApp) {
            try {
              targetApp = await pm.createAndroidApp('com.vectis.erp', 'Vectis ERP');
            } catch {}
          }
          if (targetApp) {
            const configStr = await targetApp.getConfig();
            const configJson = JSON.parse(configStr);
            const parsed = this.parseClientConfig(configJson);
            if (parsed) {
              this.currentClientConfig = parsed;
              await systemSettingsRepo.set('firebase_client_config', JSON.stringify(parsed));
              console.log(`[NotificationService] Auto-resolved client config for project: ${parsed.projectId}`);
            }
          }
        } catch (pmErr: any) {
          console.warn('[NotificationService] Project Management auto-fetch note:', pmErr.message);
        }
      }
    } catch {}
  }

  /**
   * Explicitly sets client configuration (e.g. when uploaded via Web UI Settings).
   */
  async configureClientConfig(jsonStrOrObj: string | object): Promise<FirebaseClientConfig> {
    const raw = typeof jsonStrOrObj === 'string' ? JSON.parse(jsonStrOrObj) : jsonStrOrObj;
    const parsed = this.parseClientConfig(raw);
    if (!parsed) {
      throw new Error('Invalid client configuration: Could not find valid projectId, gcmSenderId, appId, and apiKey.');
    }
    await systemSettingsRepo.set('firebase_client_config', JSON.stringify(parsed));
    this.currentClientConfig = parsed;
    return parsed;
  }

  /**
   * Returns public client configuration for Android devices. Contains NO private secrets.
   */
  async getClientConfig(): Promise<FirebaseClientConfig | null> {
    if (this.currentClientConfig) {
      return this.currentClientConfig;
    }
    await this.tryResolveClientConfig();
    return this.currentClientConfig || null;
  }

  /**
   * Saves service account JSON to PostgreSQL system_settings and dynamically activates it live.
   * Optionally accepts clientConfigJson as well.
   */
  async configureFirebase(serviceAccountJson: string, clientConfigJson?: string): Promise<{ success: boolean; projectId: string; clientEmail: string; clientConfig?: FirebaseClientConfig | null }> {
    const raw = typeof serviceAccountJson === 'string' ? JSON.parse(serviceAccountJson) : serviceAccountJson;
    const sanitized = this.sanitizeServiceAccount(raw);

    const result = await this.initFirebaseWithJson(sanitized, 'database');
    await systemSettingsRepo.set('firebase_service_account_json', JSON.stringify(sanitized));

    if (clientConfigJson && clientConfigJson.trim()) {
      try {
        await this.configureClientConfig(clientConfigJson);
      } catch (err: any) {
        console.warn('[NotificationService] Client config save warning:', err.message);
      }
    }

    return {
      ...result,
      clientConfig: this.currentClientConfig
    };
  }

  /**
   * Clears saved Firebase credentials from DB and tears down live Firebase Admin instance.
   */
  async removeFirebaseConfig(): Promise<void> {
    try {
      const { getApps, deleteApp } = await import('firebase-admin/app');
      for (const app of getApps()) {
        await deleteApp(app).catch(() => {});
      }
    } catch { /* ignore */ }

    this.fcmMessaging = null;
    this.fcmInitialized = false;
    this.currentProjectId = undefined;
    this.currentClientEmail = undefined;
    this.credentialSource = 'none';
    this.currentClientConfig = null;

    await systemSettingsRepo.set('firebase_service_account_json', '');
    await systemSettingsRepo.set('firebase_client_config', '');
    console.log('[NotificationService] Firebase configuration removed.');
  }

  /**
   * Returns safe status of Firebase configuration without exposing secrets.
   */
  async getFirebaseStatus(): Promise<{
    configured: boolean;
    projectId?: string;
    clientEmail?: string;
    source: 'database' | 'env' | 'none';
    clientConfigured: boolean;
    clientConfig?: { projectId: string; appId: string; gcmSenderId: string };
    activeDevicesCount: number;
  }> {
    if (!this.fcmInitialized) {
      await this.tryInitFirebase().catch(() => {});
    }

    let activeDevicesCount = 0;
    try {
      const countRes = await query<{ count: string }>(
        `SELECT COUNT(DISTINCT COALESCE(device_id, token))::text as count
         FROM push_tokens
         WHERE is_active = TRUE AND token NOT LIKE 'dev-token-%'`
      );
      activeDevicesCount = parseInt(countRes.rows[0]?.count || '0', 10);
    } catch {
      activeDevicesCount = 0;
    }

    const clientConfig = await this.getClientConfig();

    return {
      configured: this.fcmInitialized,
      projectId: this.currentProjectId,
      clientEmail: this.currentClientEmail,
      source: this.credentialSource,
      clientConfigured: !!clientConfig,
      clientConfig: clientConfig ? {
        projectId: clientConfig.projectId,
        appId: clientConfig.appId,
        gcmSenderId: clientConfig.gcmSenderId
      } : undefined,
      activeDevicesCount
    };
  }

  /**
   * Tests connection to Firebase.
   */
  async testConnection(): Promise<{ success: boolean; message: string; projectId?: string }> {
    if (!this.fcmInitialized) {
      await this.tryInitFirebase().catch(() => {});
    }

    if (!this.fcmInitialized || !this.fcmMessaging) {
      return {
        success: false,
        message: 'Firebase is not configured yet. Please upload or paste a service account JSON first.'
      };
    }

    return {
      success: true,
      message: `Firebase is successfully connected to project: ${this.currentProjectId}`,
      projectId: this.currentProjectId
    };
  }

  /**
   * Sends an immediate test notification to registered Android devices for a specific user.
   */
  async sendTestPush(userId: string): Promise<{ success: boolean; message: string; count: number }> {
    const tokens = await notificationsRepo.getActiveTokensForUser(userId);
    if (tokens.length === 0) {
      return {
        success: false,
        message: 'No active Android devices registered for your account. Please log in to the Vectis Android app on your phone first.',
        count: 0
      };
    }

    const payload: PushPayload = {
      type: 'SECURITY_ALERT',
      title: 'Vectis ERP: Test Notification',
      message: 'Push notifications are successfully configured and active on your Android device! 🎉',
      entityType: 'test',
      entityId: 'test_notification',
      metadata: { timestamp: new Date().toISOString() }
    };

    const res = await this.sendPushToTokens(tokens, payload);
    if (res.successCount === 0) {
      const errDetails = res.errors && res.errors.length > 0
        ? res.errors.join(' | ')
        : 'Google FCM could not deliver to any registered device.';
      return {
        success: false,
        message: `Dispatched to 0 devices. ${errDetails}`,
        count: 0
      };
    }

    return {
      success: true,
      message: `Test notification successfully dispatched to ${res.successCount} active device(s)!`,
      count: res.successCount
    };
  }

  /**
   * Low-level dispatcher: sends FCM push notification to tokens.
   */
  async sendPushToTokens(tokens: string[], payload: PushPayload): Promise<{ successCount: number; failureCount: number; errors?: string[] }> {
    if (!tokens || tokens.length === 0) {
      return { successCount: 0, failureCount: 0, errors: [] };
    }

    const devTokens = tokens.filter(t => t.startsWith('dev-token-'));
    const realTokens = tokens.filter(t => !t.startsWith('dev-token-'));

    let successCount = 0;
    let failureCount = 0;
    const errors: string[] = [];

    // If Firebase Messaging is available, dispatch live multicast to real FCM tokens
    if (this.fcmMessaging && realTokens.length > 0) {
      try {
        const message = {
          tokens: realTokens,
          notification: {
            title: payload.title,
            body: payload.message
          },
          data: {
            title: payload.title,
            message: payload.message,
            body: payload.message,
            type: payload.type,
            entityType: payload.entityType || '',
            entityId: payload.entityId || '',
            metadata: JSON.stringify(payload.metadata || {})
          },
          android: {
            priority: 'high' as const,
            notification: {
              channelId: 'vectis_subscription_alerts',
              sound: 'default',
              defaultSound: true,
              defaultVibrateTimings: true,
              notificationPriority: 'PRIORITY_MAX' as any,
              visibility: 'PUBLIC' as any
            }
          }
        };

        const response = await this.fcmMessaging.sendEachForMulticast(message);
        successCount = response.successCount;
        failureCount = response.failureCount;

        response.responses.forEach((resp, idx) => {
          if (!resp.success && resp.error) {
            console.error(`[NotificationService] FCM delivery error for token ${realTokens[idx]?.slice(0, 10)}...:`, resp.error.code, resp.error.message);
            errors.push(`${resp.error.code}: ${resp.error.message}`);
            // Automatically deactivate stale or unregistered tokens
            if (resp.error.code === 'messaging/registration-token-not-registered' ||
                resp.error.code === 'messaging/invalid-registration-token') {
              query(`UPDATE push_tokens SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP WHERE token = $1`, [realTokens[idx]])
                .catch(() => {});
            }
          }
        });
      } catch (err: any) {
        console.error('[NotificationService] FCM multicast error:', err);
        failureCount = realTokens.length;
        errors.push(err.message || 'FCM multicast error');
      }
    } else if (!this.fcmMessaging) {
      // Do not mark push_dispatched=true when FCM is not configured!
      errors.push('Firebase Cloud Messaging is not configured on this server.');
    }

    return { successCount, failureCount, errors };
  }

  /**
   * Dispatches a notification to a specific user:
   * 1. Records notification in the ledger (preventing duplicates if dedupKey provided and not force)
   * 2. Fetches user's active push tokens across all their devices
   * 3. Sends push via FCM to all paired devices
   */
  async notifyUser(
    userId: string,
    payload: PushPayload,
    dedupKey?: string,
    forcePush: boolean = false
  ): Promise<NotificationRow | null> {
    let existing: NotificationRow | null = null;
    if (dedupKey && !forcePush) {
      existing = await notificationsRepo.findByDedupKey(userId, dedupKey);
      // If already recorded AND push was already successfully dispatched, skip (no duplicate push)
      if (existing && existing.metadata?.push_dispatched === true) {
        return null;
      }
    }

    let record = existing;
    if (!record) {
      record = await notificationsRepo.createNotification(
        userId,
        payload.type,
        payload.title,
        payload.message,
        payload.entityType,
        payload.entityId,
        dedupKey,
        payload.metadata
      );
    }

    if (!record) {
      return null;
    }

    // Send push to all active devices of this user
    const tokens = await notificationsRepo.getActiveTokensForUser(userId);
    if (tokens.length > 0) {
      const pushRes = await this.sendPushToTokens(tokens, payload);
      if (pushRes.successCount > 0) {
        await notificationsRepo.markPushDispatched(record.id);
      }
    }

    return record;
  }

  /**
   * Retries push delivery for all un-dispatched notifications for a specific user.
   * Called when a device registers its token so it immediately receives pending alerts.
   */
  async retryPendingPushesForUser(userId: string): Promise<number> {
    const pending = await notificationsRepo.findPendingPushesForUser(userId);
    if (pending.length === 0) return 0;

    const tokens = await notificationsRepo.getActiveTokensForUser(userId);
    if (tokens.length === 0) return 0;

    let retried = 0;
    for (const notif of pending) {
      const payload: PushPayload = {
        type: notif.type,
        title: notif.title,
        message: notif.message,
        entityType: notif.entity_type ?? undefined,
        entityId: notif.entity_id ?? undefined,
        metadata: notif.metadata ?? {}
      };
      const pushRes = await this.sendPushToTokens(tokens, payload);
      if (pushRes.successCount > 0) {
        await notificationsRepo.markPushDispatched(notif.id);
        retried++;
      }
    }
    return retried;
  }

  /**
   * Dispatches a notification to all active staff members with specified roles.
   */
  async notifyStaffRoles(
    roles: string[] = ['owner', 'admin', 'manager', 'agent'],
    payload: PushPayload,
    dedupPrefix?: string,
    forcePush: boolean = false
  ): Promise<number> {
    const res = await query<{ id: string }>(
      `SELECT id FROM users WHERE role = ANY($1) AND status = 'active'`,
      [roles]
    );

    let sent = 0;
    for (const u of res.rows) {
      const dedupKey = dedupPrefix ? `${dedupPrefix}:user-${u.id}` : undefined;
      const result = await this.notifyUser(u.id, payload, dedupKey, forcePush);
      if (result) sent++;
    }
    return sent;
  }

  // ===========================================================================
  // AUTOMATED EXPIRATION DETECTION ENGINE
  // ===========================================================================

  private getExpiryThreshold(days: number): { key: string; label: string; isExpired: boolean } | null {
    if (days <= 0) return { key: 'expired', label: 'Expired', isExpired: true };
    if (days <= 7) return { key: `${days}d`, label: days === 1 ? 'Expiring Tomorrow' : `Expiring in ${days} Days`, isExpired: false };
    return null;
  }

  /**
   * Evaluates orders approaching expiration or expired.
   */
  async checkExpiringOrders(force: boolean = false): Promise<{ processed: number; notificationsSent: number }> {
    await ordersRepo.reconcileSubscriptionStatuses();

    const ordersRes = await query<any>(`
      SELECT o.id, o.order_number, o.status, o.end_date::text as end_date,
             COALESCE(p.name, 'Product') as product_name,
             COALESCE(pl.name, 'Plan') as plan_name,
             COALESCE(c.name, 'Customer') as customer_name,
             (o.end_date - ((CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date))::int as days_remaining
      FROM orders o
      LEFT JOIN products p ON p.id = o.product_id
      LEFT JOIN plans pl ON pl.id = o.plan_id
      LEFT JOIN customers c ON c.id = o.customer_id
      WHERE (
        o.status = 'expired'
        OR (o.status IN ('active', 'expiring') AND o.end_date <= (((CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date) + 7))
        OR o.end_date < ((CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date)
      )
      ORDER BY o.end_date ASC
    `);

    let sentCount = 0;
    for (const order of ordersRes.rows) {
      const th = this.getExpiryThreshold(order.days_remaining);
      if (!th) continue;

      const payload: PushPayload = {
        type: th.isExpired ? 'ORDER_EXPIRED' : 'ORDER_EXPIRING',
        title: `Subscription ${th.label}`,
        message: th.isExpired
          ? `Order #${order.order_number} (${order.product_name} - ${order.plan_name}) for customer ${order.customer_name} has expired.`
          : `Order #${order.order_number} (${order.product_name} - ${order.plan_name}) for customer ${order.customer_name} expires ${th.key === '1d' ? 'tomorrow!' : `in ${order.days_remaining} days.`}`,
        entityType: 'order',
        entityId: order.id,
        metadata: {
          orderNumber: order.order_number,
          productName: order.product_name,
          planName: order.plan_name,
          endDate: order.end_date,
          daysRemaining: order.days_remaining
        }
      };

      sentCount += await this.notifyStaffRoles(undefined, payload, `order:${order.id}:${th.key}`, force);
    }

    return { processed: ordersRes.rows.length, notificationsSent: sentCount };
  }

  /**
   * Evaluates inventory service accounts approaching expiration or expired.
   */
  async checkExpiringServiceAccounts(force: boolean = false): Promise<{ processed: number; notificationsSent: number }> {
    const accountsRes = await query<any>(`
      SELECT sa.id, sa.provider, sa.login, sa.status, sa.expiry_date::text as expiry_date,
             COALESCE(p.name, 'Service Account') as product_name,
             (sa.expiry_date - ((CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date))::int as days_remaining
      FROM service_accounts sa
      LEFT JOIN products p ON p.id = sa.product_id
      WHERE sa.expiry_date IS NOT NULL
        AND (
          sa.status = 'expired'
          OR sa.expiry_date <= (((CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date) + 7)
          OR sa.expiry_date < ((CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date)
        )
      ORDER BY sa.expiry_date ASC
    `);

    let sentCount = 0;
    for (const sa of accountsRes.rows) {
      const th = this.getExpiryThreshold(sa.days_remaining);
      if (!th) continue;

      const payload: PushPayload = {
        type: th.isExpired ? 'SERVICE_ACCOUNT_EXPIRED' : 'SERVICE_ACCOUNT_EXPIRING',
        title: `Service Account ${th.label}`,
        message: th.isExpired
          ? `${sa.provider} account (${sa.login}) for ${sa.product_name} has expired.`
          : `${sa.provider} account (${sa.login}) for ${sa.product_name} expires ${th.key === '1d' ? 'tomorrow!' : `in ${sa.days_remaining} days.`}`,
        entityType: 'service_account',
        entityId: sa.id,
        metadata: {
          provider: sa.provider,
          login: sa.login,
          productName: sa.product_name,
          expiryDate: sa.expiry_date,
          daysRemaining: sa.days_remaining
        }
      };

      sentCount += await this.notifyStaffRoles(undefined, payload, `sa:${sa.id}:${th.key}`, force);
    }

    return { processed: accountsRes.rows.length, notificationsSent: sentCount };
  }

  /**
   * Evaluates inventory license keys approaching expiration or expired.
   */
  async checkExpiringLicenseKeys(force: boolean = false): Promise<{ processed: number; notificationsSent: number }> {
    const keysRes = await query<any>(`
      SELECT lk.id, lk.license_key, lk.status, lk.expiry_date::text as expiry_date,
             COALESCE(p.name, 'License Key') as product_name,
             (lk.expiry_date - ((CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date))::int as days_remaining
      FROM license_keys lk
      LEFT JOIN products p ON p.id = lk.product_id
      WHERE lk.expiry_date IS NOT NULL
        AND (
          lk.status = 'expired'
          OR lk.expiry_date <= (((CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date) + 7)
          OR lk.expiry_date < ((CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date)
        )
      ORDER BY lk.expiry_date ASC
    `);

    let sentCount = 0;
    for (const lk of keysRes.rows) {
      const th = this.getExpiryThreshold(lk.days_remaining);
      if (!th) continue;

      const payload: PushPayload = {
        type: th.isExpired ? 'LICENSE_EXPIRED' : 'LICENSE_EXPIRING',
        title: `License Key ${th.label}`,
        message: th.isExpired
          ? `License key for ${lk.product_name} has expired.`
          : `License key for ${lk.product_name} expires ${th.key === '1d' ? 'tomorrow!' : `in ${lk.days_remaining} days.`}`,
        entityType: 'license_key',
        entityId: lk.id,
        metadata: {
          productName: lk.product_name,
          expiryDate: lk.expiry_date,
          daysRemaining: lk.days_remaining
        }
      };

      sentCount += await this.notifyStaffRoles(undefined, payload, `lk:${lk.id}:${th.key}`, force);
    }

    return { processed: keysRes.rows.length, notificationsSent: sentCount };
  }

  // ===========================================================================
  // SECURITY ACCOUNT EVENTS
  // ===========================================================================

  /**
   * Dispatches push notification when user password is changed.
   */
  async notifyPasswordChanged(userId: string): Promise<void> {
    const payload: PushPayload = {
      type: 'PASSWORD_CHANGED',
      title: 'Security Alert: Password Changed',
      message: 'Your Vectis account password was changed. If you did not make this change, contact your administrator immediately.',
      entityType: 'user',
      entityId: userId,
      metadata: {
        timestamp: new Date().toISOString()
      }
    };

    await this.notifyUser(userId, payload);
  }

  /**
   * Dispatches push notification when a failed login attempt occurs on an existing user account.
   * Throttled to 1 push alert per 5 minutes per user account to prevent FCM spam fan-out.
   */
  private failedLoginAlertCooldown = new Map<string, number>();

  async notifyFailedLogin(username: string, ip: string): Promise<void> {
    const user = await usersRepo.findByUsernameOrEmail(username);
    if (!user) return; // Do not notify non-existent usernames

    const now = Date.now();
    const lastAlert = this.failedLoginAlertCooldown.get(user.id) || 0;
    if (now - lastAlert < 5 * 60 * 1000) {
      return; // Cooldown active, drop redundant push alert
    }
    this.failedLoginAlertCooldown.set(user.id, now);

    const payload: PushPayload = {
      type: 'LOGIN_FAILED',
      title: 'Security Alert: Failed Login Attempt',
      message: `A failed login attempt on your account was detected from IP ${ip}.`,
      entityType: 'user',
      entityId: user.id,
      metadata: {
        attemptedUsername: username,
        ip,
        timestamp: new Date().toISOString()
      }
    };

    await this.notifyUser(user.id, payload);
  }

  // ===========================================================================
  // REAL-TIME ORDER & ENTITY LIFECYCLE EVENTS
  // ===========================================================================

  /**
   * Dispatches instant push notification to all paired devices when a new order is created.
   */
  async notifyOrderCreated(order: { id: string; order_number?: string; customer_name?: string; product_name?: string }): Promise<void> {
    const payload: PushPayload = {
      type: 'ORDER_CREATED',
      title: 'New Order Created',
      message: `Order #${order.order_number || order.id.slice(0, 8)} (${order.product_name || 'Product'}) has been created.`,
      entityType: 'order',
      entityId: order.id,
      metadata: {
        orderId: order.id,
        orderNumber: order.order_number,
        timestamp: new Date().toISOString()
      }
    };

    await this.notifyStaffRoles(['owner', 'admin', 'manager', 'agent'], payload);
  }

  /**
   * Dispatches instant push notification when an order subscription is renewed.
   */
  async notifyOrderRenewed(order: { id: string; order_number?: string; customer_name?: string; product_name?: string; end_date?: string }): Promise<void> {
    const payload: PushPayload = {
      type: 'ORDER_RENEWED',
      title: 'Subscription Renewed',
      message: `Order #${order.order_number || order.id.slice(0, 8)} (${order.product_name || 'Product'}) was renewed.`,
      entityType: 'order',
      entityId: order.id,
      metadata: {
        orderId: order.id,
        orderNumber: order.order_number,
        endDate: order.end_date,
        timestamp: new Date().toISOString()
      }
    };

    await this.notifyStaffRoles(['owner', 'admin', 'manager', 'agent'], payload);
  }

  /**
   * Dispatches instant push notification when an order is cancelled.
   */
  async notifyOrderCancelled(order: { id: string; order_number?: string; customer_name?: string; product_name?: string }): Promise<void> {
    const payload: PushPayload = {
      type: 'ORDER_CANCELLED',
      title: 'Order Cancelled',
      message: `Order #${order.order_number || order.id.slice(0, 8)} (${order.product_name || 'Product'}) was cancelled.`,
      entityType: 'order',
      entityId: order.id,
      metadata: {
        orderId: order.id,
        orderNumber: order.order_number,
        timestamp: new Date().toISOString()
      }
    };

    await this.notifyStaffRoles(['owner', 'admin', 'manager', 'agent'], payload);
  }

  // ===========================================================================
  // ENTITY DELETION EVENTS
  // ===========================================================================

  /**
   * Dispatches push notification when an order is deleted.
   * Captured BEFORE the underlying order record is permanently removed.
   */
  async notifyOrderDeleted(order: { id: string; order_number?: string; customer_name?: string; product_name?: string }): Promise<void> {
    const payload: PushPayload = {
      type: 'ORDER_DELETED',
      title: 'Order Deleted',
      message: `Order #${order.order_number || order.id.slice(0, 8)} (${order.product_name || 'Product'}) was deleted.`,
      entityType: 'order',
      entityId: order.id,
      metadata: {
        orderId: order.id,
        orderNumber: order.order_number,
        timestamp: new Date().toISOString()
      }
    };

    await this.notifyStaffRoles(['owner', 'admin', 'manager', 'agent'], payload);
  }

  /**
   * Dispatches push notification when a service account is deleted.
   * Captured BEFORE the underlying account record is permanently removed.
   */
  async notifyServiceAccountDeleted(account: { id: string; provider?: string; login?: string; product_name?: string }): Promise<void> {
    const payload: PushPayload = {
      type: 'SERVICE_ACCOUNT_DELETED',
      title: 'Service Account Deleted',
      message: `${account.provider || 'Service'} account (${account.login || 'account'}) was removed from inventory.`,
      entityType: 'service_account',
      entityId: account.id,
      metadata: {
        accountId: account.id,
        provider: account.provider,
        timestamp: new Date().toISOString()
      }
    };

    await this.notifyStaffRoles(['owner', 'admin', 'manager', 'agent'], payload);
  }

  /**
   * Dispatches push notification when a plan is deleted.
   */
  async notifyPlanDeleted(plan: { id: string; name: string; product_name?: string }): Promise<void> {
    const payload: PushPayload = {
      type: 'PLAN_DELETED',
      title: 'Plan Deleted',
      message: `Subscription plan "${plan.name}" was removed.`,
      entityType: 'plan',
      entityId: plan.id,
      metadata: {
        planId: plan.id,
        planName: plan.name,
        timestamp: new Date().toISOString()
      }
    };

    await this.notifyStaffRoles(['owner', 'admin', 'manager', 'agent'], payload);
  }

  /**
   * Dispatches push notification when a customer is deleted.
   */
  async notifyCustomerDeleted(customer: { id: string; name: string }): Promise<void> {
    const payload: PushPayload = {
      type: 'CUSTOMER_DELETED',
      title: 'Customer Deleted',
      message: `Customer "${customer.name}" was removed from the system.`,
      entityType: 'customer',
      entityId: customer.id,
      metadata: {
        customerId: customer.id,
        customerName: customer.name,
        timestamp: new Date().toISOString()
      }
    };

    await this.notifyStaffRoles(['owner', 'admin', 'manager'], payload);
  }

  /**
   * Purges notification history older than retentionDays (default: 30 days).
   */
  async purgeOldNotifications(retentionDays = 30): Promise<number> {
    const res = await query<{ count: string }>(
      `WITH deleted AS (
         DELETE FROM notifications
         WHERE created_at < NOW() - INTERVAL '1 day' * $1
         RETURNING id
       ) SELECT COUNT(*)::text as count FROM deleted`,
      [retentionDays]
    );
    const count = parseInt(res.rows[0]?.count || '0', 10);
    if (count > 0) {
      console.log(`[NotificationService] Purged ${count} notifications older than ${retentionDays} days.`);
    }
    return count;
  }
}

export const notificationService = new NotificationService();

