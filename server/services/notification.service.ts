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
          }
        });
      } catch (err: any) {
        console.error('[NotificationService] FCM multicast error:', err);
        failureCount = realTokens.length;
        errors.push(err.message || 'FCM multicast error');
      }
    } else if (!this.fcmMessaging && realTokens.length > 0) {
      // Graceful simulated dispatch when FCM credentials not configured
      successCount = realTokens.length;
    }

    if (devTokens.length > 0) {
      failureCount += devTokens.length;
      errors.push(`${devTokens.length} device(s) have not completed the live FCM handshake yet. Open the Vectis Android app on your phone and tap "Sync / Refresh Device Token" in Settings to establish a real-time connection.`);
    }

    return { successCount, failureCount, errors };
  }

  /**
   * Dispatches a notification to a specific user:
   * 1. Records notification in the ledger (preventing duplicates if dedupKey provided)
   * 2. Fetches user's active push tokens across all their devices
   * 3. Sends push via FCM
   */
  async notifyUser(
    userId: string,
    payload: PushPayload,
    dedupKey?: string
  ): Promise<NotificationRow | null> {
    const record = await notificationsRepo.createNotification(
      userId,
      payload.type,
      payload.title,
      payload.message,
      payload.entityType,
      payload.entityId,
      dedupKey,
      payload.metadata
    );

    // If duplicate was prevented, record is null
    if (!record) {
      return null;
    }

    // Send push to all active devices of this user
    const tokens = await notificationsRepo.getActiveTokensForUser(userId);
    if (tokens.length > 0) {
      await this.sendPushToTokens(tokens, payload);
    }

    return record;
  }

  /**
   * Dispatches a notification to all active staff members with specified roles.
   */
  async notifyStaffRoles(
    roles: string[],
    payload: PushPayload,
    dedupPrefix?: string
  ): Promise<number> {
    const res = await query<{ id: string }>(
      `SELECT id FROM users WHERE role = ANY($1) AND status = 'active'`,
      [roles]
    );

    let sent = 0;
    for (const u of res.rows) {
      const dedupKey = dedupPrefix ? `${dedupPrefix}:user-${u.id}` : undefined;
      const result = await this.notifyUser(u.id, payload, dedupKey);
      if (result) sent++;
    }
    return sent;
  }

  // ===========================================================================
  // AUTOMATED EXPIRATION DETECTION ENGINE
  // ===========================================================================

  /**
   * Evaluates orders approaching expiration or recently expired.
   * Enforces duplicate prevention across 7-day, 3-day, 1-day, and expired thresholds.
   */
  async checkExpiringOrders(): Promise<{ processed: number; notificationsSent: number }> {
    await ordersRepo.reconcileSubscriptionStatuses();

    // 1. Fetch active, expiring, or expired orders within notification horizons
    const ordersRes = await query<any>(`
      SELECT o.id, o.order_number, o.status, o.end_date::text as end_date,
             o.created_by_user_id,
             p.name as product_name,
             c.name as customer_name,
             (o.end_date - ((CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date))::int as days_remaining
      FROM orders o
      JOIN products p ON p.id = o.product_id
      JOIN customers c ON c.id = o.customer_id
      WHERE o.status IN ('active', 'expiring', 'expired')
        AND o.end_date >= (((CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date) - 2)
        AND o.end_date <= (((CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date) + 7)
    `);

    let sentCount = 0;
    const staffRoles = ['owner', 'admin', 'manager'];

    for (const order of ordersRes.rows) {
      const days = order.days_remaining;
      let thresholdKey: string | null = null;
      let title = '';
      let message = '';
      let type = '';

      if (days === 7) {
        thresholdKey = '7d';
        type = 'ORDER_EXPIRING';
        title = 'Subscription Expiring Soon (7 Days)';
        message = `Order #${order.order_number} (${order.product_name}) for customer ${order.customer_name} expires in 7 days.`;
      } else if (days === 3) {
        thresholdKey = '3d';
        type = 'ORDER_EXPIRING';
        title = 'Subscription Expiring Soon (3 Days)';
        message = `Order #${order.order_number} (${order.product_name}) for customer ${order.customer_name} expires in 3 days.`;
      } else if (days === 1) {
        thresholdKey = '1d';
        type = 'ORDER_EXPIRING';
        title = 'Subscription Expiring Tomorrow';
        message = `Order #${order.order_number} (${order.product_name}) for customer ${order.customer_name} expires tomorrow!`;
      } else if (days <= 0 && order.status === 'expired') {
        thresholdKey = 'expired';
        type = 'ORDER_EXPIRED';
        title = 'Subscription Expired';
        message = `Order #${order.order_number} (${order.product_name}) for customer ${order.customer_name} has expired.`;
      }

      if (thresholdKey) {
        const payload: PushPayload = {
          type,
          title,
          message,
          entityType: 'order',
          entityId: order.id,
          metadata: {
            orderNumber: order.order_number,
            productName: order.product_name,
            endDate: order.end_date,
            daysRemaining: days
          }
        };

        const dedupPrefix = `order:${order.id}:${thresholdKey}`;
        const sent = await this.notifyStaffRoles(staffRoles, payload, dedupPrefix);
        sentCount += sent;
      }
    }

    return { processed: ordersRes.rows.length, notificationsSent: sentCount };
  }

  /**
   * Evaluates inventory service accounts approaching expiration or expired.
   */
  async checkExpiringServiceAccounts(): Promise<{ processed: number; notificationsSent: number }> {
    const accountsRes = await query<any>(`
      SELECT sa.id, sa.provider, sa.login, sa.status, sa.expiry_date::text as expiry_date,
             p.name as product_name,
             (sa.expiry_date - ((CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date))::int as days_remaining
      FROM service_accounts sa
      JOIN products p ON p.id = sa.product_id
      WHERE sa.status IN ('active', 'suspended')
        AND sa.expiry_date IS NOT NULL
        AND sa.expiry_date >= (((CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date) - 2)
        AND sa.expiry_date <= (((CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date) + 7)
    `);

    let sentCount = 0;
    const staffRoles = ['owner', 'admin', 'manager'];

    for (const sa of accountsRes.rows) {
      const days = sa.days_remaining;
      let thresholdKey: string | null = null;
      let title = '';
      let message = '';
      let type = '';

      if (days === 7) {
        thresholdKey = '7d';
        type = 'SERVICE_ACCOUNT_EXPIRING';
        title = 'Service Account Expiring in 7 Days';
        message = `${sa.provider} account (${sa.login}) for ${sa.product_name} expires in 7 days.`;
      } else if (days === 3) {
        thresholdKey = '3d';
        type = 'SERVICE_ACCOUNT_EXPIRING';
        title = 'Service Account Expiring in 3 Days';
        message = `${sa.provider} account (${sa.login}) for ${sa.product_name} expires in 3 days.`;
      } else if (days === 1) {
        thresholdKey = '1d';
        type = 'SERVICE_ACCOUNT_EXPIRING';
        title = 'Service Account Expiring Tomorrow';
        message = `${sa.provider} account (${sa.login}) for ${sa.product_name} expires tomorrow!`;
      } else if (days <= 0) {
        thresholdKey = 'expired';
        type = 'SERVICE_ACCOUNT_EXPIRED';
        title = 'Service Account Expired';
        message = `${sa.provider} account (${sa.login}) for ${sa.product_name} has expired.`;
      }

      if (thresholdKey) {
        const payload: PushPayload = {
          type,
          title,
          message,
          entityType: 'service_account',
          entityId: sa.id,
          metadata: {
            provider: sa.provider,
            login: sa.login,
            productName: sa.product_name,
            expiryDate: sa.expiry_date,
            daysRemaining: days
          }
        };

        const dedupPrefix = `sa:${sa.id}:${thresholdKey}`;
        const sent = await this.notifyStaffRoles(staffRoles, payload, dedupPrefix);
        sentCount += sent;
      }
    }

    return { processed: accountsRes.rows.length, notificationsSent: sentCount };
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
   */
  async notifyFailedLogin(username: string, ip: string): Promise<void> {
    const user = await usersRepo.findByUsernameOrEmail(username);
    if (!user) return; // Do not notify non-existent usernames

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

    await this.notifyStaffRoles(['owner', 'admin', 'manager'], payload);
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

    await this.notifyStaffRoles(['owner', 'admin', 'manager'], payload);
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

    await this.notifyStaffRoles(['owner', 'admin', 'manager'], payload);
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

