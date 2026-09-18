import { query } from '../connection/pool.js';

export interface UserRow {
  id: string;
  username: string;
  email: string;
  name: string;
  password_hash: string;
  password_salt: string;
  role: 'owner' | 'admin' | 'manager' | 'agent' | 'viewer';
  status: 'active' | 'inactive' | 'suspended';
  avatar?: string | null;
  preferred_currency?: string;
  created_at: string;
  last_login?: string | null;
}

export class UsersRepository {
  async findById(id: string): Promise<UserRow | null> {
    const res = await query<UserRow>('SELECT * FROM users WHERE id = $1', [id]);
    return res.rows[0] || null;
  }

  async findByUsernameOrEmail(identifier: string): Promise<UserRow | null> {
    const res = await query<UserRow>(
      'SELECT * FROM users WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($1)',
      [identifier]
    );
    return res.rows[0] || null;
  }

  async findAll(): Promise<UserRow[]> {
    const res = await query<UserRow>(
      'SELECT id, username, email, name, role, status, avatar, preferred_currency, created_at, last_login FROM users ORDER BY created_at ASC'
    );
    return res.rows;
  }

  async create(user: Omit<UserRow, 'created_at' | 'last_login'>): Promise<UserRow> {
    const res = await query<UserRow>(
      `INSERT INTO users (id, username, email, name, password_hash, password_salt, role, status, avatar, preferred_currency, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
       RETURNING *`,
      [
        user.id, user.username, user.email, user.name,
        user.password_hash, user.password_salt, user.role,
        user.status || 'active', user.avatar || null,
        user.preferred_currency || 'USD'
      ]
    );
    return res.rows[0];
  }

  async update(id: string, updates: Partial<UserRow>): Promise<UserRow | null> {
    const ALLOWED_COLUMNS = new Set([
      'username', 'email', 'name', 'password_hash', 'password_salt',
      'role', 'status', 'avatar', 'preferred_currency'
    ]);

    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    for (const [k, v] of Object.entries(updates)) {
      if (v !== undefined && ALLOWED_COLUMNS.has(k)) {
        fields.push(`${k} = $${idx++}`);
        values.push(v);
      }
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    values.push(id);
    const sql = `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`;
    const res = await query<UserRow>(sql, values);
    return res.rows[0] || null;
  }

  async delete(id: string): Promise<boolean> {
    const res = await query('DELETE FROM users WHERE id = $1', [id]);
    return (res.rowCount ?? 0) > 0;
  }

  async updateLastLogin(id: string): Promise<void> {
    await query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [id]);
  }
}

export const usersRepo = new UsersRepository();
