# PHASE 0 — PROJECT AUDIT & SYSTEM RECONNAISSANCE
**Digital Products ERP — Android Companion Application**

**Audit Date:** 2026-09-21  
**Auditor:** Senior Android & Backend Security Architect  
**Scope:** Vectis ERP Web Backend, PostgreSQL Database, Android Toolchain, Device Pairing, and API Surface.

---

## 1. Executive Summary

Vectis ERP is a production-grade Enterprise Resource Planning system purpose-built for digital product resellers (recurring streaming profiles, license keys, digital files, custom merchandise). The web application and backend exist, are fully functional, and run on Node.js 22 LTS with an authoritative PostgreSQL 16 database.

The Android Companion Application (`vectis/`) is designed as an **untrusted, secure, API-driven mobile client**. In accordance with **Rule 1 (Database is the only source of truth)**, the Android app will maintain **zero business databases** (no local SQLite/Room for customers, orders, products, or inventory). It communicates strictly via authenticated HTTPS REST endpoints with full server-side authorization enforcement.

---

## 2. Existing System Architecture

### 2.1 Backend Stack & Topology
- **Server Runtime:** Node.js 22 LTS / Express 4 (ESM).
- **Database Engine:** PostgreSQL 16+ accessed exclusively through parameterized queries and atomic transactions via `pg.Pool`.
- **Architectural Pattern:** Layered `Routes -> Services -> Repositories -> PostgreSQL`.
- **Security & Crypto:**
  - Password Hashing: PBKDF2-SHA512 with 100,000 iterations and 64-byte salt.
  - Session Tokens: HMAC-SHA256 JWT tokens with server-side revocation cache.
  - Credential Storage: AES-256-GCM authenticated encryption with 96-bit random IV and 128-bit authentication tag.
  - Rate Limiting: In-memory IP tracking on sensitive endpoints (`/api/auth/login`).
  - Security Headers: HSTS, CSP, X-Frame-Options (DENY), X-Content-Type-Options (nosniff).

### 2.2 User Roles & Hierarchy
The backend implements a strict 5-tier Role-Based Access Control (RBAC) hierarchy:
```text
owner (level 5) > admin (level 4) > manager (level 3) > agent (level 2) > viewer (level 1)
```
Every sensitive route enforces `requireAuth` and `requireRole(...)`.

---

## 3. Database Schema & Domain Models

Authoritative schema defined across `server/db/migrations/001_initial_schema.sql` and `002_add_mad_currency.sql`:

1. **`users`**: Staff accounts (`id`, `username`, `email`, `role`, `status`, `preferred_currency`, `password_hash`, `password_salt`).
2. **`categories`**: Catalog taxonomy (`id`, `name`, `slug`, `icon`, `status`).
3. **`products`**: Sellable products with capability flags (`capabilities` JSONB, e.g. `["subscription", "service_account", "profiles", "license_key", "manual_fulfillment"]`).
4. **`plans`**: Duration-based pricing tiers (`duration`, `duration_unit`, `price`, `cost`, `currency`, `stock_limit`).
5. **`customers`**: Customer directory (`name`, `email`, `whatsapp`, `notes`, `status`).
6. **`service_accounts`**: Master provider credentials encrypted via AES-256-GCM (`provider`, `login`, `encrypted_credential`, `iv`, `tag`, `capacity`).
7. **`service_profiles`**: Individual profile slots (`profile_name`, `pin`, `status`, `assigned_customer_id`, `assigned_order_id`).
8. **`license_keys`**: Digital serial key pool (`license_key`, `status`: `available | assigned | expired | blocked`).
9. **`orders`**: Transaction records (`order_number`, `customer_id`, `product_id`, `plan_id`, `start_date`, `end_date`, `price`, `status`: `pending | active | expiring | expired | cancelled | completed`, `fulfillment_data`).
10. **`order_renewals`**: Subscription extensions audit ledger (`previous_end_date`, `new_end_date`, `price`, `cost`).
11. **`paired_devices`**: Registered Android hardware (`id`, `device_name`, `device_type`, `device_token_hash`, `paired_by_user_id`, `pairing_code`, `code_expires_at`, `status`: `pending | paired | revoked`, `last_seen`).
12. **`notification_templates`**: Multilingual WhatsApp templates across `en`, `fr`, `ar`, `ru`.
13. **`audit_logs`**: Immutable event ledger auto-pruned after 30 days.

