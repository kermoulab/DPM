import { query } from '../connection/pool.js';

export interface ProductRow {
  id: string;
  category_id: string;
  category_name?: string;
  category_slug?: string;
  name: string;
  slug: string;
  brand?: string | null;
  description?: string | null;
  status: string;
  capabilities: string[];
  fulfillment_type: string;
  custom_fields?: any[];
  icon?: string | null;
  image_url?: string | null;
  stock_limit?: number | null;
  created_at: string;
  plans_count?: number;
  active_orders_count?: number;
  available_inventory?: number;
  in_stock?: boolean;
}

export class ProductsRepository {
  async findAll(filters?: { category_id?: string; search?: string; status?: string }): Promise<ProductRow[]> {
    let sql = `
      SELECT p.*, c.name as category_name, c.slug as category_slug,
             COUNT(DISTINCT pl.id)::int as plans_count
      FROM products p
      JOIN categories c ON c.id = p.category_id
      LEFT JOIN plans pl ON pl.product_id = p.id AND pl.status = 'active'
      WHERE 1=1
    `;
    const params: any[] = [];
    let idx = 1;

    if (filters?.category_id) {
      sql += ` AND p.category_id = $${idx++}`;
      params.push(filters.category_id);
    }

    if (filters?.status) {
      sql += ` AND p.status = $${idx++}`;
      params.push(filters.status);
    }

    if (filters?.search) {
      sql += ` AND (p.name ILIKE $${idx} OR p.brand ILIKE $${idx} OR p.description ILIKE $${idx})`;
      params.push(`%${filters.search.trim()}%`);
      idx++;
    }

    sql += ' GROUP BY p.id, c.id ORDER BY p.name ASC';
    const res = await query<ProductRow>(sql, params);
    return res.rows;
  }

  async findById(id: string): Promise<ProductRow | null> {
    const res = await query<ProductRow>(
      `SELECT p.*, c.name as category_name, c.slug as category_slug
       FROM products p
       JOIN categories c ON c.id = p.category_id
       WHERE p.id = $1`,
      [id]
    );
    return res.rows[0] || null;
  }

  async create(prod: Omit<ProductRow, 'created_at'>): Promise<ProductRow> {
    const res = await query<ProductRow>(
      `INSERT INTO products (
         id, category_id, name, slug, brand, description, status,
         capabilities, fulfillment_type, custom_fields, icon, image_url, stock_limit, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CURRENT_TIMESTAMP)
       RETURNING *`,
      [
        prod.id, prod.category_id, prod.name, prod.slug,
        prod.brand || null, prod.description || null, prod.status || 'active',
        JSON.stringify(prod.capabilities || ['subscription']),
        prod.fulfillment_type || 'automatic',
        JSON.stringify(prod.custom_fields || []),
        prod.icon || 'Box', prod.image_url || null,
        prod.stock_limit !== undefined ? prod.stock_limit : null
      ]
    );
    return res.rows[0];
  }

  async update(id: string, updates: Partial<ProductRow>): Promise<ProductRow | null> {
    const res = await query<ProductRow>(
      `UPDATE products
       SET category_id = COALESCE($1, category_id),
           name = COALESCE($2, name),
           slug = COALESCE($3, slug),
           brand = COALESCE($4, brand),
           description = COALESCE($5, description),
           status = COALESCE($6, status),
           capabilities = CASE WHEN $7::jsonb IS NOT NULL THEN $7::jsonb ELSE capabilities END,
           fulfillment_type = COALESCE($8, fulfillment_type),
           custom_fields = CASE WHEN $9::jsonb IS NOT NULL THEN $9::jsonb ELSE custom_fields END,
           icon = COALESCE($10, icon),
           image_url = COALESCE($11, image_url),
           stock_limit = $12
       WHERE id = $13
       RETURNING *`,
      [
        updates.category_id ?? null,
        updates.name ?? null,
        updates.slug ?? null,
        updates.brand ?? null,
        updates.description ?? null,
        updates.status ?? null,
        updates.capabilities ? JSON.stringify(updates.capabilities) : null,
        updates.fulfillment_type ?? null,
        updates.custom_fields ? JSON.stringify(updates.custom_fields) : null,
        updates.icon ?? null,
        updates.image_url ?? null,
        updates.stock_limit !== undefined ? updates.stock_limit : null,
        id
      ]
    );
    return res.rows[0] || null;
  }

  async delete(id: string): Promise<boolean> {
    const res = await query('DELETE FROM products WHERE id = $1', [id]);
    return (res.rowCount ?? 0) > 0;
  }

  async getInventoryCounts(productId: string, fulfillmentType: string): Promise<{ available: number; total: number }> {
    if (fulfillmentType === 'service_account') {
      const availRes = await query<{ count: string }>(
        `SELECT COUNT(*)::int as count FROM service_profiles sp
         JOIN service_accounts sa ON sa.id = sp.service_account_id
         WHERE sa.product_id = $1 AND sa.status = 'active' AND sp.status = 'available'`,
        [productId]
      );
      const totalRes = await query<{ count: string }>(
        `SELECT COUNT(*)::int as count FROM service_profiles sp
         JOIN service_accounts sa ON sa.id = sp.service_account_id
         WHERE sa.product_id = $1`,
        [productId]
      );
      return { available: parseInt(availRes.rows[0]?.count || '0', 10), total: parseInt(totalRes.rows[0]?.count || '0', 10) };
    }

    if (fulfillmentType === 'license_key') {
      const availRes = await query<{ count: string }>(
        "SELECT COUNT(*)::int as count FROM license_keys WHERE product_id = $1 AND status = 'available'",
        [productId]
      );
      const totalRes = await query<{ count: string }>(
        'SELECT COUNT(*)::int as count FROM license_keys WHERE product_id = $1',
        [productId]
      );
      return { available: parseInt(availRes.rows[0]?.count || '0', 10), total: parseInt(totalRes.rows[0]?.count || '0', 10) };
    }

    return { available: 999, total: 999 };
  }
}

export const productsRepo = new ProductsRepository();
