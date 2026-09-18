import { spawn } from 'node:child_process';
import crypto from 'node:crypto';

const TEST_PORT = 4075;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

let passedCount = 0;
let failedCount = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`  ❌ FAIL: ${message}`);
    failedCount++;
    throw new Error(message);
  }
  console.log(`  ✅ PASS: ${message}`);
  passedCount++;
}

async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runTests() {
  console.log('=== STARTING PHASE 19 FULL END-TO-END REGRESSION TEST SUITE ===\n');

  // Launch production server bundle
  console.log('[Setup] Launching server on port', TEST_PORT, '...');
  const server = spawn('node', ['dist/server.js'], {
    env: {
      ...process.env,
      PORT: String(TEST_PORT),
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://test:test@127.0.0.1:5432/nonexistent_testdb',
      JWT_SECRET: 'test-production-secret-key-that-is-at-least-32-chars-long-12345',
      ENCRYPTION_KEY: 'test-production-encryption-key-min-32-chars-long-12345'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let serverOut = '';
  server.stdout.on('data', (d) => { serverOut += d.toString(); });
  server.stderr.on('data', (d) => { serverOut += d.toString(); });

  try {
    // Wait for server readiness
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

    if (!ready) {
      throw new Error(`Server failed to start. Logs:\n${serverOut}`);
    }
    console.log('[Setup] Server is ready. Running test cases...\n');

    // -------------------------------------------------------------
    // 1. Static Assets & SPA Routing
    // -------------------------------------------------------------
    console.log('--- 1. Static Assets & SPA Routing ---');
    {
      const res = await fetch(`${BASE_URL}/robots.txt`);
      assert(res.status === 200, 'GET /robots.txt returns HTTP 200');
      assert(res.headers.get('content-type')?.includes('text/plain'), 'GET /robots.txt has text/plain Content-Type');
      const text = await res.text();
      assert(text.includes('User-agent: *'), 'GET /robots.txt contains User-agent rules');
    }

    {
      const res = await fetch(`${BASE_URL}/`);
      assert(res.status === 200, 'GET / returns HTTP 200');
      assert(res.headers.get('content-type')?.includes('text/html'), 'GET / returns text/html Content-Type');
      const html = await res.text();
      assert(html.includes('id="root"'), 'GET / contains React root mounting point');
      assert(html.includes('/assets/index-'), 'GET / loads bundled JS/CSS assets');
    }

    {
      // Client-side routes must return index.html (SPA fallback)
      const res = await fetch(`${BASE_URL}/orders`);
      assert(res.status === 200, 'GET /orders returns HTTP 200 for SPA routing');
      const html = await res.text();
      assert(html.includes('id="root"'), 'GET /orders serves SPA index.html');
    }

    // -------------------------------------------------------------
    // 2. HTTP Security Headers
    // -------------------------------------------------------------
    console.log('\n--- 2. HTTP Security Headers ---');
    {
      const res = await fetch(`${BASE_URL}/`);
      const headers = res.headers;

      assert(headers.get('x-content-type-options') === 'nosniff', 'Header X-Content-Type-Options is nosniff');
      assert(headers.get('x-frame-options') === 'DENY', 'Header X-Frame-Options is DENY');
      assert(headers.get('referrer-policy') === 'strict-origin-when-cross-origin', 'Header Referrer-Policy is strict-origin-when-cross-origin');
      assert(headers.get('strict-transport-security') === 'max-age=31536000; includeSubDomains', 'Header Strict-Transport-Security is enforced in production');
      assert(headers.has('content-security-policy'), 'Header Content-Security-Policy is present');
      assert(headers.get('content-security-policy')?.includes("default-src 'self'"), 'CSP contains default-src self');
      assert(headers.get('x-robots-tag')?.includes('noindex'), 'Header X-Robots-Tag restricts crawlers');
    }

    // -------------------------------------------------------------
    // 3. Health & Installer Diagnostics
    // -------------------------------------------------------------
    console.log('\n--- 3. Health & Installer Diagnostics ---');
    {
      const res = await fetch(`${BASE_URL}/api/health`);
      assert(res.status === 503, 'GET /api/health returns HTTP 503 when DB is offline');
      const body = await res.json();
      assert(body.status === 'unhealthy', 'Health check status is unhealthy');
      assert(body.database === 'disconnected', 'Database report is disconnected');
      assert(typeof body.latencyMs === 'number', 'latencyMs is numeric');
      assert(typeof body.uptimeSeconds === 'number', 'uptimeSeconds is numeric');
      assert(Boolean(body.timestamp), 'timestamp is present in ISO format');
      assert(body.error === undefined, 'No internal error details leaked in production health check');
    }

    {
      const res = await fetch(`${BASE_URL}/api/install/status`);
      assert(res.status === 200, 'GET /api/install/status returns HTTP 200');
      const body = await res.json();
      assert(typeof body.installed === 'boolean', 'installed is boolean');
      assert(body.requirements !== undefined, 'requirements object is present');
      assert(typeof body.requirements.postgresReady === 'boolean', 'requirements.postgresReady is boolean');
    }

    // -------------------------------------------------------------
    // 4. API 404 Handler & Error Format
    // -------------------------------------------------------------
    console.log('\n--- 4. API 404 Handler & Error Format ---');
    {
      const res = await fetch(`${BASE_URL}/api/nonexistent-endpoint-12345`);
      assert(res.status === 404, 'GET /api/nonexistent returns HTTP 404');
      const body = await res.json();
      assert(body.success === false, '404 returns success: false');
      assert(body.code === 'NOT_FOUND', '404 returns code: NOT_FOUND');
      assert(body.error.includes('not found'), '404 returns readable error message');
      assert(res.headers.get('content-type')?.includes('application/json'), '404 returns JSON, not HTML');
    }

    {
      const res = await fetch(`${BASE_URL}/api/customers/nonexistent/sub-route`, { method: 'POST' });
      assert(res.status === 404, 'POST /api/customers/... returns HTTP 404');
      const body = await res.json();
      assert(body.code === 'NOT_FOUND', 'POST 404 returns code: NOT_FOUND');
    }

    // -------------------------------------------------------------
    // 5. Declarative Request Validation Layer
    // -------------------------------------------------------------
    console.log('\n--- 5. Declarative Request Validation Layer ---');
    {
      // POST /api/auth/login with empty body
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      assert(res.status === 400, 'POST /api/auth/login with empty body returns HTTP 400');
      const body = await res.json();
      assert(body.success === false, 'Validation failure returns success: false');
      assert(body.code === 'VALIDATION_ERROR', 'Validation failure returns code: VALIDATION_ERROR');
      assert(body.details && typeof body.details === 'object', 'Validation failure returns details object');
      assert(Boolean(body.details.username), 'Identifies missing username field');
      assert(Boolean(body.details.password), 'Identifies missing password field');
    }

    {
      // POST /api/install/setup with empty body
      const res = await fetch(`${BASE_URL}/api/install/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      assert(res.status === 400, 'POST /api/install/setup with empty body returns HTTP 400');
      const body = await res.json();
      assert(body.code === 'VALIDATION_ERROR', 'Setup returns VALIDATION_ERROR');
      assert(Boolean(body.details.adminUsername), 'Identifies missing adminUsername');
      assert(Boolean(body.details.adminEmail), 'Identifies missing adminEmail');
      assert(Boolean(body.details.adminPassword), 'Identifies missing adminPassword');
    }

    {
      // POST /api/install/setup with invalid email format and short password
      const res = await fetch(`${BASE_URL}/api/install/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminUsername: 'superadmin',
          adminEmail: 'not-a-valid-email',
          adminPassword: 'short'
        })
      });
      assert(res.status === 400, 'POST /api/install/setup with invalid email & short password returns HTTP 400');
      const body = await res.json();
      assert(body.details.adminEmail.includes('Invalid administrator email address format'), 'Rejects malformed email');
      assert(body.details.adminPassword.includes('at least 8 characters'), 'Enforces 8-character password constraint');
    }

    // -------------------------------------------------------------
    // 6. Authentication & JWT Security
    // -------------------------------------------------------------
    console.log('\n--- 6. Authentication & JWT Security ---');
    {
      // Unauthenticated access to protected route
      const res = await fetch(`${BASE_URL}/api/auth/me`);
      assert(res.status === 401, 'GET /api/auth/me without token returns HTTP 401');
      const body = await res.json();
      assert(body.error.includes('Authentication required'), 'Requires login error message');
    }

    {
      // Malformed Bearer token
      const res = await fetch(`${BASE_URL}/api/auth/me`, {
        headers: { Authorization: 'Bearer not.a.valid.jwt' }
      });
      assert(res.status === 401, 'Malformed JWT token returns HTTP 401');
    }

    {
      // Tampered JWT signature
      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(JSON.stringify({ id: 'fake-uuid', role: 'admin', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
      const fakeSig = crypto.randomBytes(32).toString('base64url');
      const tamperedToken = `${header}.${payload}.${fakeSig}`;

      const res = await fetch(`${BASE_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${tamperedToken}` }
      });
      assert(res.status === 401, 'Tampered JWT signature is rejected with HTTP 401');
    }

    {
      // Expired JWT token
      const secret = 'test-production-secret-key-that-is-at-least-32-chars-long-12345';
      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(JSON.stringify({
        sub: 'usr-test-123',
        exp: Math.floor(Date.now() / 1000) - 3600 // 1 hour in the past
      })).toString('base64url');
      const sig = crypto.createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
      const expiredToken = `${header}.${payload}.${sig}`;

      const res = await fetch(`${BASE_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${expiredToken}` }
      });
      assert(res.status === 401, 'Expired JWT token is rejected with HTTP 401');
    }

    // -------------------------------------------------------------
    // 7. Route Handlers & Method Enforcement (All 18 Routes)
    // -------------------------------------------------------------
    console.log('\n--- 7. Route Handlers & Method Enforcement ---');
    {
      const routes = [
        { path: '/api/install/status', method: 'GET' },
        { path: '/api/categories', method: 'GET' },
        { path: '/api/products', method: 'GET' },
        { path: '/api/plans', method: 'GET' },
        { path: '/api/customers', method: 'GET' },
        { path: '/api/orders', method: 'GET' },
        { path: '/api/renewals/ord-test-123', method: 'POST' },
        { path: '/api/alerts', method: 'GET' },
        { path: '/api/currencies', method: 'GET' },
        { path: '/api/users', method: 'GET' },
        { path: '/api/devices', method: 'GET' },
        { path: '/api/audit', method: 'GET' },
        { path: '/api/settings', method: 'GET' },
        { path: '/api/search', method: 'GET' },
        { path: '/api/dashboard/stats', method: 'GET' },
        { path: '/api/whatsapp/templates', method: 'GET' },
        { path: '/api/inventory/accounts', method: 'GET' },
        { path: '/api/inventory/licenses', method: 'GET' }
      ];

      for (const route of routes) {
        const res = await fetch(`${BASE_URL}${route.path}`, { method: route.method });
        assert(res.status !== 404, `Route ${route.method} ${route.path} is properly mounted (status: ${res.status}, not 404)`);
      }
    }

    // -------------------------------------------------------------
    // 8. Cryptographic Primitives Verification (PBKDF2 & AES-256-GCM)
    // -------------------------------------------------------------
    console.log('\n--- 8. Cryptographic Primitives Verification ---');
    {
      const testPw = 'SuperSecret123!@#';
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = crypto.pbkdf2Sync(testPw, salt, 100000, 64, 'sha512').toString('hex');

      // Verify correct password
      const verifyCorrect = crypto.pbkdf2Sync(testPw, salt, 100000, 64, 'sha512').toString('hex');
      const buf1 = Buffer.from(hash, 'hex');
      const buf2 = Buffer.from(verifyCorrect, 'hex');
      assert(crypto.timingSafeEqual(buf1, buf2), 'PBKDF2-SHA512 verifies correct password with timingSafeEqual');

      // Verify wrong password
      const verifyWrong = crypto.pbkdf2Sync('WrongPassword', salt, 100000, 64, 'sha512').toString('hex');
      const buf3 = Buffer.from(verifyWrong, 'hex');
      assert(!crypto.timingSafeEqual(buf1, buf3), 'PBKDF2-SHA512 rejects incorrect password');

      // AES-256-GCM authenticated encryption
      const testKey = crypto.randomBytes(32);
      const iv = crypto.randomBytes(12);
      const plaintext = 'top-secret-api-token-value-999';
      const cipher = crypto.createCipheriv('aes-256-gcm', testKey, iv);
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const tag = cipher.getAuthTag();

      // Decrypt
      const decipher = crypto.createDecipheriv('aes-256-gcm', testKey, iv);
      decipher.setAuthTag(tag);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      assert(decrypted === plaintext, 'AES-256-GCM decrypts payload correctly');

      // Tampered ciphertext must fail authentication tag check
      let tamperedFailed = false;
      try {
        const tamperedCipher = crypto.createDecipheriv('aes-256-gcm', testKey, iv);
        tamperedCipher.setAuthTag(tag);
        const tamperedEncrypted = 'ff' + encrypted.slice(2);
        tamperedCipher.update(tamperedEncrypted, 'hex', 'utf8');
        tamperedCipher.final('utf8');
      } catch {
        tamperedFailed = true;
      }
      assert(tamperedFailed, 'AES-256-GCM rejects tampered ciphertext');
    }

    console.log(`\n======================================================`);
    console.log(`RESULTS: ${passedCount} PASSED, ${failedCount} FAILED`);
    console.log(`======================================================`);

    if (failedCount > 0) {
      process.exit(1);
    }
  } finally {
    server.kill();
  }
}

runTests().catch((err) => {
  console.error('\nTest Suite Fatal Exception:', err);
  process.exit(1);
});