---

## 4. Current API Endpoints & Contracts

| Endpoint | Method | Role Required | Description |
|---|---|---|---|
| `/api/auth/login` | `POST` | Public | Staff login (rate-limited, returns JWT + User) |
| `/api/auth/me` | `GET` | Authenticated | Fetch active user session profile |
| `/api/auth/logout` | `POST` | Authenticated | Revoke token and clear session |
| `/api/dashboard/stats` | `GET` | `viewer` | Metrics, charts, top products, recent orders (max 5) |
| `/api/orders` | `GET` | `viewer` | Paginated/filtered orders (`active`, `expiring`, `expired`) |
| `/api/orders` | `POST` | `agent` | Create order & auto-allocate profile or license key |
| `/api/orders/:id` | `GET` | `viewer` | Get single order details |
| `/api/orders/:id` | `PUT` | `manager` | Update order dates, status, or details |
| `/api/orders/:id` | `DELETE` | `admin` | Delete order (atomically releases profiles & keys) |
| `/api/orders/:id/renew` | `POST` | `agent` | Extend subscription (from end_date or current date) |
| `/api/customers` | `GET` | `viewer` | List customers with order totals & spent |
| `/api/customers` | `POST` | `agent` | Create new customer (WhatsApp sanitized) |
| `/api/customers/:id` | `PUT` | `agent` | Update customer info |
| `/api/customers/:id` | `DELETE` | `admin` | Delete customer (guarded against active orders) |
| `/api/products` | `GET` | `viewer` | Product catalog with capabilities & stock counts |
| `/api/products` | `POST` | `admin` | Create product |
| `/api/products/:id` | `PUT` | `admin` | Update product |
| `/api/products/:id` | `DELETE` | `admin` | Delete product (guarded against active orders) |
| `/api/plans` | `GET` | `viewer` | List plan tiers by product |
| `/api/inventory/accounts` | `GET` | `manager` | View service accounts and profile slots |
| `/api/inventory/licenses` | `GET` | `manager` | View license key pools |
| `/api/alerts` | `GET` | `agent` | Expiring (≤ 7 days), expired, and stock alerts |
| `/api/whatsapp/compose` | `POST` | `agent` | Render localized message template for order |
| `/api/devices` | `GET` | `manager` | List registered/paired devices |
| `/api/devices/generate-pairing-code`| `POST` | `manager` | Generate 6-digit code + QR code |
| `/api/devices/confirm-pair` | `POST` | `manager` | Confirm pairing (Web-initiated) |
| `/api/devices/:id` | `DELETE` | `manager` | Delete/revoke paired device |
| `/api/search` | `GET` | `viewer` | Universal cross-entity search |
| `/api/audit` | `GET` | `admin` | Paginated audit logs (max 30/page, 30-day retention) |

---

## 5. Mobile Environment & Toolchain Audit

- **Host OS:** Windows 11 Pro (PowerShell / cmd).
- **Java Development Kit (JDK):** OpenJDK 25.0.3 (JBR bundled inside Android Studio at `C:\Program Files\Android\Android Studio\jbr`).
- **Android SDK:** Installed at `C:\Users\kermou\AppData\Local\Android\Sdk`.
  - Platforms: `android-36.1`, `android-37.0`.
  - Build-Tools: `36.0.0`.
- **Target Android Architecture:**
  - Min SDK: `26` (Android 8.0 Oreo — covers 99%+ of active devices and provides native java.time + Android Keystore).
  - Compile / Target SDK: `35` or `36`.
  - Build System: Gradle with Kotlin DSL (`build.gradle.kts`).
  - Jetpack Compose + Material 3.

---

## 6. Gaps, Risks & Required Backend Changes

### 6.1 Critical Gap: Device-Initiated Pairing Endpoint
- **Current State:**
  `POST /api/devices/confirm-pair` requires `requireAuth, requireRole('manager')`. This was designed for web-initiated pairing where a manager clicks "Confirm" in the browser.
- **Problem:**
  On a fresh Android installation, the mobile device has **no JWT session token yet**. The user opens the app, sees `[ Scan QR Code ]` or `[ Enter Pairing Code ]`, and enters the 6-digit code. The app needs to exchange this code for device registration and credentials.
