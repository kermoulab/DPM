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

export interface FindLogsOptions {
  entity?: string;
  action?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedAuditLogs {
  logs: AuditLogRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class AuditRepository {
  /**
   * Automatically purges audit logs older than retentionDays (default 30 days max).
   */
  async purgeOldLogs(retentionDays: number = 30): Promise<number> {
    try {
      const res = await query(
        `DELETE FROM audit_logs
         WHERE created_at < CURRENT_TIMESTAMP - ($1 || ' days')::interval`,
        [retentionDays]
      );
      return res.rowCount || 0;
    } catch (err) {
      console.error('[Audit] Failed to purge old logs:', err);
      return 0;
    }
  }

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

  async findLogs(filters?: FindLogsOptions): Promise<PaginatedAuditLogs> {
    // Enforce 30-day retention: auto-delete stale logs before fetching
    await this.purgeOldLogs(30);

    const rawLimit = filters?.limit ?? 30;
    const limit = Math.max(1, Math.min(rawLimit, 30)); // Capped at 30 events max per page
    const page = Math.max(1, filters?.page ?? 1);
    const offset = (page - 1) * limit;

    let whereClause = " WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'";
    const params: any[] = [];
    let idx = 1;

    if (filters?.entity) {
      whereClause += ` AND entity = $${idx++}`;
      params.push(filters.entity);
    }
    if (filters?.action) {
      whereClause += ` AND action = $${idx++}`;
      params.push(filters.action);
    }

    const countSql = `SELECT COUNT(*)::int AS total FROM audit_logs${whereClause}`;
    const countRes = await query<{ total: number }>(countSql, params);
    const total = countRes.rows[0]?.total || 0;

    const dataSql = `SELECT * FROM audit_logs${whereClause} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx}`;
    const dataParams = [...params, limit, offset];
    const dataRes = await query<AuditLogRow>(dataSql, dataParams);

    const totalPages = Math.max(1, Math.ceil(total / limit));

    return {
      logs: dataRes.rows,
      total,
      page,
      limit,
      totalPages
    };
  }
}

export const auditRepo = new AuditRepository();
