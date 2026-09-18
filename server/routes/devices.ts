import { Router } from 'express';
import crypto from 'crypto';
import QRCode from 'qrcode';
import { db, logAudit } from '../db.js';
import { requireAuth, requireRole, type AuthenticatedRequest } from '../security.js';

export const devicesRouter = Router();

// List paired devices
devicesRouter.get('/', requireAuth, (req, res) => {
  const devices = db.prepare(`
    SELECT 
      d.id, d.device_name, d.device_type, d.status, d.last_seen, d.created_at, d.pairing_code,
      u.name as paired_by_user
    FROM paired_devices d
    JOIN users u ON u.id = d.paired_by_user_id
    WHERE d.status != 'revoked'
    ORDER BY d.created_at DESC
  `).all();

  res.json({ devices });
});

// Generate pairing code & QR code
devicesRouter.post('/generate-pairing-code', requireAuth, requireRole('manager'), async (req: AuthenticatedRequest, res) => {
  try {
    const pairingCode = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 10 * 60000).toISOString(); // 10 minutes
    const id = 'dev-' + crypto.randomUUID().slice(0, 8);

    const tokenHash = crypto.createHash('sha256').update(pairingCode + Date.now()).digest('hex');

    db.prepare(`
      INSERT INTO paired_devices (id, device_name, device_type, device_token_hash, paired_by_user_id, pairing_code, code_expires_at, status, created_at)
      VALUES (?, 'Android Reseller Terminal', 'android', ?, ?, ?, ?, 'pending', ?)
    `).run(id, tokenHash, req.user!.id, pairingCode, expiresAt, new Date().toISOString());

    // Payload for QR code
    const qrPayload = JSON.stringify({
      erp_endpoint: '/api/devices/pair',
      code: pairingCode,
      device_id: id,
      expires_at: expiresAt
    });

    const qrDataUrl = await QRCode.toDataURL(qrPayload, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 280,
      color: {
        dark: '#1e293b',
        light: '#ffffff'
      }
    });

    logAudit(req.user || null, 'GENERATE_DEVICE_PAIRING_CODE', 'device', id, { expiresAt });

    res.json({
      success: true,
      deviceId: id,
      pairingCode,
      expiresAt,
      qrDataUrl
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to generate pairing QR: ' + err.message });
  }
});

// Android device QR handshake endpoint (called by Android app after scan)
devicesRouter.post('/pair', (req, res) => {
  const { device_id, code, device_name, device_model } = req.body;
  if (!device_id || !code) {
    return res.status(400).json({ error: 'Device ID and pairing code are required.' });
  }

  const device = db.prepare('SELECT * FROM paired_devices WHERE id = ?').get(device_id) as any;
  if (!device) {
    return res.status(404).json({ error: 'Pairing session not found or has been deleted.' });
  }

  if (device.pairing_code !== String(code).trim()) {
    return res.status(400).json({ error: 'Invalid 6-digit pairing code.' });
  }

  if (device.code_expires_at && new Date(device.code_expires_at).getTime() < Date.now()) {
    return res.status(400).json({ error: 'Pairing code expired. Please request a new code.' });
  }

  const connectedName = device_model || device_name || 'Android Handheld Terminal';
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE paired_devices
    SET status = 'paired',
        device_name = ?,
        pairing_code = NULL,
        last_seen = ?
    WHERE id = ?
  `).run(connectedName, now, device_id);

  res.json({
    success: true,
    message: 'Pairing successful! Terminal connected to ERP store.',
    device: {
      id: device_id,
      name: connectedName,
      status: 'paired',
      lastSeen: now
    }
  });
});

// Endpoint for Android app to verify pairing status (and automatically unpair when deleted)
devicesRouter.get('/status/:id', (req, res) => {
  const { id } = req.params;
  const device = db.prepare('SELECT id, device_name, status, last_seen FROM paired_devices WHERE id = ?').get(id) as any;

  if (!device || device.status !== 'paired') {
    return res.status(200).json({
      paired: false,
      unpaired: true,
      status: 'unpaired',
      message: 'This device is no longer paired with the ERP store. Session terminated on server.'
    });
  }

  const now = new Date().toISOString();
  db.prepare('UPDATE paired_devices SET last_seen = ? WHERE id = ?').run(now, id);

  res.json({
    paired: true,
    unpaired: false,
    status: 'paired',
    device_name: device.device_name,
    last_seen: now
  });
});

// Confirm pairing from web UI (or simulation)
devicesRouter.post('/confirm-pair', requireAuth, requireRole('manager'), (req: AuthenticatedRequest, res) => {
  const { device_id, device_name = 'Android Reseller Terminal' } = req.body;

  const device = db.prepare('SELECT id, status FROM paired_devices WHERE id = ?').get(device_id) as any;
  if (!device) {
    return res.status(404).json({ error: 'Device pairing request not found.' });
  }

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE paired_devices
    SET status = 'paired',
        device_name = ?,
        pairing_code = NULL,
        last_seen = ?
    WHERE id = ?
  `).run(device_name, now, device_id);

  logAudit(req.user || null, 'DEVICE_PAIRED', 'device', device_id, { device_name });

  res.json({
    success: true,
    message: 'Device successfully paired and authorized.',
    device: {
      id: device_id,
      name: device_name,
      status: 'paired',
      lastSeen: now
    }
  });
});

// Delete / Unpair device from database and unpair on Android side
devicesRouter.delete('/:id', requireAuth, requireRole('manager'), (req: AuthenticatedRequest, res) => {
  const { id } = req.params;

  const existing = db.prepare('SELECT id, device_name, status FROM paired_devices WHERE id = ?').get(id) as any;
  db.prepare('DELETE FROM paired_devices WHERE id = ?').run(id);

  logAudit(req.user || null, 'DELETE_DEVICE', 'device', id, {
    device_name: existing?.device_name,
    was_status: existing?.status
  });

  res.json({
    success: true,
    message: existing?.status === 'paired'
      ? `Device "${existing.device_name}" deleted and unpaired on Android side.`
      : 'Pending pairing request deleted from database.',
    unpaired: existing?.status === 'paired'
  });
});
