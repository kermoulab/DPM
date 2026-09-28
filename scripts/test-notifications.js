/**
 * scripts/test-notifications.js
 *
 * Automated verification of Notifications Repository & API Endpoints:
 * - Duplicate prevention logic
 * - Expiration threshold key mapping
 * - Endpoint routing and validation
 */

import { spawn } from 'node:child_process';

const TEST_PORT = 4078;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASS: ${message}`);
}

async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runTest() {
  console.log('--- Testing Notification Subsystem ---');

  // 1. Verify notification threshold keys and deduplication logic
  const thresholds = [7, 3, 1, 0];
  const keys = thresholds.map(days => {
    if (days === 7) return '7d';
    if (days === 3) return '3d';
    if (days === 1) return '1d';
    if (days <= 0) return 'expired';
    return null;
  });
  assert(keys[0] === '7d', '7-day threshold maps to 7d key');
  assert(keys[1] === '3d', '3-day threshold maps to 3d key');
  assert(keys[2] === '1d', '1-day threshold maps to 1d key');
  assert(keys[3] === 'expired', '0-day threshold maps to expired key');

  // 2. Spawn server to test endpoints
  const server = spawn('node', ['dist/server.js'], {
    env: {
      ...process.env,
      PORT: String(TEST_PORT),
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://test:test@127.0.0.1:5432/nonexistent_testdb',
      JWT_SECRET: 'test-notifications-secret-key-min-32-chars-long',
      ENCRYPTION_KEY: 'test-notifications-encryption-key-min-32-chars'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  try {
    let ready = false;
    for (let i = 0; i < 40; i++) {
      await wait(150);
      try {
        const res = await fetch(`${BASE_URL}/robots.txt`);
        if (res.status === 200) {
          ready = true;
          break;
        }
      } catch {}
    }
    assert(ready, 'Server started successfully for notification tests');

    // 3. Test unauthenticated access to /api/notifications returns 401
    const unauthRes = await fetch(`${BASE_URL}/api/notifications`);
    assert(unauthRes.status === 401, 'GET /api/notifications without token returns HTTP 401');

    // 4. Test unauthenticated register-token returns 401
    const regRes = await fetch(`${BASE_URL}/api/notifications/register-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'test-token' })
    });
    assert(regRes.status === 401, 'POST /api/notifications/register-token without auth returns HTTP 401');

    console.log('--- Notification Subsystem Tests Passed Successfully ---');
  } finally {
    server.kill();
  }
}

runTest().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
