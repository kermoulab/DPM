import { query } from '../connection/pool.js';

export interface SystemSetting {
  key: string;
  value: string;
  updated_at: string;
}

export class SystemSettingsRepository {
  async get(key: string): Promise<string | null> {
    const res = await query<{ value: string }>('SELECT value FROM system_settings WHERE key = $1', [key]);
    return res.rows[0]?.value || null;
  }

  async getAll(): Promise<Record<string, string>> {
    const res = await query<SystemSetting>('SELECT key, value FROM system_settings');
    const settings: Record<string, string> = {};
    for (const row of res.rows) {
      settings[row.key] = row.value;
    }
    return settings;
  }

  async set(key: string, value: string): Promise<void> {
    await query(
      `INSERT INTO system_settings (key, value, updated_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
      [key, value]
    );
  }

  async setMany(settings: Record<string, string>): Promise<void> {
    for (const [key, value] of Object.entries(settings)) {
      await this.set(key, String(value));
    }
  }

  async isInstalled(): Promise<boolean> {
    const val = await this.get('installed');
    return val === 'true';
  }
}

export const systemSettingsRepo = new SystemSettingsRepository();
