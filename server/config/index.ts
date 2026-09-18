import 'dotenv/config';
import crypto from 'crypto';

export interface AppConfig {
  port: number;
  nodeEnv: 'development' | 'production' | 'test';
  isProduction: boolean;
  databaseUrl: string;
  jwtSecret: string;
  encryptionKey: Buffer;
}

const DEV_FALLBACK_JWT_SECRET = 'dev-insecure-jwt-secret-placeholder-minimum-32c';
const DEV_FALLBACK_ENCRYPTION_KEY = 'dev-insecure-encryption-key-placeholder-minimum-32b';

function getValidatedConfig(): AppConfig {
  const nodeEnv = (process.env.NODE_ENV || 'development') as 'development' | 'production' | 'test';
  const isProduction = nodeEnv === 'production';

  // Port
  const rawPort = process.env.PORT || '3000';
  const port = parseInt(rawPort, 10);
  if (isNaN(port) || port < 1 || port > 65535) {
    console.error(`FATAL: Invalid PORT specified: "${rawPort}". Must be an integer between 1 and 65535.`);
    process.exit(1);
  }

  // Database URL
  const databaseUrl = (process.env.DATABASE_URL || '').trim();
  if (isProduction) {
    if (!databaseUrl) {
      console.error('FATAL: DATABASE_URL environment variable is required in production.');
      process.exit(1);
    }
    if (!databaseUrl.startsWith('postgres://') && !databaseUrl.startsWith('postgresql://')) {
      console.error('FATAL: DATABASE_URL must start with "postgresql://" or "postgres://".');
      process.exit(1);
    }
  }

  // JWT Secret
  const rawJwtSecret = process.env.JWT_SECRET ? process.env.JWT_SECRET.trim() : '';
  if (isProduction) {
    if (!rawJwtSecret || rawJwtSecret.length < 32 || rawJwtSecret === DEV_FALLBACK_JWT_SECRET) {
      console.error('FATAL: JWT_SECRET is required in production and must be at least 32 characters long.');
      process.exit(1);
    }
  }
  const jwtSecret = rawJwtSecret || DEV_FALLBACK_JWT_SECRET;

  // Encryption Key (AES-256-GCM requires 32 bytes)
  const rawEncKey = process.env.ENCRYPTION_KEY ? process.env.ENCRYPTION_KEY.trim() : '';
  if (isProduction) {
    if (!rawEncKey || rawEncKey.length < 32 || rawEncKey === DEV_FALLBACK_ENCRYPTION_KEY) {
      console.error('FATAL: ENCRYPTION_KEY is required in production and must be at least 32 characters long.');
      process.exit(1);
    }
  }
  const encKeyString = rawEncKey || DEV_FALLBACK_ENCRYPTION_KEY;

  let encryptionKey: Buffer;
  if (/^[0-9a-fA-F]{64}$/.test(encKeyString)) {
    encryptionKey = Buffer.from(encKeyString, 'hex');
  } else {
    encryptionKey = crypto.createHash('sha256').update(encKeyString).digest();
  }

  // Development warnings
  if (!isProduction && (!rawJwtSecret || !rawEncKey || !databaseUrl)) {
    const missing: string[] = [];
    if (!databaseUrl) missing.push('DATABASE_URL');
    if (!rawJwtSecret) missing.push('JWT_SECRET');
    if (!rawEncKey) missing.push('ENCRYPTION_KEY');
    console.warn(`[Config] Notice: ${missing.join(', ')} not configured. Using development defaults. Configure .env before production deployment.`);
  }

  return {
    port,
    nodeEnv,
    isProduction,
    databaseUrl,
    jwtSecret,
    encryptionKey
  };
}

export const config: AppConfig = getValidatedConfig();
