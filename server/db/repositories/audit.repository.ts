import crypto from 'crypto';
import { query } from '../connection/pool.js';

export interface AuditLogRow {
  id: string;
  user_id?: string | null;
  username?: string | null;
  action: string;
  entity: string;
  entity_id?: string | null;
  details?: any;
  ip?: string | null;
  created_at: string;
}

export class AuditRepository {
  async log(
    user: { id?: string; username?: string } | null,
    action: string,
    entity: string,
    entityId: string | null,
    details: Record<string, any>,
    ip: string = '127.0.0.1'
  ): Promise<void> {
    try {
      const id = crypto.randomUUID();
      const safeDetails = { ...details };

      // Redact sensitive secrets from details before logging
      for (const key of Object.keys(safeDetails)) {
        if (/password|secret|credential|token|key/i.test(key) && typeof safeDetails[key] === 'string') {
          safeDetails[key] = '***REDACTED***';
        }
      }

      await query(
        `INSERT INTO audit_logs (id, user_id, username, action, entity, entity_id, details, ip, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)`,
        [
          id,
          user?.id || 'system',
          user?.username || 'system',
          action,
          entity,
          entityId || null,
          JSON.stringify(safeDetails),
          ip
        ]
      );
    } catch (err) {
      console.error('[Audit] Failed to record audit log:', err);
    }
  }

  async findLogs(filters?: { entity?: string; action?: string; limit?: number }): Promise<AuditLogRow[]> {
    let sql = 'SELECT * FROM audit_logs WHERE 1=1';
    const params: any[] = [];
    let idx = 1;

    if (filters?.entity) {
      sql += ` AND entity = $${idx++}`;
      params.push(filters.entity);
    }
    if (filters?.action) {
      sql += ` AND action = $${idx++}`;
      params.push(filters.action);
    }

    sql += ` ORDER BY created_at DESC LIMIT $${idx}`;
    params.push(filters?.limit || 100);

    const res = await query<AuditLogRow>(sql, params);
    return res.rows;
  }
}

export const auditRepo = new AuditRepository();
