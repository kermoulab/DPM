import { query } from '../connection/pool.js';

export interface NotificationTemplateRow {
  id: string;
  name: string;
  event_type: string;
  language: string;
  content: string;
  created_at: string;
  updated_at?: string;
}

export class WhatsAppRepository {
  async findAllTemplates(): Promise<NotificationTemplateRow[]> {
    const res = await query<NotificationTemplateRow>(
      'SELECT * FROM notification_templates ORDER BY event_type ASC, language ASC'
    );
    return res.rows;
  }

  async findTemplateById(id: string): Promise<NotificationTemplateRow | null> {
    const res = await query<NotificationTemplateRow>(
      'SELECT * FROM notification_templates WHERE id = $1',
      [id]
    );
    return res.rows[0] || null;
  }

  async findTemplate(eventType: string, language: string): Promise<NotificationTemplateRow | null> {
    const res = await query<NotificationTemplateRow>(
      'SELECT * FROM notification_templates WHERE event_type = $1 AND language = $2',
      [eventType, language]
    );
    return res.rows[0] || null;
  }

  async upsertTemplate(t: {
    id: string;
    name: string;
    event_type: string;
    language: string;
    content: string;
  }): Promise<NotificationTemplateRow> {
    const res = await query<NotificationTemplateRow>(
      `INSERT INTO notification_templates (id, name, event_type, language, content, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         event_type = EXCLUDED.event_type,
         language = EXCLUDED.language,
         content = EXCLUDED.content,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [t.id, t.name, t.event_type, t.language, t.content]
    );
    return res.rows[0];
  }

  async deleteTemplate(id: string): Promise<boolean> {
    const res = await query('DELETE FROM notification_templates WHERE id = $1', [id]);
    return (res.rowCount ?? 0) > 0;
  }
}

export const whatsappRepo = new WhatsAppRepository();
