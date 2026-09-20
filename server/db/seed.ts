import type pg from 'pg';
import crypto from 'crypto';
import { encryptCredential } from '../utils/crypto.js';

/**
 * Opt-in development seed script.
 * Populates realistic sample catalog, inventory, and templates for local testing.
 * NEVER run automatically in production.
 */
export async function seedDevelopmentData(pool: pg.Pool): Promise<void> {
  if (process.env.NODE_ENV === 'production' && !process.argv.includes('--force')) {
    console.error('FATAL: Refusing to seed development data in production unless --force is provided.');
    throw new Error('Development seed blocked in production.');
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    console.log('[Seed] Inserting development reference data...');

    // 1. Categories
    const categories = [
      { id: 'cat-streaming', name: 'Streaming & Media', slug: 'streaming-media', icon: 'Tv', description: 'Premium video and music subscriptions' },
      { id: 'cat-productivity', name: 'Productivity & AI', slug: 'productivity-ai', icon: 'Sparkles', description: 'AI assistants and creative productivity tools' },
      { id: 'cat-security', name: 'Security & VPN', slug: 'security-vpn', icon: 'Shield', description: 'Privacy and virtual private networks' }
    ];

    for (const c of categories) {
      await client.query(
        `INSERT INTO categories (id, name, slug, icon, description, status, created_at)
         VALUES ($1, $2, $3, $4, $5, 'active', CURRENT_TIMESTAMP)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, icon = EXCLUDED.icon`,
        [c.id, c.name, c.slug, c.icon, c.description]
      );
    }

    // 2. Products
    const products = [
      {
        id: 'prod-netflix',
        category_id: 'cat-streaming',
        name: 'Netflix Premium 4K UHD',
        slug: 'netflix-premium-4k',
        brand: 'Netflix',
        description: 'Ultra HD 4K screen profile with personal PIN protection.',
        status: 'active',
        capabilities: ['subscription', 'profiles', 'pin_lock'],
        fulfillment_type: 'service_account',
        icon: 'Tv',
        stock_limit: 50
      },
      {
        id: 'prod-chatgpt',
        category_id: 'cat-productivity',
        name: 'ChatGPT Plus (GPT-4o)',
        slug: 'chatgpt-plus',
        brand: 'OpenAI',
        description: 'Direct license access to OpenAI flagship GPT-4o capabilities.',
        status: 'active',
        capabilities: ['subscription', 'license_key'],
        fulfillment_type: 'license_key',
        icon: 'Bot',
        stock_limit: 100
      },
      {
        id: 'prod-canva',
        category_id: 'cat-productivity',
        name: 'Canva Pro Enterprise Team',
        slug: 'canva-pro-team',
        brand: 'Canva',
        description: 'Full team invite access to Canva Pro brand kit and assets.',
        status: 'active',
        capabilities: ['subscription', 'email_invite'],
        fulfillment_type: 'manual',
        icon: 'Palette',
        stock_limit: 200
      }
    ];

    for (const p of products) {
      await client.query(
        `INSERT INTO products (id, category_id, name, slug, brand, description, status, capabilities, fulfillment_type, icon, stock_limit, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)
         ON CONFLICT (id) DO NOTHING`,
        [p.id, p.category_id, p.name, p.slug, p.brand, p.description, p.status, JSON.stringify(p.capabilities), p.fulfillment_type, p.icon, p.stock_limit]
      );
    }

    // 3. Plans
    const plans = [
      { id: 'plan-netflix-1m', product_id: 'prod-netflix', name: '1 Month 4K Profile', duration: 30, duration_unit: 'days', price: 4.99, cost: 2.50, currency: 'USD' },
      { id: 'plan-netflix-3m', product_id: 'prod-netflix', name: '3 Months 4K Profile', duration: 90, duration_unit: 'days', price: 13.99, cost: 7.00, currency: 'USD' },
      { id: 'plan-chatgpt-1m', product_id: 'prod-chatgpt', name: '1 Month License Key', duration: 30, duration_unit: 'days', price: 19.99, cost: 14.00, currency: 'USD' },
      { id: 'plan-canva-1y', product_id: 'prod-canva', name: '1 Year Team Invite', duration: 365, duration_unit: 'days', price: 29.99, cost: 12.00, currency: 'USD' }
    ];

    for (const pl of plans) {
      await client.query(
        `INSERT INTO plans (id, product_id, name, duration, duration_unit, price, cost, currency, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active', CURRENT_TIMESTAMP)
         ON CONFLICT (id) DO NOTHING`,
        [pl.id, pl.product_id, pl.name, pl.duration, pl.duration_unit, pl.price, pl.cost, pl.currency]
      );
    }

    // 4. Sample Service Account & Profiles
    const enc = encryptCredential('SampleSecretPassword123!');
    const sampleAccountId = 'acc-sample-netflix-01';
    await client.query(
      `INSERT INTO service_accounts (id, product_id, provider, login, encrypted_credential, iv, tag, status, capacity, notes, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', 5, 'Sample shared testing account', CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO NOTHING`,
      [sampleAccountId, 'prod-netflix', 'Netflix', 'netflix.reseller.demo@example.com', enc.encrypted, enc.iv, enc.tag]
    );

    for (let i = 1; i <= 5; i++) {
      await client.query(
        `INSERT INTO service_profiles (id, service_account_id, profile_name, pin, status, created_at)
         VALUES ($1, $2, $3, $4, 'available', CURRENT_TIMESTAMP)
         ON CONFLICT (id) DO NOTHING`,
        [`prof-demo-${i}`, sampleAccountId, `Profile ${i}`, `120${i}`]
      );
    }

    // 5. Sample License Keys
    for (let i = 1; i <= 5; i++) {
      const keyStr = `GPT4-${crypto.randomBytes(4).toString('hex').toUpperCase()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
      await client.query(
        `INSERT INTO license_keys (id, product_id, license_key, status, notes, created_at)
         VALUES ($1, $2, $3, 'available', 'Dev seed key', CURRENT_TIMESTAMP)
         ON CONFLICT (id) DO NOTHING`,
        [`lic-demo-${i}`, 'prod-chatgpt', keyStr]
      );
    }

    // 6. WhatsApp Templates (English, French, Arabic, Russian across all 3 categories)
    const templates = [
      // Order Created / Delivery
      { id: 'tpl-order-en', name: 'Order Delivery (EN)', event: 'order_created', lang: 'en', content: 'Hello {{customer_name}}! Thank you for your order of {{product_name}} ({{plan_name}}). Your access is active until {{end_date}}. Order ID: #{{order_number}}.\n\nAccess Details:\n{{credentials}}\n\nThank you!' },
      { id: 'tpl-order-fr', name: 'Confirmation de Commande (FR)', event: 'order_created', lang: 'fr', content: 'Bonjour {{customer_name}}! Merci pour votre commande de {{product_name}} ({{plan_name}}). Votre accès est actif jusqu au {{end_date}}. Commande #{{order_number}}.\n\nIdentifiants:\n{{credentials}}' },
      { id: 'tpl-order-ar', name: 'تسليم الطلب (AR)', event: 'order_created', lang: 'ar', content: 'مرحباً {{customer_name}}! شكراً لطلبك {{product_name}} ({{plan_name}}). اشتراكك مفعّل حتى {{end_date}}. رقم الطلب: #{{order_number}}.\n\nبيانات الدخول:\n{{credentials}}' },
      { id: 'tpl-order-ru', name: 'Доставка заказа (RU)', event: 'order_created', lang: 'ru', content: 'Здравствуйте, {{customer_name}}! Спасибо за заказ {{product_name}} ({{plan_name}}). Доступ активен до {{end_date}}. Заказ #{{order_number}}.\n\nДанные:\n{{credentials}}' },

      // Order Expiring / Reminder
      { id: 'tpl-expiring-en', name: 'Subscription Expiring (EN)', event: 'order_expiring', lang: 'en', content: 'Dear {{customer_name}}, your subscription for {{product_name}} ({{plan_name}}) will expire in {{days_remaining}} days on {{end_date}}. Order #{{order_number}}. Please reply to renew now and ensure uninterrupted service!' },
      { id: 'tpl-expiring-fr', name: 'Rappel Expiration (FR)', event: 'order_expiring', lang: 'fr', content: 'Bonjour {{customer_name}}, votre abonnement pour {{product_name}} ({{plan_name}}) expire dans {{days_remaining}} jours, le {{end_date}}. Commande #{{order_number}}. Répondez pour renouveler et éviter toute coupure!' },
      { id: 'tpl-expiring-ar', name: 'تذكير بقرب الانتهاء (AR)', event: 'order_expiring', lang: 'ar', content: 'مرحباً {{customer_name}}، نود تذكيرك بأن اشتراكك في {{product_name}} ({{plan_name}}) سينتهي خلال {{days_remaining}} أيام بتاريخ {{end_date}}. رقم الطلب: #{{order_number}}. يرجى الرد لتجديد اشتراكك!' },
      { id: 'tpl-expiring-ru', name: 'Напоминание об истечении (RU)', event: 'order_expiring', lang: 'ru', content: 'Уважаемый(ая) {{customer_name}}, ваша подписка на {{product_name}} ({{plan_name}}) истекает через {{days_remaining}} дн. ({{end_date}}). Заказ #{{order_number}}. Напишите нам для продления!' },

      // Order Expired / Follow-up
      { id: 'tpl-expired-en', name: 'Expired Subscription (EN)', event: 'order_expired', lang: 'en', content: 'Hello {{customer_name}}, your subscription for {{product_name}} ({{plan_name}}) has expired on {{end_date}}. Order #{{order_number}}. Would you like to renew your access today? Reply to this message to reactivate immediately!' },
      { id: 'tpl-expired-fr', name: 'Abonnement Expiré (FR)', event: 'order_expired', lang: 'fr', content: 'Bonjour {{customer_name}}, votre abonnement pour {{product_name}} ({{plan_name}}) est désormais expiré (terminé le {{end_date}}). Commande #{{order_number}}. Souhaitez-vous renouveler votre accès aujourd\'hui ? Répondez pour le réactiver immédiatement!' },
      { id: 'tpl-expired-ar', name: 'انتهاء الاشتراك وتجديده (AR)', event: 'order_expired', lang: 'ar', content: 'مرحباً {{customer_name}}، لقد انتهت صلاحية اشتراكك في {{product_name}} ({{plan_name}}) بتاريخ {{end_date}}. رقم الطلب #{{order_number}}. هل ترغب في تجديد اشتراكك اليوم؟ تواصل معنا للرد وإعادة التفعيل فوراً!' },
      { id: 'tpl-expired-ru', name: 'Истекший доступ (RU)', event: 'order_expired', lang: 'ru', content: 'Здравствуйте, {{customer_name}}! Срок действия вашей подписки на {{product_name}} ({{plan_name}}) по заказу #{{order_number}} истек ({{end_date}}). Хотите продлить доступ прямо сейчас? Ответьте, чтобы возобновить подписку!' }
    ];

    for (const t of templates) {
      await client.query(
        `INSERT INTO notification_templates (id, name, event_type, language, content, created_at)
         VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           event_type = EXCLUDED.event_type,
           language = EXCLUDED.language,
           content = EXCLUDED.content`,
        [t.id, t.name, t.event, t.lang, t.content]
      );
    }

    await client.query('COMMIT');
    console.log('[Seed] Development reference data successfully loaded.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Seed] Failed to seed development data:', err);
    throw err;
  } finally {
    client.release();
  }
}
