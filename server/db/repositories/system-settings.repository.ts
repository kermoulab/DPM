import { query } from '../connection/pool.js';

export interface SystemSetting {
  key: string;
  value: string;
  updated_at: string;
}

/**
 * Formal installation state machine.
 *
 * NOT_INSTALLED   — Fresh database, no Vectis schema applied yet
 * INSTALLING      — Database connected and migrations run, admin creation pending
 * INSTALLED       — Full installation complete, system is operational
 * UPGRADE_REQUIRED — Vectis code has new migrations that haven't been applied to this DB
 */
export type InstallState =
  | 'not_installed'
  | 'installing'
  | 'installed'
  | 'upgrade_required';

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

  /**
   * Returns true when Vectis is fully installed and operational.
   * Returns false for any other state (not_installed, installing, upgrade_required).
   */
  async isInstalled(): Promise<boolean> {
    const state = await this.getInstallState();
    return state === 'installed';
  }

  /**
   * Returns the current installation state from system_settings.
   * Handles the case where the table doesn't exist yet (pre-migration).
   * Handles legacy boolean 'installed'='true' rows for backward compatibility.
   */
  async getInstallState(): Promise<InstallState> {
    try {
      // Prefer the new install_state key
      const stateVal = await this.get('install_state');
      if (stateVal === 'installed') return 'installed';
      if (stateVal === 'installing') return 'installing';
      if (stateVal === 'upgrade_required') return 'upgrade_required';
      if (stateVal === 'not_installed') return 'not_installed';

      // Legacy fallback: check old boolean 'installed' key
      const legacyVal = await this.get('installed');
      if (legacyVal === 'true') {
        // Migrate to new state key transparently
        await this.set('install_state', 'installed');
        return 'installed';
      }

      return 'not_installed';
    } catch {
      // Table doesn't exist yet → not installed
      return 'not_installed';
    }
  }

  /**
   * Persist the installation state to system_settings.
   */
  async setInstallState(state: InstallState): Promise<void> {
    await this.set('install_state', state);
    // Keep legacy 'installed' key in sync for backward compatibility
    await this.set('installed', state === 'installed' ? 'true' : 'false');
  }
}

export const systemSettingsRepo = new SystemSettingsRepository();
