import { query } from '../connection/pool.js';

export interface OrderRow {
  id: string;
  order_number: string;
  customer_id: string;
  customer_name?: string;
  customer_email?: string;
  customer_whatsapp?: string;
  product_id: string;
  product_name?: string;
  plan_id: string;
  plan_name?: string;
  status: string;
  start_date: string;
  end_date: string;
  price: number;
  cost: number;
  currency: string;
  payment_status: string;
  payment_method: string;
  fulfillment_type: string;
  assigned_service_account_id?: string | null;
  assigned_profile_id?: string | null;
  assigned_license_key_id?: string | null;
  assigned_digital_asset_id?: string | null;
  fulfillment_data?: any;
  renewal_count: number;
  whatsapp_contacted_at?: string | null;
  created_by_user_id?: string | null;
  created_at: string;
  license_key?: string | null;
  account_login?: string | null;
  profile_name?: string | null;
  profile_pin?: string | null;
}

export interface OrderRenewalRow {
  id: string;
  order_id: string;
  previous_end_date: string;
  new_end_date: string;
  price: number;
  cost: number;
  currency: string;
  created_by_user_id?: string | null;
  notes?: string | null;
  created_at: string;
}

export class OrdersRepository {
  async findAll(filters?: { status?: string; customer_id?: string; product_id?: string; search?: string }): Promise<OrderRow[]> {
    let sql = `
      SELECT o.*,
             c.name as customer_name, c.email as customer_email, c.whatsapp as customer_whatsapp,
             p.name as product_name,
             pl.name as plan_name,
             lk.license_key as license_key,
             sa.login as account_login,
             sp.profile_name as profile_name, sp.pin as profile_pin
      FROM orders o
      JOIN customers c ON c.id = o.customer_id
      JOIN products p ON p.id = o.product_id
      JOIN plans pl ON pl.id = o.plan_id
      LEFT JOIN license_keys lk ON lk.id = o.assigned_license_key_id
      LEFT JOIN service_accounts sa ON sa.id = o.assigned_service_account_id
      LEFT JOIN service_profiles sp ON sp.id = o.assigned_profile_id
      WHERE 1=1
    `;
    const params: any[] = [];
    let idx = 1;

    if (filters?.customer_id) {
      sql += ` AND o.customer_id = $${idx++}`;
      params.push(filters.customer_id);
    }
    if (filters?.product_id) {
      sql += ` AND o.product_id = $${idx++}`;
      params.push(filters.product_id);
    }
    if (filters?.status && filters.status !== 'all') {
      sql += ` AND o.status = $${idx++}`;
      params.push(filters.status);
    }
    if (filters?.search) {
      sql += ` AND (o.order_number ILIKE $${idx} OR c.name ILIKE $${idx} OR c.email ILIKE $${idx} OR p.name ILIKE $${idx})`;
      params.push(`%${filters.search.trim()}%`);
      idx++;
    }

    sql += ' ORDER BY o.created_at DESC';
    const res = await query<OrderRow>(sql, params);
    return res.rows;
  }

  async findById(id: string): Promise<OrderRow | null> {
    const res = await query<OrderRow>(
      `SELECT o.*,
              c.name as customer_name, c.email as customer_email, c.whatsapp as customer_whatsapp,
              p.name as product_name,
              pl.name as plan_name,
              lk.license_key as license_key,
              sa.login as account_login,
              sp.profile_name as profile_name, sp.pin as profile_pin
       FROM orders o
       JOIN customers c ON c.id = o.customer_id
       JOIN products p ON p.id = o.product_id
       JOIN plans pl ON pl.id = o.plan_id
       LEFT JOIN license_keys lk ON lk.id = o.assigned_license_key_id
       LEFT JOIN service_accounts sa ON sa.id = o.assigned_service_account_id
       LEFT JOIN service_profiles sp ON sp.id = o.assigned_profile_id
       WHERE o.id = $1`,
      [id]
    );
    return res.rows[0] || null;
  }

  async findRenewals(orderId: string): Promise<OrderRenewalRow[]> {
    const res = await query<OrderRenewalRow>(
      'SELECT * FROM order_renewals WHERE order_id = $1 ORDER BY created_at DESC',
      [orderId]
    );
    return res.rows;
  }

  async create(order: Omit<OrderRow, 'created_at' | 'renewal_count'>): Promise<OrderRow> {
    const res = await query<OrderRow>(
      `INSERT INTO orders (
         id, order_number, customer_id, product_id, plan_id, status,
         start_date, end_date, price, cost, currency, payment_status,
         payment_method, fulfillment_type, assigned_service_account_id,
         assigned_profile_id, assigned_license_key_id, assigned_digital_asset_id,
         fulfillment_data, renewal_count, created_by_user_id, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, 0, $20, CURRENT_TIMESTAMP)
       RETURNING *`,
      [
        order.id, order.order_number, order.customer_id, order.product_id, order.plan_id,
        order.status || 'active', order.start_date, order.end_date, order.price,
        order.cost || 0, order.currency || 'USD', order.payment_status || 'paid',
        order.payment_method || 'cash', order.fulfillment_type,
        order.assigned_service_account_id || null, order.assigned_profile_id || null,
        order.assigned_license_key_id || null, order.assigned_digital_asset_id || null,
        JSON.stringify(order.fulfillment_data || {}), order.created_by_user_id || null
      ]
    );
    return res.rows[0];
  }

  async update(id: string, updates: Partial<OrderRow>): Promise<OrderRow | null> {
    const res = await query<OrderRow>(
      `UPDATE orders
       SET status = COALESCE($1, status),
           payment_status = COALESCE($2, payment_status),
           payment_method = COALESCE($3, payment_method),
           end_date = COALESCE($4, end_date),
           price = COALESCE($5, price),
           cost = COALESCE($6, cost),
           whatsapp_contacted_at = COALESCE($7, whatsapp_contacted_at)
       WHERE id = $8
       RETURNING *`,
      [
        updates.status ?? null, updates.payment_status ?? null, updates.payment_method ?? null,
        updates.end_date ?? null, updates.price ?? null, updates.cost ?? null,
        updates.whatsapp_contacted_at ?? null, id
      ]
    );
    return res.rows[0] || null;
  }

  async delete(id: string): Promise<boolean> {
    const res = await query('DELETE FROM orders WHERE id = $1', [id]);
    return (res.rowCount ?? 0) > 0;
  }

  async getStatusCounts(): Promise<Record<string, number>> {
    const res = await query<{ status: string; count: string }>(
      'SELECT status, COUNT(*)::int as count FROM orders GROUP BY status'
    );
    const counts: Record<string, number> = {
      all: 0, pending: 0, active: 0, expiring: 0, completed: 0, expired: 0, cancelled: 0
    };
    for (const r of res.rows) {
      const c = parseInt(r.count, 10);
      counts[r.status] = c;
      counts.all += c;
    }
    return counts;
  }
}

export const ordersRepo = new OrdersRepository();
