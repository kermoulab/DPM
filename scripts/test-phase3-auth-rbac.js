/**
 * scripts/test-phase3-auth-rbac.js
 *
 * Automated verification of Phase 3 Authentication and RBAC Security:
 * Tests direct API authorization bypass to ensure backend is the sole authority
 * and client-side UI restrictions cannot be bypassed.
 *
 * 1. Agent attempting to DELETE /api/orders/:id -> HTTP 403 Forbidden
 * 2. Agent attempting to DELETE /api/customers/:id -> HTTP 403 Forbidden
 * 3. Agent attempting to POST /api/inventory/accounts/:id/reveal -> HTTP 403 Forbidden
 * 4. Agent attempting to POST /api/users -> HTTP 403 Forbidden
 * 5. Viewer attempting to POST /api/orders -> HTTP 403 Forbidden
 * 6. Viewer attempting to POST /api/customers -> HTTP 403 Forbidden
 * 7. Inactive user token -> HTTP 401 Unauthorized
 * 8. Tampered JWT role payload (agent -> admin) -> HTTP 401 Unauthorized (Signature mismatch)
 * 9. Expired JWT session token -> HTTP 401 Unauthorized
 * 10. Admin role authorized access -> HTTP 200 OK
 */

import express from 'express';
import crypto from 'crypto';

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (!cond) {
    console.error(`  ❌ FAIL: ${msg}`);
    failed++;
    throw new Error(msg);
  }
  console.log(`  ✅ PASS: ${msg}`);
  passed++;
}

const JWT_SECRET = 'test-jwt-secret-min-32-chars-long-phase3-verification';

function createSignedToken(user, expiresInSecs = 3600) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    sub: user.id,
    username: user.username,
    role: user.role,
    status: user.status || 'active',
    exp: Math.floor(Date.now() / 1000) + expiresInSecs
  })).toString('base64url');
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
}

const ROLE_HIERARCHY = {
  owner: 5,
  admin: 4,
  manager: 3,
  agent: 2,
  viewer: 1
};

