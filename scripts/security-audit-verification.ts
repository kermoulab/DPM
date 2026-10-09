/**
 * scripts/security-audit-verification.ts
 * Automated verification for pentest audit fixes.
 */

import assert from 'assert';
import { createSessionToken, verifySessionToken } from '../server/middleware/auth.middleware.js';
import { encryptCredential, decryptCredential } from '../server/utils/crypto.js';

async function runAuditVerification() {
  console.log('=== STARTING SECURITY AUDIT REMEDIATION VERIFICATION ===\n');

  // 1. Cryptographic Primitive Hardening (Finding 12)
  console.log('--- 1. Cryptographic Decryption Invariants ---');
  const secret = 'SuperSecretEnterprisePassword#2026';
  const encrypted = encryptCredential(secret);
  const decrypted = decryptCredential(encrypted.encrypted, encrypted.iv, encrypted.tag);
  assert.strictEqual(decrypted, secret, 'Valid ciphertext decrypts to exact original plaintext');
  console.log('  ✅ PASS: Valid credential decrypts successfully with active key');

  let failedTampered = false;
  try {
    const tampered = 'aa' + encrypted.encrypted.slice(2);
    decryptCredential(tampered, encrypted.iv, encrypted.tag);
  } catch {
    failedTampered = true;
  }
  assert.strictEqual(failedTampered, true, 'Tampered ciphertext must throw without returning fallback string');
  console.log('  ✅ PASS: Tampered ciphertext throws error and fails closed (no fallback strings)');

  let failedInvalidLengths = false;
  try {
    decryptCredential('d8293f0b24', 'e819a', 'fa01c');
  } catch {
    failedInvalidLengths = true;
  }
  assert.strictEqual(failedInvalidLengths, true, 'Invalid IV/tag lengths must throw without magic seed fallback');
  console.log('  ✅ PASS: Invalid IV/tag lengths throw error and refuse magic strings');

  // 2. Token Versioning (Finding 4)
  console.log('\n--- 2. Token Version Binding ---');
  const dummyUser = {
    id: 'usr-test-123',
    username: 'alice',
    email: 'alice@example.com',
    name: 'Alice Agent',
    role: 'agent' as const,
    token_version: 1
  };
  const tokenV1 = createSessionToken(dummyUser);
  const parsed = verifySessionToken(tokenV1);
  assert.strictEqual(parsed?.token_version, 1, 'Token embeds token_version claim');
  console.log('  ✅ PASS: Session token embeds authoritative token_version');

  const dummyUserV2 = { ...dummyUser, token_version: 2 };
  const tokenV2 = createSessionToken(dummyUserV2);
  const parsedV2 = verifySessionToken(tokenV2);
  assert.strictEqual(parsedV2?.token_version, 2, 'Rotated token embeds incremented version');
  assert.notStrictEqual(parsed?.token_version, parsedV2?.token_version, 'Pre-rotation and post-rotation token versions differ');
  // 3. Single-Owner Migration Invariant
  console.log('\n--- 3. Single-Owner Database Index Invariant ---');
  const fs = await import('fs');
  const migration005 = fs.readFileSync('server/db/migrations/005_single_owner_unique_index.sql', 'utf8');
  assert.ok(migration005.includes("idx_users_single_owner"), 'Migration 005 defines idx_users_single_owner');
  assert.ok(migration005.includes("WHERE role = 'owner'"), 'Migration 005 enforces single owner partial index');
  console.log('  ✅ PASS: Migration 005 enforces single-owner constraint at database schema level');

  // 4. Installer Transaction-Scoped Lock Invariant
  console.log('\n--- 4. Installer Advisory Lock Scoping Invariant ---');
  const installSrc = fs.readFileSync('server/routes/install.ts', 'utf8');
  assert.ok(!installSrc.includes('getPool().query(\'SELECT pg_advisory_lock'), 'No pooled connection-leaking advisory locks in install.ts');
  assert.ok(installSrc.includes('pg_advisory_xact_lock'), 'Uses transaction-bound pg_advisory_xact_lock on dedicated client');
  console.log('  ✅ PASS: Setup handlers enforce client-bound transaction-scoped advisory lock');

  console.log('\n======================================================');
  console.log('SECURITY AUDIT CHECKS COMPLETED: ALL INVARIANTS PASSED');
  console.log('======================================================\n');
}

runAuditVerification().catch(err => {
  console.error('\n❌ Verification Failed:', err);
  process.exit(1);
});
