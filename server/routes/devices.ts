import { Router } from 'express';
import crypto from 'crypto';
import QRCode from 'qrcode';
import { devicesRepo } from '../db/repositories/devices.repository.js';
import { auditRepo } from '../db/repositories/audit.repository.js';
import { requireAuth, requireRole, type AuthenticatedRequest } from '../middleware/auth.middleware.js';

export const devicesRouter = Router();

// GET /api/devices
devicesRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const devices = await devicesRepo.findAll();
    res.json({ devices });
  } catch (err) {
    next(err);
  }
});

// In-memory rate limiting for pairing attempts (max 5 attempts per 15 mins per IP)
const pairAttempts: Record<string, { count: number; lastAttempt: number }> = {};
const PAIR_MAX_ATTEMPTS = 5;
const PAIR_WINDOW_MS = 15 * 60 * 1000;

// POST /api/devices/pair (Public - used by Android app on first launch)
devicesRouter.post('/pair', async (req, res, next) => {
  const ip = req.ip || '127.0.0.1';
  const now = Date.now();
  const attempt = pairAttempts[ip] || { count: 0, lastAttempt: now };

  if (now - attempt.lastAttempt > PAIR_WINDOW_MS) {
    attempt.count = 0;
  }

  if (attempt.count >= PAIR_MAX_ATTEMPTS && now - attempt.lastAttempt < PAIR_WINDOW_MS) {
    res.status(429).json({ error: 'Too many failed pairing attempts. Please wait 15 minutes.' });
    return;
  }

  try {
    const { code, device_name, device_model } = req.body;
    if (!code || typeof code !== 'string') {
      attempt.count += 1;
      attempt.lastAttempt = now;
      pairAttempts[ip] = attempt;
      res.status(400).json({ error: 'Pairing code is required.' });
      return;
    }

    const cleanCode = code.trim();
    const pendingDevice = await devicesRepo.findByPairingCode(cleanCode);

    if (!pendingDevice) {
      attempt.count += 1;
      attempt.lastAttempt = now;
      pairAttempts[ip] = attempt;
      res.status(400).json({ error: 'Invalid or expired pairing code.' });
      return;
    }

    // Generate cryptographically secure 256-bit device token
    const deviceToken = 'dev_tok_' + crypto.randomBytes(32).toString('hex');
    const deviceTokenHash = crypto.createHash('sha256').update(deviceToken).digest('hex');

    const finalDeviceName = device_name?.trim() || (device_model ? `Android (${device_model})` : 'Android Device');
    const paired = await devicesRepo.pairDevice(pendingDevice.id, finalDeviceName, deviceTokenHash);

    if (!paired) {
      res.status(500).json({ error: 'Failed to complete device registration.' });
      return;
    }

    // Reset rate limiter on successful pair
    delete pairAttempts[ip];

    await auditRepo.log(null, 'DEVICE_PAIRED_MOBILE', 'device', paired.id, {
      device_name: finalDeviceName,
      device_model: device_model || null
    }, ip);

    res.json({
      success: true,
      deviceId: paired.id,
      deviceToken,
      deviceName: paired.device_name,
      message: 'Device successfully paired and authorized.'
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/devices/generate-pairing-code
devicesRouter.post('/generate-pairing-code', requireAuth, requireRole('manager'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const pairingCode = Math.floor(100000 + Math.random() * 900000).toString();
    const deviceId = 'dev-' + crypto.randomUUID().slice(0, 8);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 mins

    const deviceTokenHash = crypto
      .createHash('sha256')
      .update(pairingCode + expiresAt + deviceId)
      .digest('hex');

    // Clean prior uncompleted pending handshake tokens so only one active token exists
    await devicesRepo.cleanPendingCodes();

    await devicesRepo.create({
      id: deviceId,
      device_name: 'Android Terminal (Pending)',
      device_token_hash: deviceTokenHash,
      paired_by_user_id: req.user?.id || null,
      pairing_code: pairingCode,
      code_expires_at: expiresAt
    });

    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.get('host');
    const serverUrl = req.headers.origin || `${protocol}://${host}`;

    const qrPayload = JSON.stringify({
      version: '1.0',
      action: 'pair_device',
      serverUrl,
      deviceId,
      code: pairingCode,
      expiresAt
    });

    const qrDataUrl = await QRCode.toDataURL(qrPayload, {
      width: 280,
      margin: 2,
      color: { dark: '#0284c7', light: '#ffffff' }
    });

    await auditRepo.log(req.user || null, 'GENERATE_PAIRING_CODE', 'device', deviceId, { pairingCode });

    res.json({
      success: true,
      deviceId,
      pairingCode,
      expiresAt,
      qrDataUrl
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/devices/confirm-pair
devicesRouter.post('/confirm-pair', requireAuth, requireRole('manager'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { device_id, device_name = 'Android Reseller Terminal' } = req.body;
    const device = await devicesRepo.findById(device_id);
    if (!device) {
      res.status(404).json({ error: 'Device pairing request not found.' });
      return;
    }

    const updated = await devicesRepo.confirmPair(device_id, device_name);
    await auditRepo.log(req.user || null, 'DEVICE_PAIRED', 'device', device_id, { device_name });

    res.json({
      success: true,
      message: 'Device successfully paired and authorized.',
      device: updated
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/devices/:id
devicesRouter.delete('/:id', requireAuth, requireRole('manager'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { id } = req.params;
    const existing = await devicesRepo.findById(id);
    if (!existing) {
      res.status(404).json({ error: 'Device not found.' });
      return;
    }

    // Revoke device access immediately (or permanently delete pending pairing tokens)
    if (existing.status === 'pending') {
      await devicesRepo.delete(id);
    } else {
      await devicesRepo.revoke(id);
    }
    await auditRepo.log(req.user || null, 'REVOKE_DEVICE', 'device', id, { device_name: existing.device_name });

    res.json({
      success: true,
      message: existing.status === 'paired' ? `Device "${existing.device_name}" revoked.` : 'Pending pairing request deleted.',
      unpaired: true
    });
  } catch (err) {
    next(err);
  }
});