- **Required Backend Change:**
  Implement a public, rate-limited endpoint:
  ```http
  POST /api/devices/pair
  ```
  - **Request Body:**
    ```json
    {
      "code": "482731",
      "device_name": "Samsung Galaxy S24",
      "device_model": "SM-S928B",
      "app_version": "1.0.0"
    }
    ```
  - **Server Logic:**
    1. Rate-limit pairing attempts by IP / fingerprint (max 5 failed attempts per 15 minutes) to prevent brute-forcing.
    2. Lookup pending device in `paired_devices` where `pairing_code = $1 AND code_expires_at > CURRENT_TIMESTAMP AND status = 'pending'`.
    3. Generate a cryptographically secure 256-bit device token (`dev_tok_...`).
    4. Store `SHA-256(deviceToken)` in `device_token_hash`.
    5. Update device status to `'paired'`, clear `pairing_code` (single-use), and update `last_seen`.
    6. Return `{ success: true, deviceId, deviceToken, pairedAt }`.
    7. Log pairing event to `audit_logs`.

### 6.2 Critical Gap: Device Revocation Enforcement in Middleware
- **Current State:**
  `auth.middleware.ts` only validates user JWT tokens against the `users` table. It does not check device status.
- **Requirement:**
  When a manager clicks "Delete / Revoke" on a device in the web ERP, that device's API requests must be immediately rejected (HTTP 401 `DEVICE_REVOKED`).
- **Required Backend Change:**
  - Add `X-Device-Id` and `X-Device-Token` header verification in `requireAuth` or dedicated device middleware.
  - If device `status === 'revoked'` or record is deleted, reject request with `401 Unauthorized: Device revoked`.

### 6.3 Pairing Code Expiry & Single-Use
- The existing `devicesRouter.post('/generate-pairing-code')` generates a 6-digit code valid for 10 minutes.
- Verified: `code_expires_at` is enforced, but code must be nullified immediately upon first exchange.

---

## 7. Android Project Blueprint (`vectis/`)

To guarantee clean architecture and maintainability, the Android app will be structured as follows:

```text
vectis/
 ├── gradle/
 ├── app/
 │    ├── build.gradle.kts
 │    └── src/main/
 │         ├── AndroidManifest.xml
 │         ├── java/com/vectis/erp/
 │         │    ├── VectisApp.kt
 │         │    ├── MainActivity.kt
 │         │    ├── core/
 │         │    │    ├── network/ (Retrofit, OkHttp, AuthInterceptor, ApiResult)
 │         │    │    ├── security/ (EncryptedPrefs, KeystoreManager, TokenStorage)
 │         │    │    ├── design/ (Theme, Color, Typography, Shape, Components)
 │         │    │    └── util/ (PhoneUtils, DateUtils, CurrencyFormatter)
 │         │    ├── data/
 │         │    │    ├── api/ (VectisApiService, PairingApiService)
 │         │    │    ├── model/ (DTOs matching backend JSON contracts)
 │         │    │    └── repository/ (Repository implementations calling API)
 │         │    ├── domain/
 │         │    │    ├── model/ (Immutable domain entities)
 │         │    │    └── repository/ (Domain interfaces)
 │         │    ├── feature/
 │         │    │    ├── pairing/ (Scan QR, Enter Code, Pairing ViewModel)
 │         │    │    ├── auth/ (Login, Session management)
 │         │    │    ├── dashboard/ (KPI metrics, Recent orders, Top products)
 │         │    │    ├── orders/ (Order list, Filter tabs, Details sheet, Create wizard)
 │         │    │    ├── customers/ (Customer directory, Order history, WhatsApp action)
 │         │    │    ├── inventory/ (Service accounts, Profile slots, License keys)
 │         │    │    ├── alerts/ (7-day expiring list, Expired list, Template compose)
 │         │    │    └── search/ (Global search across entities)
 │         │    └── navigation/ (Type-safe Compose navigation routes)
 │         └── res/
 ├── build.gradle.kts
 ├── settings.gradle.kts
 └── gradle.properties
```

---

## 8. Phase 0 Acceptance & Sign-off

- [x] Existing web ERP architecture reviewed and documented.
- [x] Authoritative PostgreSQL database schema and models mapped.
- [x] All 18 REST endpoints audited for parameters, auth, and roles.
- [x] Android SDK and JDK availability verified on system.
- [x] Critical gaps identified (public pairing endpoint + device revocation check).
- [x] Phase 0 complete. Ready to proceed to **Phase 1: Android Foundation** upon user review.
