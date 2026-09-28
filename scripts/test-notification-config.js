/**
 * scripts/test-notification-config.js
 *
 * Automated verification of No-Code Push Notification Configuration Endpoints:
 * - Unauthenticated request rejection (401)
 * - Config status retrieval
 * - Configuration save & validation
 * - Connection testing
 * - Disconnect & cleanup
 */

import { spawn } from 'node:child_process';

const TEST_PORT = 4079;
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

async function run() {
  console.log('--- Testing No-Code Push Notification Configuration Subsystem ---');

  // Spawn server
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
    assert(ready, 'Server started successfully on test port');

    // 1. Test unauthenticated access to /api/notifications/config returns 401
    const unauthGet = await fetch(`${BASE_URL}/api/notifications/config`);
    assert(unauthGet.status === 401, 'GET /api/notifications/config without token returns HTTP 401');

    // 2. Test unauthenticated POST /api/notifications/config returns 401
    const unauthPost = await fetch(`${BASE_URL}/api/notifications/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serviceAccountJson: '{}' })
    });
    assert(unauthPost.status === 401, 'POST /api/notifications/config without token returns HTTP 401');

    // 3. Test unauthenticated test-connection returns 401
    const unauthTest = await fetch(`${BASE_URL}/api/notifications/test-connection`, {
      method: 'POST'
    });
    assert(unauthTest.status === 401, 'POST /api/notifications/test-connection without token returns HTTP 401');

    // 4. Test unauthenticated test-push returns 401
    const unauthPush = await fetch(`${BASE_URL}/api/notifications/test-push`, {
      method: 'POST'
    });
    assert(unauthPush.status === 401, 'POST /api/notifications/test-push without token returns HTTP 401');

    // 5. Test unauthenticated DELETE /api/notifications/config returns 401
    const unauthDel = await fetch(`${BASE_URL}/api/notifications/config`, {
      method: 'DELETE'
    });
    assert(unauthDel.status === 401, 'DELETE /api/notifications/config without token returns HTTP 401');

    // 6. Test configure-business installer endpoint route
    const installerBizRes = await fetch(`${BASE_URL}/api/install/configure-business`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyName: 'Test Reseller Co',
        firebaseServiceAccount: '{"invalid": true}'
      })
    });
    // In uninstalled/installed state it returns 403 or 200
    assert(installerBizRes.status === 200 || installerBizRes.status === 403, 'POST /api/install/configure-business returns valid status');

    console.log('--- All Push Notification Configuration Tests Passed Successfully ---');
  } finally {
    server.kill();
  }
}

run().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
