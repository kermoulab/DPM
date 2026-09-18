import { Router } from 'express';
import { db, logAudit } from '../db.js';
import { requireAuth, requireRole, type AuthenticatedRequest } from '../security.js';

export const whatsappRouter = Router();

// List notification/WhatsApp templates
whatsappRouter.get('/templates', requireAuth, (req, res) => {
  const templates = db.prepare('SELECT * FROM notification_templates ORDER BY event_type ASC, language ASC, name ASC').all();
  res.json({ templates });
});

// Update or create template
whatsappRouter.post('/templates', requireAuth, requireRole('manager'), (req: AuthenticatedRequest, res) => {
  const { id, name, event_type, language, content } = req.body;

  if (!content || !language) {
    return res.status(400).json({ error: 'Language and content are required.' });
  }

  const category = event_type || 'order_created';
  const templateId = id || `tmpl-${language}-${category}`;
  const templateName = (name && name.trim()) || `${category} (${language.toUpperCase()})`;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO notification_templates (id, name, event_type, language, content, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET 
      name = excluded.name, 
      content = excluded.content,
      event_type = excluded.event_type,
      language = excluded.language,
      updated_at = excluded.updated_at
  `).run(templateId, templateName, category, language, content.trim(), now, now);

  logAudit(req.user || null, 'UPDATE_WHATSAPP_TEMPLATE', 'template', templateId, { name: templateName, language, event_type: category });
  
  const saved = db.prepare('SELECT * FROM notification_templates WHERE id = ?').get(templateId);
  res.json({ success: true, id: templateId, template: saved });
});

// Delete template
whatsappRouter.delete('/templates/:id', requireAuth, requireRole('manager'), (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  db.prepare('DELETE FROM notification_templates WHERE id = ?').run(id);
  logAudit(req.user || null, 'DELETE_WHATSAPP_TEMPLATE', 'template', id, {});
  res.json({ success: true });
});

// Compose personalized WhatsApp message for a specific order and template
whatsappRouter.post('/compose', requireAuth, (req, res) => {
  const { order_id, template_id, language = 'en', event_type = 'order_created' } = req.body;

  if (!order_id) {
    return res.status(400).json({ error: 'Order ID is required.' });
  }

  const order = db.prepare(`
    SELECT 
      o.*,
      c.name as customer_name,
      c.whatsapp as customer_whatsapp,
      p.name as product_name,
      pl.name as plan_name,
      ROUND((julianday(o.end_date) - julianday('now'))) as days_remaining
    FROM orders o
    JOIN customers c ON c.id = o.customer_id
    JOIN products p ON p.id = o.product_id
    JOIN plans pl ON pl.id = o.plan_id
    WHERE o.id = ?
  `).get(order_id) as any;

  if (!order) {
    return res.status(404).json({ error: 'Order not found.' });
  }

  let template: any = null;
  if (template_id) {
    template = db.prepare('SELECT * FROM notification_templates WHERE id = ?').get(template_id);
  } else {
    template = db.prepare('SELECT * FROM notification_templates WHERE language = ? AND event_type = ? LIMIT 1').get(language, event_type);
  }

  let content = template?.content;
  if (!content) {
    if (event_type === 'order_expiring') {
      content = 'Dear {customer_name}, your subscription for {product_name} ({plan_name}) will expire in {days_remaining} days on {end_date}. Order #{order_id}. Please reply to renew now and ensure uninterrupted service!';
    } else if (event_type === 'order_expired') {
      content = 'Hello {customer_name}, your subscription for {product_name} ({plan_name}) has expired on {end_date}. Order #{order_id}. Would you like to renew your access today? Reply to this message to reactivate immediately!';
    } else {
      content = 'Hello {customer_name}! Thank you for your order of {product_name} ({plan_name}). Your access is active until {end_date}. Order ID: #{order_id}. Enjoy!';
    }
  }

  // Replace variables
  const daysRemaining = Math.max(0, Math.round(order.days_remaining || 0));
  const daysExpired = Math.max(0, Math.round(-1 * (order.days_remaining || 0)));
  content = content
    .replace(/{customer_name}/g, order.customer_name || 'Customer')
    .replace(/{product_name}/g, order.product_name)
    .replace(/{plan_name}/g, order.plan_name)
    .replace(/{start_date}/g, order.start_date)
    .replace(/{end_date}/g, order.end_date)
    .replace(/{price}/g, `${order.currency} ${order.price.toFixed(2)}`)
    .replace(/{order_id}/g, order.order_number)
    .replace(/{days_remaining}/g, String(daysRemaining))
    .replace(/{days_expired}/g, String(daysExpired));

  // Sanitize phone number (remove +, spaces, dashes)
  const overridePhone = req.body.phone && String(req.body.phone).trim();
  const rawPhone = overridePhone || order.customer_whatsapp || '';
  const cleanPhone = rawPhone.replace(/[^0-9]/g, '');

  if (overridePhone && req.body.save_phone && order.customer_id) {
    try {
      db.prepare('UPDATE customers SET whatsapp = ? WHERE id = ?').run(overridePhone, order.customer_id);
    } catch (e) {
      console.error('Failed to save phone to customer:', e);
    }
  }

  const waUrl = cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(content)}` : null;

  let contactedAt: string | null = null;
  if (waUrl && order_id) {
    try {
      contactedAt = new Date().toISOString();
      db.prepare('UPDATE orders SET whatsapp_contacted_at = ? WHERE id = ?').run(contactedAt, order_id);
    } catch (e) {
      console.error('Failed to update whatsapp_contacted_at:', e);
    }
  }

  res.json({
    phone: rawPhone,
    cleanPhone,
    message: content,
    waUrl,
    contacted_at: contactedAt
  });
});

// Explicitly mark an order as contacted via WhatsApp
whatsappRouter.post('/mark-contacted', requireAuth, (req, res) => {
  const { order_id } = req.body;
  if (!order_id) {
    return res.status(400).json({ error: 'Order ID is required.' });
  }
  const now = new Date().toISOString();
  try {
    db.prepare('UPDATE orders SET whatsapp_contacted_at = ? WHERE id = ?').run(now, order_id);
    res.json({ success: true, contacted_at: now });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update contacted status.' });
  }
});

