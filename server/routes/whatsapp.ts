import { Router } from 'express';
import { whatsappRepo } from '../db/repositories/whatsapp.repository.js';
import { ordersRepo } from '../db/repositories/orders.repository.js';
import { customersRepo } from '../db/repositories/customers.repository.js';
import { auditRepo } from '../db/repositories/audit.repository.js';
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

    let template = template_id ? await whatsappRepo.findTemplateById(template_id) : null;
    if (!template) {
      template = await whatsappRepo.findTemplate(event_type, language);
    }
    if (!template) {
      template = await whatsappRepo.findTemplate(event_type, 'en');
    }

    let rawPhone = phone || order.customer_whatsapp || '';
    if (save_phone && phone && phone !== order.customer_whatsapp) {
      await customersRepo.update(order.customer_id, { whatsapp: phone });
    }

    const cleanPhone = rawPhone.replace(/[^\d+]/g, '').replace(/^00/, '+');

    let messageText = template?.content || 'Hello {customer_name}, your order #{order_id} for {product_name} is active until {end_date}.';
    messageText = messageText
      .replace(/{customer_name}/g, order.customer_name || 'Valued Customer')
      .replace(/{order_id}/g, order.order_number)
      .replace(/{product_name}/g, order.product_name || 'Product')
      .replace(/{plan_name}/g, order.plan_name || 'Plan')
      .replace(/{end_date}/g, order.end_date || '')
      .replace(/{days_remaining}/g, '3');

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
