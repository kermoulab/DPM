# SECURITY THREAT MODEL & HARDENING ARCHITECTURE — DPM / VECTIS ERP

## 1. Attack Surface & Threat Environment

The native Android client must be treated as untrusted, hostile territory. The threat model assumes the adversary has physical or administrative access to the client device and can perform:
1. **Static Analysis & Decompilation**: Reverse-engineering the APK using tools such as `jadx`, `apktool`, and `Ghidra` to inspect source code, endpoint URLs, and internal models.
2. **Dynamic Instrumentation**: Utilizing frameworks such as `Frida`, `Xposed`, and `Objection` on rooted devices or emulators to hook methods, modify runtime variables, and bypass client-side checks.
3. **Network Interception & Tampering**: Utilizing `Burp Suite`, `mitmproxy`, or `Charles` with custom CA certificates to intercept, replay, and modify HTTP requests and responses.
4. **Direct API Exploitation**: Completely bypassing the Android UI to invoke backend REST endpoints directly with spoofed or altered payloads (testing for IDOR, privilege escalation, and parameter tampering).

---

## 2. Threat Analysis & Defensive Countermeasures

### 2.1 Authentication & Session Security

| Threat | Risk Level | Attack Vector | Countermeasure & Implementation |
| :--- | :--- | :--- | :--- |
| **Token Theft / Storage Extraction** | High | Attacker inspects device filesystem or app private storage to steal access tokens. | **Android Keystore AES-256 GCM**: Tokens are encrypted using `EncryptedSharedPreferences` backed by hardware-backed master keys. Tokens are never stored in plaintext or database files. |
| **Brute-Force Credential Guessing** | High | Automated credential stuffing against `/api/auth/login`. | **Backend Rate Limiting**: The backend enforces aggressive IP and account-based rate limiting (10 attempts / 15 minutes) with exponential backoff and returns HTTP 429. |
| **Revoked Session Continuation** | High | An admin terminates an employee, but the employee continues making API calls with an existing JWT. | **Authoritative DB Validation & Revocation List**: In `auth.middleware.ts`, every authenticated request re-queries `users.status`. Inactive/suspended accounts are immediately rejected with HTTP 401. Revoked tokens are tracked in an in-memory blocklist. |
| **Session Fixation / Replay** | Medium | Replaying expired or stolen session tokens. | **Short-Lived Signed JWTs**: Tokens expire strictly after 24 hours. Signatures are verified using HMAC-SHA256 with constant-time equality check (`crypto.timingSafeEqual`) to prevent timing side-channel attacks. |

---

### 2.2 Authorization & Broken Object-Level Authorization (BOLA/IDOR)

| Threat | Risk Level | Attack Vector | Countermeasure & Implementation |
| :--- | :--- | :--- | :--- |
| **UI Bypass Privilege Escalation** | Critical | An `agent` user hooks Android Compose UI or uses Burp to send `DELETE /api/orders/:id` or `POST /api/users`. | **Server-Side RBAC Enforcement**: Client UI restrictions are purely for user experience. Every API route strictly executes `requireRole(...)`. If an `agent` sends an admin request, the backend immediately responds with HTTP 403 Forbidden. |
| **Unauthorized Credential Decryption** | Critical | An unauthorized agent or viewer calls `POST /api/inventory/accounts/:id/reveal` to steal master Netflix/Google passwords. | **Role Gate & Audit Trail**: The endpoint explicitly enforces `requireRole('manager')`. Non-managers receive HTTP 403. Every successful reveal is permanently logged in `audit_logs` with IP, timestamp, user ID, and target account. |
| **IDOR in Resource Modification** | High | Modifying foreign customer or order records by altering numeric or UUID keys in `PUT` requests. | **Scoped Database Lookups & Foreign Key Constraints**: All queries validate resource existence and enforce relational integrity via PostgreSQL constraints. |

---

### 2.3 Device Pairing Vulnerabilities

| Threat | Risk Level | Attack Vector | Countermeasure & Implementation |
| :--- | :--- | :--- | :--- |
| **Pairing Code Enumeration** | Critical | Attacker attempts to brute-force 6-character pairing codes via `/api/devices/pair`. | **Strict Rate Limiting & Attempt Caps**: The pair endpoint limits attempts to 10 requests per 15 minutes per IP. Codes use a 36-character alphanumeric keyspace ($36^6 \approx 2.17 \times 10^9$ combinations), making guessing statistically impossible within rate limits. |
| **Code Reuse (Replay Attack)** | High | Attacker intercepts a valid pairing code and pairs an unauthorized secondary device. | **Atomic Single-Use Invalidation**: `devices.repository.ts` atomically sets `pairing_code = NULL` and `status = 'paired'` in the same database transaction. The code cannot be used more than once. |
| **Expired Code Acceptance** | Medium | Pairing with a code generated days ago. | **Short Expiration Window**: Codes strictly expire after 10 minutes (`code_expires_at < NOW()`). |
| **Revoked Device Access** | High | Device is reported lost or stolen; admin revokes it, but app continues functioning. | **Per-Request Device Gate**: Android sends `X-Device-Id`. The backend checks `devices.status`. If `revoked`, the backend responds with HTTP 401 and header `X-Device-Revoked: true`. The Android `AuthInterceptor` immediately wipes local encrypted storage and redirects to the Pairing screen. |

---

### 2.4 Android Client-Side Specific Protections

1. **Anti-Backup & Exfiltration**:
   - `android:allowBackup="false"` and `android:dataExtractionRules="@null"` in `AndroidManifest.xml` prevent attackers from extracting app data via `adb backup`.
2. **Zero Local Business Data**:
   - The application maintains zero Room, SQLite, or Realm databases for business entities (orders, customers, inventory, products). If the device is seized or forensically inspected, no customer or business records exist in local storage.
3. **ProGuard / R8 Obfuscation**:
   - In `proguard-rules.pro`, all debug logs (`Log.d`, `Log.v`) and unnecessary metadata are stripped in release builds. Classes and networking models are obfuscated.
4. **Cleartext Traffic Control**:
   - In production builds, cleartext HTTP is prohibited. Only secure HTTPS/TLS with valid certificates is permitted.
5. **No Secret Inclusions**:
   - Source code, assets, and Gradle configs contain zero hardcoded database passwords, master passwords, or JWT secrets.

---

## 3. Automated Security Verification Checklist (Phase 11)

- [ ] Automated test: Attempt `DELETE /api/orders/:id` with `agent` token -> MUST return 403.
- [ ] Automated test: Attempt `DELETE /api/customers/:id` with `agent` token -> MUST return 403.
- [ ] Automated test: Attempt `POST /api/inventory/accounts/:id/reveal` with `agent` token -> MUST return 403.
- [ ] Automated test: Attempt `POST /api/users` with `manager` token -> MUST return 403.
- [ ] Automated test: Attempt `POST /api/devices/pair` with invalid code 15 times -> MUST trigger 429.
- [ ] Automated test: Attempt `POST /api/devices/pair` with reused code -> MUST return 400/404.
- [ ] Automated test: Revoke device in DB -> Next API call from device MUST return 401 with `X-Device-Revoked`.
