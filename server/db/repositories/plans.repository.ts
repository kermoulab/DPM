import { query } from '../connection/pool.js';

export interface PlanRow {
  id: string;
  product_id: string;
  product_name?: string;
  product_brand?: string;
  category_id?: string;
  name: string;
  duration: number;
  duration_unit: 'hours' | 'days' | 'weeks' | 'months' | 'years';
  price: number;
  cost: number;
  currency: string;
  status: string;
  stock_limit?: number | null;
  created_at: string;
}

export class PlansRepository {
  async findByProductId(productId: string): Promise<PlanRow[]> {
    const res = await query<PlanRow>(
      `SELECT pl.*, p.name as product_name, p.brand as product_brand, p.category_id
       FROM plans pl
       JOIN products p ON p.id = pl.product_id
       WHERE pl.product_id = $1
       ORDER BY pl.price ASC`,
      [productId]
    );
    return res.rows;
  }

  async findAll(productId?: string): Promise<PlanRow[]> {
    let sql = `
      SELECT pl.*, p.name as product_name, p.brand as product_brand, p.category_id
      FROM plans pl
      JOIN products p ON p.id = pl.product_id
    `;
    const params: any[] = [];
    if (productId) {
      sql += ' WHERE pl.product_id = $1';
      params.push(productId);
    }
    sql += ' ORDER BY p.name ASC, pl.price ASC';
    const res = await query<PlanRow>(sql, params);
    return res.rows;
  }

  async findById(id: string): Promise<PlanRow | null> {
    const res = await query<PlanRow>(
      `SELECT pl.*, p.name as product_name, p.brand as product_brand, p.category_id
       FROM plans pl
       JOIN products p ON p.id = pl.product_id
       WHERE pl.id = $1`,
      [id]
    );
    return res.rows[0] || null;
  }

  async create(plan: Omit<PlanRow, 'created_at'>): Promise<PlanRow> {
    const res = await query<PlanRow>(
      `INSERT INTO plans (
         id, product_id, name, duration, duration_unit, price, cost, currency, status, stock_limit, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
       RETURNING *`,
      [
        plan.id, plan.product_id, plan.name, plan.duration, plan.duration_unit,
        plan.price, plan.cost || 0, plan.currency || 'USD', plan.status || 'active',
        plan.stock_limit !== undefined ? plan.stock_limit : null
      ]
    );
    return res.rows[0];
  }

  async update(id: string, updates: Partial<PlanRow>): Promise<PlanRow | null> {
    const res = await query<PlanRow>(
      `UPDATE plans
       SET name = COALESCE($1, name),
           duration = COALESCE($2, duration),
           duration_unit = COALESCE($3, duration_unit),
           price = COALESCE($4, price),
           cost = COALESCE($5, cost),
           currency = COALESCE($6, currency),
           status = COALESCE($7, status),
           stock_limit = $8
       WHERE id = $9
       RETURNING *`,
      [
        updates.name ?? null,
        updates.duration ?? null,
        updates.duration_unit ?? null,
        updates.price ?? null,
        updates.cost ?? null,
        updates.currency ?? null,
        updates.status ?? null,
        updates.stock_limit !== undefined ? updates.stock_limit : null,
        id
      ]
    );
    return res.rows[0] || null;
  }

  async delete(id: string): Promise<boolean> {
    const res = await query('DELETE FROM plans WHERE id = $1', [id]);
    return (res.rowCount ?? 0) > 0;
  }
}

export const plansRepo = new PlansRepository();