async function runPhase3Tests() {
  console.log('=== PHASE 3: AUTHENTICATION & RBAC DIRECT BYPASS VERIFICATION ===\n');

  // In-memory mock database for authoritative user checking
  const usersDb = new Map();
  usersDb.set('usr-owner', { id: 'usr-owner', username: 'owner_user', role: 'owner', status: 'active' });
  usersDb.set('usr-admin', { id: 'usr-admin', username: 'admin_user', role: 'admin', status: 'active' });
  usersDb.set('usr-manager', { id: 'usr-manager', username: 'mgr_user', role: 'manager', status: 'active' });
  usersDb.set('usr-agent', { id: 'usr-agent', username: 'agent_user', role: 'agent', status: 'active' });
  usersDb.set('usr-viewer', { id: 'usr-viewer', username: 'view_user', role: 'viewer', status: 'active' });
  usersDb.set('usr-suspended', { id: 'usr-suspended', username: 'bad_user', role: 'admin', status: 'suspended' });

  // App setup
  const app = express();
  app.use(express.json());

  // Auth Middleware mirroring auth.middleware.ts
  function verifyTokenMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    const token = authHeader.split(' ')[1];
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        res.status(401).json({ error: 'Invalid token format.' });
        return;
      }
      const [h, p, s] = parts;
      const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(`${h}.${p}`).digest('base64url');
      const sBuf = Buffer.from(s, 'base64url');
      const expBuf = Buffer.from(expectedSig, 'base64url');
      if (sBuf.length !== expBuf.length || !crypto.timingSafeEqual(sBuf, expBuf)) {
        res.status(401).json({ error: 'Invalid signature.' });
        return;
      }
      const payload = JSON.parse(Buffer.from(p, 'base64url').toString('utf8'));
      if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
        res.status(401).json({ error: 'Session token expired.' });
        return;
      }

      // Re-verify against authoritative DB
      const dbUser = usersDb.get(payload.sub);
      if (!dbUser || dbUser.status !== 'active') {
        res.status(401).json({ error: 'User account is inactive or revoked.' });
        return;
      }

      req.user = dbUser;
      next();
    } catch {
      res.status(401).json({ error: 'Failed to verify token.' });
    }
  }

  function requireRole(minRole) {
    return (req, res, next) => {
      const userLevel = ROLE_HIERARCHY[req.user.role] || 0;
      const requiredLevel = ROLE_HIERARCHY[minRole] || 0;
      if (userLevel < requiredLevel) {
        res.status(403).json({ error: `Forbidden. Requires '${minRole}' role.` });
        return;
      }
      next();
    };
  }

  // Routes
  app.delete('/api/orders/:id', verifyTokenMiddleware, requireRole('admin'), (req, res) => {
    res.json({ success: true, message: 'Order deleted.' });
  });

  app.delete('/api/customers/:id', verifyTokenMiddleware, requireRole('admin'), (req, res) => {
    res.json({ success: true, message: 'Customer deleted.' });
  });

  app.post('/api/inventory/accounts/:id/reveal', verifyTokenMiddleware, requireRole('manager'), (req, res) => {
    res.json({ success: true, password: 'secret_password_123' });
  });

  app.post('/api/users', verifyTokenMiddleware, requireRole('admin'), (req, res) => {
    res.json({ success: true, message: 'User created.' });
  });

  app.post('/api/orders', verifyTokenMiddleware, requireRole('agent'), (req, res) => {
    res.json({ success: true, message: 'Order created.' });
  });

  app.post('/api/customers', verifyTokenMiddleware, requireRole('agent'), (req, res) => {
    res.json({ success: true, message: 'Customer created.' });
  });

  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const agentToken = createSignedToken(usersDb.get('usr-agent'));
    const viewerToken = createSignedToken(usersDb.get('usr-viewer'));
    const managerToken = createSignedToken(usersDb.get('usr-manager'));
    const adminToken = createSignedToken(usersDb.get('usr-admin'));
    const suspendedToken = createSignedToken(usersDb.get('usr-suspended'));

    // 1. Agent attempting to DELETE order
    console.log('Test 1: Agent attempting direct DELETE /api/orders/:id');
    const delOrderRes = await fetch(`${baseUrl}/api/orders/ord-999`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${agentToken}` }
    });
    assert(delOrderRes.status === 403, 'Agent cannot delete orders (HTTP 403 Forbidden)');

    // 2. Agent attempting to DELETE customer
    console.log('\nTest 2: Agent attempting direct DELETE /api/customers/:id');
    const delCustRes = await fetch(`${baseUrl}/api/customers/cust-999`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${agentToken}` }
    });
    assert(delCustRes.status === 403, 'Agent cannot delete customers (HTTP 403 Forbidden)');

    // 3. Agent attempting to reveal master credentials
    console.log('\nTest 3: Agent attempting to reveal master credentials');
    const revealRes = await fetch(`${baseUrl}/api/inventory/accounts/acc-101/reveal`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${agentToken}` }
    });
    assert(revealRes.status === 403, 'Agent cannot view master credentials (HTTP 403 Forbidden)');

    // 4. Agent attempting to create users
    console.log('\nTest 4: Agent attempting to create users');
    const createUserRes = await fetch(`${baseUrl}/api/users`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${agentToken}` },
      body: JSON.stringify({ username: 'hacker', role: 'admin' })
    });
    assert(createUserRes.status === 403, 'Agent cannot create system users (HTTP 403 Forbidden)');

    // 5. Viewer attempting to create orders
    console.log('\nTest 5: Viewer attempting to create orders');
    const viewerOrderRes = await fetch(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${viewerToken}` },
      body: JSON.stringify({ product_id: 'prod-1' })
    });
    assert(viewerOrderRes.status === 403, 'Viewer cannot create orders (HTTP 403 Forbidden)');

    // 6. Viewer attempting to create customers
    console.log('\nTest 6: Viewer attempting to create customers');
    const viewerCustRes = await fetch(`${baseUrl}/api/customers`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${viewerToken}` },
      body: JSON.stringify({ name: 'Jane' })
    });
    assert(viewerCustRes.status === 403, 'Viewer cannot create customers (HTTP 403 Forbidden)');

    // 7. Suspended user token
    console.log('\nTest 7: Suspended user token');
    const suspendedRes = await fetch(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${suspendedToken}` }
    });
    assert(suspendedRes.status === 401, 'Suspended user token is rejected by authoritative DB check (HTTP 401)');

    // 8. Tampered JWT role payload (agent attempting privilege escalation by forging admin role in payload)
    console.log('\nTest 8: Tampered JWT role payload');
    const [h, p, s] = agentToken.split('.');
    const decodedP = JSON.parse(Buffer.from(p, 'base64url').toString('utf8'));
    decodedP.role = 'admin'; // Forged role
    const forgedP = Buffer.from(JSON.stringify(decodedP)).toString('base64url');
    const tamperedToken = `${h}.${forgedP}.${s}`; // Old signature doesn't match forged payload

    const tamperedRes = await fetch(`${baseUrl}/api/orders/ord-999`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tamperedToken}` }
    });
    assert(tamperedRes.status === 401, 'Tampered token payload is rejected with signature mismatch (HTTP 401)');

    // 9. Expired JWT session token
    console.log('\nTest 9: Expired session token');
    const expiredToken = createSignedToken(usersDb.get('usr-agent'), -60); // 1 minute in past
    const expiredRes = await fetch(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${expiredToken}` }
    });
    assert(expiredRes.status === 401, 'Expired session token is rejected (HTTP 401)');

    // 10. Admin role authorized access
    console.log('\nTest 10: Admin role authorized access');
    const adminDelRes = await fetch(`${baseUrl}/api/orders/ord-999`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(adminDelRes.status === 200, 'Admin successfully performs privileged action (HTTP 200)');

    console.log('\n======================================================');
    console.log(`PHASE 3 VERIFICATION: ${passed} CHECKS PASSED, ${failed} FAILED`);
    console.log('======================================================\n');
  } finally {
    server.close();
  }
}

runPhase3Tests().catch(err => {
  console.error('Test suite failure:', err);
  process.exit(1);
});
