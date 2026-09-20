import { Router } from 'express';
import { whatsappRepo } from '../db/repositories/whatsapp.repository.js';
import { ordersRepo } from '../db/repositories/orders.repository.js';
import { customersRepo } from '../db/repositories/customers.repository.js';
import { inventoryRepo } from '../db/repositories/inventory.repository.js';
import { auditRepo } from '../db/repositories/audit.repository.js';
import { decryptCredential } from '../utils/crypto.js';
import { requireAuth, requireRole, type AuthenticatedRequest } from '../middleware/auth.middleware.js';

export const whatsappRouter = Router();

// GET /api/whatsapp/templates
whatsappRouter.get('/templates', requireAuth, async (req, res, next) => {
  try {
    const templates = await whatsappRepo.findAllTemplates();
    res.json({ templates });
  } catch (err) {
    next(err);
  }
});

// POST /api/whatsapp/templates
whatsappRouter.post('/templates', requireAuth, requireRole('manager'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { id, name, event_type, language, content } = req.body;
    if (!content || !language) {
      res.status(400).json({ error: 'Language and content are required.' });
      return;
    }

    const category = event_type || 'order_created';
    const templateId = id || `tmpl-${language}-${category}`;
    const templateName = (name && name.trim()) || `${category} (${language.toUpperCase()})`;

    const saved = await whatsappRepo.upsertTemplate({
      id: templateId,
      name: templateName,
      event_type: category,
      language,
      content: content.trim()
    });

    await auditRepo.log(req.user || null, 'UPDATE_WHATSAPP_TEMPLATE', 'template', templateId, { name: templateName, language });
    res.json({ success: true, id: templateId, template: saved });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/whatsapp/templates/:id
whatsappRouter.delete('/templates/:id', requireAuth, requireRole('manager'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { id } = req.params;
    await whatsappRepo.deleteTemplate(id);
    await auditRepo.log(req.user || null, 'DELETE_WHATSAPP_TEMPLATE', 'template', id, {});
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/whatsapp/compose
whatsappRouter.post('/compose', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const { order_id, template_id, language = 'en', event_type = 'order_created', phone, save_phone } = req.body;
    const order = await ordersRepo.findById(order_id);
    if (!order) {
      res.status(404).json({ error: 'Order not found.' });
      return;
    }

    const lang = (language || 'en').toLowerCase();

    // Extract fulfillment credentials (license key or service account login, plain password, profile number/name, pin)
    const fulfillment = typeof order.fulfillment_data === 'object' && order.fulfillment_data !== null
      ? (order.fulfillment_data as Record<string, any>)
      : {};

    let login = fulfillment.login || order.account_login || '';
    let password = fulfillment.password || '';
    let profileName = fulfillment.profile_name || order.profile_name || '';
    let profilePin = fulfillment.pin || order.profile_pin || '';
    let licenseKey = fulfillment.license_key || order.license_key || '';

    // If password is not stored in plaintext inside fulfillment_data, decrypt from service_accounts
    if (!password && order.assigned_service_account_id) {
      try {
        const acc = await inventoryRepo.findAccountById(order.assigned_service_account_id);
        if (acc && acc.encrypted_credential && acc.iv && acc.tag) {
          password = decryptCredential(acc.encrypted_credential, acc.iv, acc.tag);
          if (!login) login = acc.login;
        }
      } catch (e) {
        console.error('Failed to decrypt service account credential for WhatsApp compose:', e);
      }
    }

    // Format credentials block cleanly
    let credentialsBlock = '';
    if (licenseKey) {
      if (lang === 'fr') {
        credentialsBlock = `🔑 Clé de licence: ${licenseKey}`;
      } else if (lang === 'ar') {
        credentialsBlock = `🔑 مفتاح الترخيص: ${licenseKey}`;
      } else if (lang === 'ru') {
        credentialsBlock = `🔑 Лицензионный ключ: ${licenseKey}`;
      } else {
        credentialsBlock = `🔑 License Key: ${licenseKey}`;
      }
    } else if (login || password) {
      const parts: string[] = [];
      if (lang === 'fr') {
        if (login) parts.push(`📧 Identifiant: ${login}`);
        if (password) parts.push(`🔑 Mot de passe: ${password}`);
        if (profileName) parts.push(`👤 Profil: ${profileName}`);
        if (profilePin) parts.push(`🔒 Code PIN: ${profilePin}`);
      } else if (lang === 'ar') {
        if (login) parts.push(`📧 البريد / الحساب: ${login}`);
        if (password) parts.push(`🔑 كلمة المرور: ${password}`);
        if (profileName) parts.push(`👤 الملف الشخصي: ${profileName}`);
        if (profilePin) parts.push(`🔒 رمز PIN: ${profilePin}`);
      } else if (lang === 'ru') {
        if (login) parts.push(`📧 Логин / Email: ${login}`);
        if (password) parts.push(`🔑 Пароль: ${password}`);
        if (profileName) parts.push(`👤 Профиль: ${profileName}`);
        if (profilePin) parts.push(`🔒 PIN-код: ${profilePin}`);
      } else {
        if (login) parts.push(`📧 Email/Login: ${login}`);
        if (password) parts.push(`🔑 Password: ${password}`);
        if (profileName) parts.push(`👤 Profile: ${profileName}`);
        if (profilePin) parts.push(`🔒 PIN: ${profilePin}`);
      }
      credentialsBlock = parts.join('\n');
    }

    // Normalize event category
    let category: 'order_created' | 'order_expiring' | 'order_expired' = 'order_created';
    const ev = (event_type || '').toLowerCase();
    if (ev === 'order_expiring' || ev === 'subscription_expiring' || (ev.includes('expir') && !ev.includes('expired'))) {
      category = 'order_expiring';
    } else if (ev === 'order_expired' || ev === 'subscription_expired' || ev.includes('expired')) {
      category = 'order_expired';
    } else {
      category = 'order_created';
    }

    // Find template if available
    let template = template_id ? await whatsappRepo.findTemplateById(template_id) : null;
    if (!template) {
      template = await whatsappRepo.findTemplate(category, lang);
    }
    // Check legacy aliases
    if (!template) {
      if (category === 'order_expiring') {
        template = await whatsappRepo.findTemplate('subscription_expiring', lang);
      } else if (category === 'order_expired') {
        template = await whatsappRepo.findTemplate('subscription_expired', lang);
      } else if (category === 'order_created') {
        template = await whatsappRepo.findTemplate('order_confirmation', lang);
      }
    }
    // Check fallback to English in database
    if (!template && lang !== 'en') {
      template = await whatsappRepo.findTemplate(category, 'en');
      if (!template) {
        if (category === 'order_expiring') {
          template = await whatsappRepo.findTemplate('subscription_expiring', 'en');
        } else if (category === 'order_expired') {
          template = await whatsappRepo.findTemplate('subscription_expired', 'en');
        } else if (category === 'order_created') {
          template = await whatsappRepo.findTemplate('order_confirmation', 'en');
        }
      }
    }

    let rawPhone = phone || order.customer_whatsapp || '';
    if (save_phone && phone && phone !== order.customer_whatsapp) {
      await customersRepo.update(order.customer_id, { whatsapp: phone });
    }

    const cleanPhone = rawPhone.replace(/[^\d+]/g, '').replace(/^00/, '+');
    const endDateStr = order.end_date ? String(order.end_date).split('T')[0].split(' ')[0] : '';
    const startDateStr = order.start_date ? String(order.start_date).split('T')[0].split(' ')[0] : '';

    // Calculate real remaining / expired days
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const [ey, em, ed] = (endDateStr || '').split('-').map(Number);
    let diffDays = 0;
    if (ey && em && ed) {
      const targetDate = new Date(Date.UTC(ey, em - 1, ed));
      diffDays = Math.round((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    }
    const daysRemaining = diffDays >= 0 ? String(diffDays) : '0';
    const daysExpired = diffDays < 0 ? String(Math.abs(diffDays)) : '0';

    // Standard message templates for all 3 categories across supported languages
    const defaultTemplates: Record<'order_created' | 'order_expiring' | 'order_expired', Record<string, string>> = {
      order_created: {
        en: `Thank you {customer_name} for your purchase!\nYour order #{order_number} for {product_name} ({plan_name}) is active until {end_date}.\n\nAccess Details:\n{credentials}\n\nThank you for choosing us! If you have any questions, feel free to reach out.`,
        fr: `Merci {customer_name} pour votre achat!\nVotre commande #{order_number} pour {product_name} ({plan_name}) est active jusqu'au {end_date}.\n\nDétails d'accès:\n{credentials}\n\nMerci pour votre confiance! N'hésitez pas à nous contacter si besoin.`,
        ar: `شكراً لك {customer_name} على طلبك!\nطلبك رقم #{order_number} لخدمة {product_name} ({plan_name}) مفعّل حتى تاريخ {end_date}.\n\nبيانات الدخول:\n{credentials}\n\nشكراً لاختيارك لنا! لأي استفسار لا تتردد في التواصل معنا.`,
        ru: `Спасибо за ваш заказ, {customer_name}!\nВаш заказ #{order_number} на {product_name} ({plan_name}) активен до {end_date}.\n\nДанные для доступа:\n{credentials}\n\nСпасибо, что выбрали нас!`
      },
      order_expiring: {
        en: `Dear {customer_name}, your subscription for {product_name} ({plan_name}) under order #{order_number} will expire on {end_date} (in {days_remaining} days).\n\nPlease contact us to renew your subscription and ensure uninterrupted service!\n\nThank you for choosing us.`,
        fr: `Bonjour {customer_name}, votre abonnement pour {product_name} ({plan_name}) (commande #{order_number}) arrive à expiration le {end_date} (dans {days_remaining} jours).\n\nContactez-nous dès maintenant pour renouveler votre abonnement et éviter toute interruption de service!\n\nMerci pour votre confiance.`,
        ar: `مرحباً {customer_name}، نود تذكيرك بأن اشتراكك في {product_name} ({plan_name}) للطلب رقم #{order_number} سينتهي بتاريخ {end_date} (متبقي {days_remaining} أيام).\n\nيرجى التواصل معنا لتجديد اشتراكك واستمرار الخدمة دون أي انقطاع!\n\nشكراً لاختيارك لنا.`,
        ru: `Здравствуйте, {customer_name}! Срок действия вашей подписки на {product_name} ({plan_name}) по заказу #{order_number} истекает {end_date} (осталось {days_remaining} дн.).\n\nПожалуйста, свяжитесь с нами для продления подписки, чтобы сохранить доступ!`
      },
      order_expired: {
        en: `Hello {customer_name}, your subscription for {product_name} ({plan_name}) under order #{order_number} expired on {end_date}.\n\nYour service is currently suspended. If you would like to reactivate or renew your account, please reply to this message!\n\nWe would love to welcome you back!`,
        fr: `Bonjour {customer_name}, votre abonnement pour {product_name} ({plan_name}) (commande #{order_number}) a expiré le {end_date}.\n\nVotre service est actuellement suspendu. Souhaitez-vous réactiver ou renouveler votre compte ? Répondez pour le réactiver immédiatement!\n\nAu plaisir de vous retrouver!`,
        ar: `مرحباً {customer_name}، نحيطك علماً بأن اشتراكك في {product_name} ({plan_name}) للطلب رقم #{order_number} قد انتهى بتاريخ {end_date}.\n\nتم تعليق الخدمة حالياً. هل ترغب في تجديد وإعادة تفعيل حسابك؟ تواصل معنا للرد وإعادة التفعيل فوراً!\n\nيسعدنا تجديد اشتراكك في أي وقت!`,
        ru: `Здравствуйте, {customer_name}! Срок действия вашей подписки на {product_name} ({plan_name}) по заказу #{order_number} истек ({end_date}).\n\nДоступ приостановлен. Хотите продлить доступ прямо сейчас? Ответьте на это сообщение, чтобы возобновить подписку!`
      }
    };

    const categoryTemplates = defaultTemplates[category] || defaultTemplates['order_created'];
    let messageText = template?.content || categoryTemplates[lang] || categoryTemplates['en'];

    // Replace all placeholders (supports both {tag} and {{tag}})
    const replacements: Record<string, string> = {
      customer_name: order.customer_name || 'Valued Customer',
      order_id: order.order_number,
      order_number: order.order_number,
      product_name: order.product_name || 'Product',
      plan_name: order.plan_name || 'Plan',
      start_date: startDateStr,
      end_date: endDateStr,
      days_remaining: daysRemaining,
      days_expired: daysExpired,
      credentials: credentialsBlock || (lang === 'fr' ? 'Détails en cours de livraison.' : (lang === 'ar' ? 'سيتم تسليم البيانات قريباً.' : 'Will be delivered shortly.')),
      license_key: licenseKey || '',
      login: login || '',
      email: login || '',
      password: password || '',
      profile_name: profileName || '',
      profile: profileName || '',
      pin: profilePin || ''
    };

    for (const [key, val] of Object.entries(replacements)) {
      const regexDouble = new RegExp(`\\{\\{${key}\\}\\}`, 'gi');
      const regexSingle = new RegExp(`\\{${key}\\}`, 'gi');
      messageText = messageText.replace(regexDouble, val).replace(regexSingle, val);
    }

    // In order_created, if template didn't contain credentials placeholder, append them cleanly
    const hadCredTag = /\{{1,2}(credentials|password|license_key|login)\}{1,2}/i.test(template?.content || '');
    if (category === 'order_created' && credentialsBlock && !hadCredTag) {
      const detailsHeader = lang === 'fr' ? "Détails d'accès:" : (lang === 'ar' ? 'بيانات الدخول:' : (lang === 'ru' ? 'Данные для доступа:' : 'Access Details:'));
      messageText = `${messageText.trim()}\n\n${detailsHeader}\n${credentialsBlock}`;
    }

    // Mark order as contacted in PostgreSQL
    await ordersRepo.update(order_id, { whatsapp_contacted_at: new Date().toISOString() });

    const encoded = encodeURIComponent(messageText);
    const waUrl = cleanPhone ? `https://wa.me/${cleanPhone.replace('+', '')}?text=${encoded}` : null;

    res.json({
      phone: rawPhone,
      cleanPhone,
      message: messageText,
      waUrl
    });
  } catch (err) {
    next(err);
  }
});
