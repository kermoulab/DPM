import { query } from '../connection/pool.js';

export interface PairedDeviceRow {
  id: string;
  device_name: string;
  device_type: string;
  device_token_hash: string;
  paired_by_user_id?: string | null;
  pairing_code?: string | null;
  code_expires_at?: string | null;
  status: 'pending' | 'paired' | 'revoked';
  last_seen?: string | null;
  created_at: string;
}

export class DevicesRepository {
  async findAll(): Promise<PairedDeviceRow[]> {
    const res = await query<PairedDeviceRow>(
      'SELECT * FROM paired_devices ORDER BY created_at DESC'
    );
    return res.rows;
  }

  async findById(id: string): Promise<PairedDeviceRow | null> {
    const res = await query<PairedDeviceRow>(
      'SELECT * FROM paired_devices WHERE id = $1',
      [id]
    );
    return res.rows[0] || null;
  }

  async create(device: {
    id: string;
    device_name: string;
    device_token_hash: string;
    paired_by_user_id?: string | null;
    pairing_code: string;
    code_expires_at: string;
  }): Promise<PairedDeviceRow> {
    const res = await query<PairedDeviceRow>(
      `INSERT INTO paired_devices (
         id, device_name, device_type, device_token_hash, paired_by_user_id,
         pairing_code, code_expires_at, status, created_at
       ) VALUES ($1, $2, 'android', $3, $4, $5, $6, 'pending', CURRENT_TIMESTAMP)
       RETURNING *`,
      [
        device.id, device.device_name, device.device_token_hash,
        device.paired_by_user_id || null, device.pairing_code, device.code_expires_at
      ]
    );
    return res.rows[0];
  }

  async confirmPair(id: string, deviceName: string): Promise<PairedDeviceRow | null> {
    const res = await query<PairedDeviceRow>(
      `UPDATE paired_devices
       SET status = 'paired',
           device_name = $1,
           pairing_code = NULL,
           last_seen = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [deviceName, id]
    );
    return res.rows[0] || null;
  }

  async findByPairingCode(code: string): Promise<PairedDeviceRow | null> {
    const res = await query<PairedDeviceRow>(
      `SELECT * FROM paired_devices
       WHERE pairing_code = $1
         AND status = 'pending'
         AND code_expires_at > CURRENT_TIMESTAMP
       ORDER BY created_at DESC
       LIMIT 1`,
      [code]
    );
    return res.rows[0] || null;
  }

  async pairDevice(id: string, deviceName: string, deviceTokenHash: string): Promise<PairedDeviceRow | null> {
    const res = await query<PairedDeviceRow>(
      `UPDATE paired_devices
       SET status = 'paired',
           device_name = $1,
           device_token_hash = $2,
           pairing_code = NULL,
           last_seen = CURRENT_TIMESTAMP
       WHERE id = $3 AND status = 'pending'
       RETURNING *`,
      [deviceName, deviceTokenHash, id]
    );
    return res.rows[0] || null;
  }

  async revoke(id: string): Promise<boolean> {
    const res = await query(
      `UPDATE paired_devices SET status = 'revoked', last_seen = CURRENT_TIMESTAMP WHERE id = $1`,
      [id]
    );
    return (res.rowCount ?? 0) > 0;
  }

  async delete(id: string): Promise<boolean> {
    const res = await query('DELETE FROM paired_devices WHERE id = $1', [id]);
    return (res.rowCount ?? 0) > 0;
  }
}

export const devicesRepo = new DevicesRepository();

