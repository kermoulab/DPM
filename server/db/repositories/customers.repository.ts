import { query } from '../connection/pool.js';

export interface CustomerRow {
  id: string;
  name: string;
  email?: string | null;
  whatsapp?: string | null;
  notes?: string | null;
  status: string;
  created_at: string;
  total_orders?: number;
  total_spent?: number;
}

export class CustomersRepository {
  async findAll(filters?: { search?: string; status?: string }): Promise<CustomerRow[]> {
    let sql = `
      SELECT c.*,
             COUNT(o.id)::int as total_orders,
             COALESCE(SUM(o.price), 0)::float as total_spent
      FROM customers c
      LEFT JOIN orders o ON o.customer_id = c.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let idx = 1;

    if (filters?.status) {
      sql += ` AND c.status = $${idx++}`;
      params.push(filters.status);
    }

    if (filters?.search) {
      sql += ` AND (c.name ILIKE $${idx} OR c.email ILIKE $${idx} OR c.whatsapp ILIKE $${idx})`;
      params.push(`%${filters.search.trim()}%`);
      idx++;
    }

    sql += ' GROUP BY c.id ORDER BY c.created_at DESC';
    const res = await query<CustomerRow>(sql, params);
    return res.rows;
  }

  async findById(id: string): Promise<CustomerRow | null> {
    const res = await query<CustomerRow>(
      `SELECT c.*,
              COUNT(o.id)::int as total_orders,
              COALESCE(SUM(o.price), 0)::float as total_spent
       FROM customers c
       LEFT JOIN orders o ON o.customer_id = c.id
       WHERE c.id = $1
       GROUP BY c.id`,
      [id]
    );
    return res.rows[0] || null;
  }

  async create(customer: { id: string; name: string; email?: string; whatsapp?: string; notes?: string }): Promise<CustomerRow> {
    const res = await query<CustomerRow>(
      `INSERT INTO customers (id, name, email, whatsapp, notes, status, created_at)
       VALUES ($1, $2, $3, $4, $5, 'active', CURRENT_TIMESTAMP)
       RETURNING *`,
      [
        customer.id, customer.name.trim(), customer.email?.trim() || null,
        customer.whatsapp?.trim() || null, customer.notes?.trim() || null
      ]
    );
    return res.rows[0];
  }

  async update(id: string, updates: Partial<CustomerRow>): Promise<CustomerRow | null> {
    const res = await query<CustomerRow>(
      `UPDATE customers
       SET name = COALESCE($1, name),
           email = COALESCE($2, email),
           whatsapp = COALESCE($3, whatsapp),
           notes = COALESCE($4, notes),
           status = COALESCE($5, status)
       WHERE id = $6
       RETURNING *`,
      [
        updates.name ?? null,
        updates.email !== undefined ? updates.email?.trim() || null : null,
        updates.whatsapp !== undefined ? updates.whatsapp?.trim() || null : null,
        updates.notes !== undefined ? updates.notes?.trim() || null : null,
        updates.status ?? null,
        id
      ]
    );
    return res.rows[0] || null;
  }

  async delete(id: string): Promise<boolean> {
    const res = await query('DELETE FROM customers WHERE id = $1', [id]);
    return (res.rowCount ?? 0) > 0;
  }
}

export const customersRepo = new CustomersRepository();
