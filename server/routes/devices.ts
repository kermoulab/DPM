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

    await devicesRepo.create({
      id: deviceId,
      device_name: 'Android Terminal (Pending)',
      device_token_hash: deviceTokenHash,
      paired_by_user_id: req.user?.id || null,
      pairing_code: pairingCode,
      code_expires_at: expiresAt
    });

    const qrPayload = JSON.stringify({
      version: '1.0',
      action: 'pair_device',
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
    await devicesRepo.delete(id);
    await auditRepo.log(req.user || null, 'DELETE_DEVICE', 'device', id, { device_name: existing?.device_name });

    res.json({
      success: true,
      message: existing?.status === 'paired' ? `Device "${existing.device_name}" deleted.` : 'Pending pairing request deleted.',
      unpaired: existing?.status === 'paired'
    });
  } catch (err) {
    next(err);
  }
});
