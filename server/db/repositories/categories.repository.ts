import { query } from '../connection/pool.js';

export interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  icon?: string | null;
  description?: string | null;
  status: string;
  created_at: string;
  product_count?: number;
}

export class CategoriesRepository {
  async findAll(): Promise<CategoryRow[]> {
    const res = await query<CategoryRow>(`
      SELECT c.*, COUNT(p.id)::int as product_count
      FROM categories c
      LEFT JOIN products p ON p.category_id = c.id
      GROUP BY c.id
      ORDER BY c.name ASC
    `);
    return res.rows;
  }

  async findById(id: string): Promise<CategoryRow | null> {
    const res = await query<CategoryRow>('SELECT * FROM categories WHERE id = $1', [id]);
    return res.rows[0] || null;
  }

  async findBySlug(slug: string): Promise<CategoryRow | null> {
    const res = await query<CategoryRow>('SELECT * FROM categories WHERE slug = $1', [slug]);
    return res.rows[0] || null;
  }

  async create(cat: { id: string; name: string; slug: string; icon?: string; description?: string }): Promise<CategoryRow> {
    const res = await query<CategoryRow>(
      `INSERT INTO categories (id, name, slug, icon, description, status, created_at)
       VALUES ($1, $2, $3, $4, $5, 'active', CURRENT_TIMESTAMP)
       RETURNING *`,
      [cat.id, cat.name, cat.slug, cat.icon || 'Folder', cat.description || null]
    );
    return res.rows[0];
  }

  async update(id: string, updates: { name?: string; icon?: string; description?: string; status?: string }): Promise<CategoryRow | null> {
    const res = await query<CategoryRow>(
      `UPDATE categories
       SET name = COALESCE($1, name),
           icon = COALESCE($2, icon),
           description = COALESCE($3, description),
           status = COALESCE($4, status)
       WHERE id = $5
       RETURNING *`,
      [updates.name ?? null, updates.icon ?? null, updates.description ?? null, updates.status ?? null, id]
    );
    return res.rows[0] || null;
  }

  async delete(id: string): Promise<boolean> {
    const res = await query('DELETE FROM categories WHERE id = $1', [id]);
    return (res.rowCount ?? 0) > 0;
  }
}

export const categoriesRepo = new CategoriesRepository();
