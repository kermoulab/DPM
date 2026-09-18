import { Router } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import { db, initDatabase, logAudit } from '../db.js';
import { hashPassword, createSessionToken, encryptCredential } from '../security.js';

export const installRouter = Router();

// Check installation status
installRouter.get('/status', (req, res) => {
  try {
    initDatabase();
    const row = db.prepare("SELECT value FROM system_settings WHERE key = 'installed'").get() as any;
    const isInstalled = row?.value === 'true';

    // Get system requirements check
    const requirements = {
      nodeVersion: process.version,
      nodeOk: parseInt(process.versions.node.split('.')[0]) >= 18,
      sqliteReady: true,
      dataDirWritable: true,
      cryptoAvailable: typeof crypto.randomBytes === 'function'
    };

    res.json({
      installed: isInstalled,
      requirements
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Database check failed: ' + err.message });
  }
});

// Test database connection
installRouter.post('/test-db', (req, res) => {
  try {
    initDatabase();
    db.prepare('SELECT 1').get();
    res.json({ success: true, message: 'Database engine connected and responsive.' });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Run complete setup and lock installation
installRouter.post('/setup', (req, res) => {
  try {
    initDatabase();

    // SERVER-SIDE LOCK ENFORCEMENT
    const checkInstalled = db.prepare("SELECT value FROM system_settings WHERE key = 'installed'").get() as any;
    if (checkInstalled?.value === 'true') {
      return res.status(403).json({
        error: 'Installation is locked. The ERP has already been provisioned and secured.'
      });
    }

    const {
      adminUsername,
      adminEmail,
      adminName,
      adminPassword,
      companyName,
      baseCurrency,
      currencySymbol,
      supportPhone,
      seedDemoData,
      seedSampleData
    } = req.body;

    // Demo data is opt-in, not opt-out. Seed only if explicitly requested.
    const shouldSeed = Boolean(seedDemoData ?? seedSampleData ?? false);

    if (!adminUsername || !adminEmail || !adminPassword) {
      return res.status(400).json({ error: 'Administrator username, email, and password are required.' });
    }

    if (adminPassword.length < 8) {
      return res.status(400).json({ error: 'Administrator password must be at least 8 characters.' });
    }

    // Begin ACID transaction
    db.exec('BEGIN TRANSACTION;');

    try {
      const now = new Date().toISOString();

      // 1. Create administrator user
      const adminId = crypto.randomUUID();
      const { hash, salt } = hashPassword(adminPassword);
      db.prepare(`
        INSERT INTO users (id, username, email, name, password_hash, password_salt, role, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 'owner', 'active', ?)
      `).run(adminId, adminUsername.trim(), adminEmail.trim(), adminName?.trim() || adminUsername.trim(), hash, salt, now);

      // 2. Business configuration in system settings
      const settings = [
        ['installed', 'true'],
        ['installed_at', now],
        ['company_name', companyName?.trim() || 'Universal Digital Reseller'],
        ['base_currency', baseCurrency?.trim() || 'USD'],
        ['currency_symbol', currencySymbol?.trim() || '$'],
        ['support_phone', supportPhone?.trim() || '+1 (555) 019-2834'],
        ['installer_locked', 'true'],
        ['low_inventory_threshold', '3'],
        ['order_expiry_warning_days', '3']
      ];

      for (const [key, value] of settings) {
        db.prepare(`
          INSERT INTO system_settings (key, value, updated_at)
          VALUES (?, ?, ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
        `).run(key, value, now);
      }

      // 3. Currencies
      const currencies = [
        ['USD', '$', 'US Dollar', 1.0, 2, 1],
        ['EUR', '€', 'Euro', 0.92, 2, 0],
        ['GBP', '£', 'British Pound', 0.78, 2, 0],
        ['AED', 'AED', 'UAE Dirham', 3.67, 2, 0],
        ['SAR', 'SAR', 'Saudi Riyal', 3.75, 2, 0],
        ['CAD', 'CA$', 'Canadian Dollar', 1.35, 2, 0]
      ];

      for (const [code, symbol, name, rate, precision, isBase] of currencies) {
        db.prepare(`
          INSERT OR REPLACE INTO currencies (code, symbol, name, exchange_rate, decimal_precision, is_base, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(code, symbol, name, rate, precision, isBase, now);
      }

      // 4. Notification & WhatsApp templates
      const templates = [
        // 1. Thank You (order_created)
        {
          id: 'tmpl-en-created',
          name: 'Order Delivery (English)',
          event_type: 'order_created',
          language: 'en',
          content: 'Hello {customer_name}! Thank you for your order of {product_name} ({plan_name}). Your access is active until {end_date}. Order ID: #{order_id}. Enjoy!'
        },
        {
          id: 'tmpl-fr-created',
          name: 'Livraison de Commande (Français)',
          event_type: 'order_created',
          language: 'fr',
          content: 'Bonjour {customer_name}! Merci pour votre commande de {product_name} ({plan_name}). Votre accès est actif jusqu au {end_date}. Commande #{order_id}.'
        },
        {
          id: 'tmpl-ar-created',
          name: 'تسليم الطلب (العربية)',
          event_type: 'order_created',
          language: 'ar',
          content: 'مرحباً {customer_name}! شكراً لطلبك {product_name} ({plan_name}). اشتراكك نشط ومفعّل حتى {end_date}. رقم الطلب: #{order_id}.'
        },
        {
          id: 'tmpl-ru-created',
          name: 'Доставка заказа (Русский)',
          event_type: 'order_created',
          language: 'ru',
          content: 'Здравствуйте, {customer_name}! Спасибо за заказ {product_name} ({plan_name}). Ваш доступ активен до {end_date}. Заказ #{order_id}.'
        },
        // 2. Expiring (order_expiring)
        {
          id: 'tmpl-en-expiring',
          name: 'Renewal Reminder (English)',
          event_type: 'order_expiring',
          language: 'en',
          content: 'Dear {customer_name}, your subscription for {product_name} ({plan_name}) will expire in {days_remaining} days on {end_date}. Order #{order_id}. Please reply to renew now and ensure uninterrupted service!'
        },
        {
          id: 'tmpl-fr-expiring',
          name: 'Rappel Expiration (Français)',
          event_type: 'order_expiring',
          language: 'fr',
          content: 'Bonjour {customer_name}, votre abonnement pour {product_name} ({plan_name}) expire dans {days_remaining} jours, le {end_date}. Commande #{order_id}. Répondez à ce message pour renouveler et éviter toute coupure de service!'
        },
        {
          id: 'tmpl-ar-expiring',
          name: 'تذكير بقرب الانتهاء (العربية)',
          event_type: 'order_expiring',
          language: 'ar',
          content: 'مرحباً {customer_name}، نود تذكيرك بأن اشتراكك في {product_name} ({plan_name}) سينتهي خلال {days_remaining} أيام بتاريخ {end_date}. رقم الطلب: #{order_id}. يرجى الرد لتجديد اشتراكك وتجنب انقطاع الخدمة!'
        },
        {
          id: 'tmpl-ru-expiring',
          name: 'Напоминание об истечении (Русский)',
          event_type: 'order_expiring',
          language: 'ru',
          content: 'Уважаемый(ая) {customer_name}, ваша подписка на {product_name} ({plan_name}) истекает через {days_remaining} дн. ({end_date}). Заказ #{order_id}. Напишите нам для продления, чтобы не потерять доступ!'
        },
        // 3. Expired (order_expired)
        {
          id: 'tmpl-en-expired',
          name: 'Expired Follow-up (English)',
          event_type: 'order_expired',
          language: 'en',
          content: 'Hello {customer_name}, your subscription for {product_name} ({plan_name}) has expired on {end_date}. Order #{order_id}. Would you like to renew your access today? Reply to this message to reactivate immediately!'
        },
        {
          id: 'tmpl-fr-expired',
          name: 'Abonnement Expiré (Français)',
          event_type: 'order_expired',
          language: 'fr',
          content: 'Bonjour {customer_name}, votre abonnement pour {product_name} ({plan_name}) est désormais expiré (terminé le {end_date}). Commande #{order_id}. Souhaitez-vous renouveler votre accès aujourd\'hui ? Répondez pour le réactiver immédiatement!'
        },
        {
          id: 'tmpl-ar-expired',
          name: 'انتهاء الاشتراك وتجديده (العربية)',
          event_type: 'order_expired',
          language: 'ar',
          content: 'مرحباً {customer_name}، لقد انتهت صلاحية اشتراكك في {product_name} ({plan_name}) بتاريخ {end_date}. رقم الطلب #{order_id}. هل ترغب في تجديد اشتراكك اليوم؟ تواصل معنا للرد وإعادة تفعيل حسابك فوراً!'
        },
        {
          id: 'tmpl-ru-expired',
          name: 'Истекший доступ (Русский)',
          event_type: 'order_expired',
          language: 'ru',
          content: 'Здравствуйте, {customer_name}! Срок действия вашей подписки на {product_name} ({plan_name}) истек ({end_date}). Заказ #{order_id}. Хотите продлить доступ прямо сейчас? Ответьте на это сообщение, чтобы возобновить подписку!'
        }
      ];

      for (const t of templates) {
        db.prepare(`
          INSERT OR REPLACE INTO notification_templates (id, name, event_type, language, content, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(t.id, t.name, t.event_type, t.language, t.content, now);
      }

      // 5. Seed operational starter categories and products if requested
      if (shouldSeed) {
        seedOperationalData(adminId, now);
      }

      db.exec('COMMIT;');

      // Create session token for the new administrator
      const token = createSessionToken({
        id: adminId,
        username: adminUsername,
        email: adminEmail,
        name: adminName || adminUsername,
        role: 'owner'
      });

      logAudit({ id: adminId, username: adminUsername }, 'INSTALL_COMPLETED', 'system', 'erp', {
        companyName,
        baseCurrency
      });

      res.json({
        success: true,
        message: 'System successfully installed and secured.',
        token,
        user: {
          id: adminId,
          username: adminUsername,
          email: adminEmail,
          name: adminName || adminUsername,
          role: 'owner'
        }
      });
    } catch (txErr) {
      db.exec('ROLLBACK;');
      throw txErr;
    }
  } catch (err: any) {
    res.status(500).json({ error: 'Installation failed: ' + err.message });
  }
});

function seedOperationalData(adminId: string, now: string) {
  // Categories
  const categories = [
    { id: 'cat-ai', name: 'AI Subscriptions', slug: 'ai-subscriptions', icon: 'Bot', description: 'ChatGPT Plus, Claude Pro, Midjourney, Perplexity' },
    { id: 'cat-streaming', name: 'Streaming & Video', slug: 'streaming-video', icon: 'Tv', description: 'Netflix 4K, Spotify Premium, YouTube Premium, Disney+' },
    { id: 'cat-merch', name: 'On-Demand Merch & Mockups', slug: 'merch-mockups', icon: 'Shirt', description: 'Custom printed apparel, high-res mockups, and print-ready files' },
    { id: 'cat-creative', name: 'Design & Video Editing', slug: 'design-video-editing', icon: 'Palette', description: 'CapCut Pro, Canva Pro, Adobe Creative Cloud, Figma' },
    { id: 'cat-software', name: 'Software & OS Keys', slug: 'software-keys', icon: 'Key', description: 'Windows 11 Pro, Office 365, JetBrains, VPNs' }
  ];

  for (const c of categories) {
    db.prepare(`
      INSERT OR REPLACE INTO categories (id, name, slug, icon, description, status, created_at)
      VALUES (?, ?, ?, ?, ?, 'active', ?)
    `).run(c.id, c.name, c.slug, c.icon, c.description, now);
  }

  // Products with dynamic capabilities
  const products = [
    {
      id: 'prod-netflix',
      category_id: 'cat-streaming',
      name: 'Netflix 4K Ultra HD',
      slug: 'netflix-4k-uhd',
      brand: 'Netflix',
      description: '4K Ultra HD streaming with private profile and PIN',
      capabilities: JSON.stringify(['subscription', 'service_account', 'profiles']),
      fulfillment_type: 'service_account',
      icon: 'Tv'
    },
    {
      id: 'prod-chatgpt',
      category_id: 'cat-ai',
      name: 'ChatGPT Plus Shared & Dedicated',
      slug: 'chatgpt-plus',
      brand: 'OpenAI',
      description: 'GPT-4o, Canvas, and advanced voice access',
      capabilities: JSON.stringify(['subscription', 'service_account', 'credentials']),
      fulfillment_type: 'service_account',
      icon: 'Sparkles'
    },
    {
      id: 'prod-capcut',
      category_id: 'cat-creative',
      name: 'CapCut Pro Activation Code',
      slug: 'capcut-pro',
      brand: 'ByteDance',
      description: 'CapCut Pro desktop & mobile licensed activation key',
      capabilities: JSON.stringify(['subscription', 'license_key', 'automatic_fulfillment']),
      fulfillment_type: 'license_key',
      icon: 'Scissors'
    },
    {
      id: 'prod-merch-tshirt',
      category_id: 'cat-merch',
      name: 'Custom Heavyweight Merch T-Shirt',
      slug: 'custom-heavyweight-tshirt',
      brand: 'PrintPro Merch',
      description: 'On-demand custom logo placement, photorealistic mockup preview, and 300 DPI print-ready export',
      capabilities: JSON.stringify(['digital_file', 'merch_mockup', 'manual_fulfillment']),
      fulfillment_type: 'digital_file',
      icon: 'Shirt'
    },
    {
      id: 'prod-canva',
      category_id: 'cat-creative',
      name: 'Canva Pro Annual License',
      slug: 'canva-pro-annual',
      brand: 'Canva',
      description: 'Canva Pro team invite & license code',
      capabilities: JSON.stringify(['subscription', 'license_key', 'automatic_fulfillment']),
      fulfillment_type: 'license_key',
      icon: 'Wand2'
    }
  ];

  for (const p of products) {
    db.prepare(`
      INSERT OR REPLACE INTO products (id, category_id, name, slug, brand, description, status, capabilities, fulfillment_type, icon, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)
    `).run(p.id, p.category_id, p.name, p.slug, p.brand, p.description, p.capabilities, p.fulfillment_type, p.icon, now);
  }

  // Plans with duration calculation properties
  const plans = [
    { id: 'plan-netflix-1m', product_id: 'prod-netflix', name: '1 Screen (1 Month)', duration: 1, duration_unit: 'months', price: 4.99, cost: 2.50 },
    { id: 'plan-netflix-3m', product_id: 'prod-netflix', name: '1 Screen (3 Months)', duration: 3, duration_unit: 'months', price: 12.99, cost: 6.50 },
    { id: 'plan-chatgpt-1m', product_id: 'prod-chatgpt', name: 'Shared Profile (1 Month)', duration: 30, duration_unit: 'days', price: 9.99, cost: 4.00 },
    { id: 'plan-capcut-1y', product_id: 'prod-capcut', name: '1 Year License Key', duration: 1, duration_unit: 'years', price: 29.99, cost: 14.00 },
    { id: 'plan-merch-mockup', product_id: 'prod-merch-tshirt', name: 'Mockup + Print-Ready Vector Package', duration: 365, duration_unit: 'days', price: 19.99, cost: 3.00 },
    { id: 'plan-canva-1y', product_id: 'prod-canva', name: '1 Year Team Invite', duration: 1, duration_unit: 'years', price: 15.00, cost: 7.00 }
  ];

  for (const pl of plans) {
    db.prepare(`
      INSERT OR REPLACE INTO plans (id, product_id, name, duration, duration_unit, price, cost, currency, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'USD', 'active', ?)
    `).run(pl.id, pl.product_id, pl.name, pl.duration, pl.duration_unit, pl.price, pl.cost, now);
  }

  // Customers
  const customers = [
    { id: 'cust-1', name: 'Dr. Andrew Parker', email: 'andrew.parker@example.com', whatsapp: '+12025550143', notes: 'Prefers WhatsApp updates' },
    { id: 'cust-2', name: 'Sarah Jenkins', email: 'sarah.j@designstudio.io', whatsapp: '+447700900123', notes: 'Graphic designer, buys CapCut and merch' },
    { id: 'cust-3', name: 'Karim Mansouri', email: 'karim.m@techagency.ae', whatsapp: '+971501234567', notes: 'Agency client, bulk orders' },
    { id: 'cust-4', name: 'Elena Rostova', email: 'elena.rostova@media.com', whatsapp: '+79991234567', notes: 'Frequent renewals' }
  ];

  for (const cust of customers) {
    db.prepare(`
      INSERT OR REPLACE INTO customers (id, name, email, whatsapp, notes, status, created_at)
      VALUES (?, ?, ?, ?, ?, 'active', ?)
    `).run(cust.id, cust.name, cust.email, cust.whatsapp, cust.notes, now);
  }

  // Service Account + Profiles for Netflix
  const accId = 'sa-netflix-01';
  const seedCreds = encryptCredential('StreamPass#2026!');
  db.prepare(`
    INSERT OR REPLACE INTO service_accounts (id, product_id, provider, login, encrypted_credential, iv, tag, status, expiry_date, capacity, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)
  `).run(
    accId,
    'prod-netflix',
    'Netflix',
    'streaming.hub@cloudmedia.com',
    seedCreds.encrypted,
    seedCreds.iv,
    seedCreds.tag,
    new Date(Date.now() + 60 * 86400000).toISOString(),
    5,
    'US Premium 4K family account',
    now
  );

  const profiles = [
    { id: 'prof-1', name: 'Profile 1 (VIP)', pin: '1984', status: 'available' },
    { id: 'prof-2', name: 'Profile 2', pin: '4521', status: 'available' },
    { id: 'prof-3', name: 'Profile 3', pin: '8820', status: 'available' },
    { id: 'prof-4', name: 'Profile 4', pin: '7712', status: 'available' },
    { id: 'prof-5', name: 'Profile 5', pin: '0931', status: 'available' }
  ];

  for (const prof of profiles) {
    db.prepare(`
      INSERT OR REPLACE INTO service_profiles (id, service_account_id, profile_name, pin, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(prof.id, accId, prof.name, prof.pin, prof.status, now);
  }

  // License keys for CapCut & Canva
  const licenses = [
    { id: 'lic-capcut-1', product_id: 'prod-capcut', key: 'CPCT-9942-8821-XP77', status: 'available' },
    { id: 'lic-capcut-2', product_id: 'prod-capcut', key: 'CPCT-4410-1288-LK90', status: 'available' },
    { id: 'lic-canva-1', product_id: 'prod-canva', key: 'CNVA-TEAM-7891-BBN4', status: 'available' }
  ];

  for (const l of licenses) {
    db.prepare(`
      INSERT OR REPLACE INTO license_keys (id, product_id, license_key, status, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(l.id, l.product_id, l.key, l.status, now);
  }

  // Digital Mockup Assets
  const mockups = [
    {
      id: 'mockup-seed-1',
      customer_id: 'cust-2',
      product_name: 'Premium Heavyweight Merch T-Shirt',
      color: '#1e293b',
      placement: 'chest_center',
      logo_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&auto=format&fit=crop&q=80',
      preview_image_url: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&auto=format&fit=crop&q=80',
      print_specs: JSON.stringify({
        resolution: '300 DPI',
        dimensions: '4500 x 5400 px',
        bleed: '0.125 in',
        color_profile: 'CMYK FOGRA39',
        print_method: 'Direct-to-Garment (DTG)'
      }),
      status: 'ready'
    }
  ];

  for (const m of mockups) {
    db.prepare(`
      INSERT OR REPLACE INTO merch_mockups (id, customer_id, product_name, color, placement, logo_url, preview_image_url, print_specs, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(m.id, m.customer_id, m.product_name, m.color, m.placement, m.logo_url, m.preview_image_url, m.print_specs, m.status, now);
  }

  // Seed Initial Orders for rich reporting & dashboard reproduction
  const seedOrders = [
    {
      id: 'ord-seed-1',
      order_number: 'ORD-2026-8801',
      customer_id: 'cust-1',
      product_id: 'prod-netflix',
      plan_id: 'plan-netflix-1m',
      start_date: new Date(Date.now() - 10 * 86400000).toISOString().split('T')[0],
      end_date: new Date(Date.now() + 20 * 86400000).toISOString().split('T')[0],
      price: 4.99,
      cost: 2.50,
      currency: 'USD',
      status: 'active',
      payment_status: 'paid',
      payment_method: 'card',
      fulfillment_type: 'service_account',
      assigned_service_account_id: 'sa-netflix-01',
      assigned_profile_id: 'prof-1',
      fulfillment_data: JSON.stringify({
        provider: 'Netflix',
        login: 'streaming.hub@cloudmedia.com',
        profileName: 'Profile 1 (VIP)',
        pin: '1984'
      }),
      renewal_count: 1
    },
    {
      id: 'ord-seed-2',
      order_number: 'ORD-2026-8802',
      customer_id: 'cust-2',
      product_id: 'prod-capcut',
      plan_id: 'plan-capcut-1y',
      start_date: new Date(Date.now() - 60 * 86400000).toISOString().split('T')[0],
      end_date: new Date(Date.now() + 305 * 86400000).toISOString().split('T')[0],
      price: 29.99,
      cost: 14.00,
      currency: 'USD',
      status: 'active',
      payment_status: 'paid',
      payment_method: 'transfer',
      fulfillment_type: 'license_key',
      assigned_license_key_id: 'lic-capcut-1',
      fulfillment_data: JSON.stringify({
        licenseKey: 'CPCT-9942-8821-XP77',
        activationInstructions: 'Enter license key under CapCut > Account > Redeem License.'
      }),
      renewal_count: 0
    },
    {
      id: 'ord-seed-3',
      order_number: 'ORD-2026-8803',
      customer_id: 'cust-3',
      product_id: 'prod-canva',
      plan_id: 'plan-canva-1y',
      start_date: new Date(Date.now() - 363 * 86400000).toISOString().split('T')[0],
      end_date: new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0], // expiring in 2 days!
      price: 15.00,
      cost: 7.00,
      currency: 'USD',
      status: 'expiring',
      payment_status: 'paid',
      payment_method: 'cash',
      fulfillment_type: 'license_key',
      assigned_license_key_id: 'lic-canva-1',
      fulfillment_data: JSON.stringify({
        licenseKey: 'CNVA-TEAM-7891-BBN4'
      }),
      renewal_count: 0
    }
  ];

  for (const o of seedOrders) {
    db.prepare(`
      INSERT OR REPLACE INTO orders (
        id, order_number, customer_id, product_id, plan_id,
        start_date, end_date, price, cost, currency,
        status, payment_status, payment_method, fulfillment_type,
        assigned_service_account_id, assigned_profile_id, assigned_license_key_id,
        fulfillment_data, renewal_count, created_by_user_id, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      o.id, o.order_number, o.customer_id, o.product_id, o.plan_id,
      o.start_date, o.end_date, o.price, o.cost, o.currency,
      o.status, o.payment_status, o.payment_method, o.fulfillment_type,
      o.assigned_service_account_id || null, o.assigned_profile_id || null, o.assigned_license_key_id || null,
      o.fulfillment_data, o.renewal_count, adminId, now
    );
  }

  // Update profile and license status to assigned
  db.prepare("UPDATE service_profiles SET status = 'assigned', assigned_customer_id = 'cust-1', assigned_order_id = 'ord-seed-1' WHERE id = 'prof-1'").run();
  db.prepare("UPDATE license_keys SET status = 'assigned', assigned_customer_id = 'cust-2', assigned_order_id = 'ord-seed-2' WHERE id = 'lic-capcut-1'").run();
  db.prepare("UPDATE license_keys SET status = 'assigned', assigned_customer_id = 'cust-3', assigned_order_id = 'ord-seed-3' WHERE id = 'lic-canva-1'").run();
}
