import 'dotenv/config';

export interface AppConfig {
  port: number;
  nodeEnv: string;
  isProduction: boolean;
  databaseUrl: string;
  jwtSecret: string;
  encryptionKey: Buffer;
}

function requireEnv(name: string, fallback?: string): string {
  const value = process.env[name];
  if (value && value.trim().length > 0) {
    return value.trim();
  }
  if (fallback !== undefined) {
    return fallback;
  }
  if (process.env.NODE_ENV === 'production') {
    console.error(`FATAL: Environment variable ${name} is required in production.`);
    process.exit(1);
  }
  return '';
}

function deriveEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY || 'dev-only-insecure-encryption-key-placeholder-32b';
  if (/^[0-9a-fA-F]{64}$/.test(key)) {
    return Buffer.from(key, 'hex');
  }
  // Otherwise derive 32 bytes from SHA-256
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(key).digest();
}

export const config: AppConfig = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  databaseUrl: process.env.DATABASE_URL || '',
  jwtSecret: process.env.JWT_SECRET || 'dev-only-insecure-jwt-secret-placeholder-minimum-32c',
  encryptionKey: deriveEncryptionKey()
};
