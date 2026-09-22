# WEB APP FUNCTIONAL INVENTORY — DPM / VECTIS ERP

This document provides a comprehensive, file-by-file audit and catalog of every feature, endpoint, database relationship, business rule, and operational behavior in the existing DPM Digital Product Management web application.

---

## 1. System Architecture & Infrastructure

### 1.1 Technology Stack
- **Backend**: Node.js + Express + TypeScript (`server.ts`)
- **Database**: PostgreSQL with `pg` connection pooling and SSL support (`server/db/`)
- **Frontend**: React 18 + Vite + TypeScript + Tailwind CSS (`src/`)
- **Authentication**: Stateless HMAC-SHA256 JWT tokens with 24-hour expiration, backed by PostgreSQL user role validation and in-memory revocation list (`server/middleware/auth.middleware.ts`)
- **Encryption**: AES-256-GCM for service account master passwords in database (`server/utils/crypto.ts`)
- **Device Security**: Android Reseller Terminal hardware pairing via cryptographically random 6-character single-use pairing codes (`server/routes/devices.ts`, `server/db/repositories/devices.repository.ts`)

### 1.2 User Roles & Hierarchy
- `owner` (Level 5): Full unconditional root authority.
- `admin` (Level 4): Full administrative capabilities; manage team, settings, delete records, view credentials.
- `manager` (Level 3): Manage inventory, view credentials, create/update orders, manage customers, view financial metrics. Cannot delete customers/orders or manage system users.
- `agent` (Level 2): Operational front-desk staff; view catalog, create orders, manage customer contact info, view order receipts. Cannot view unmasked master credentials, delete core entities, or access team/settings.
- `viewer` (Level 1): Read-only observation.

---

## 2. Comprehensive Module Catalog

### 2.1 Authentication & Session (`/api/auth`)
- **Related Files**: `server/routes/auth.ts`, `server/services/auth.service.ts`, `server/db/repositories/users.repository.ts`, `src/pages/Login.tsx`, `src/api/auth.api.ts`
- **Endpoints**:
  - `POST /api/auth/login`: `{ username, password }` -> Returns `{ success: true, token, user }` or 401. Rate-limited to prevent brute-force attacks.
  - `GET /api/auth/me`: Requires Bearer JWT. Returns `{ user: UserDto }`. Re-validates user active status against PostgreSQL.
  - `POST /api/auth/logout`: Revokes current JWT in process memory and returns `{ success: true }`.
  - `POST /api/auth/currency`: `{ currency }` -> Updates `users.preferred_currency` in PostgreSQL and updates session state.
  - `PUT /api/auth/profile`: `{ name, email, currentPassword?, newPassword? }` -> Updates profile info and changes password if current password verifies.
- **Business Rules**:
  - Passwords hashed using PBKDF2/SHA256 with 64-character random salt.
  - Inactive or suspended accounts receive HTTP 401 even with valid JWT.
  - Device token checked on every request via `X-Device-Id`; revoked devices receive HTTP 401 with `X-Device-Revoked: true`.

---

### 2.2 Device Pairing & Management (`/api/devices`)
- **Related Files**: `server/routes/devices.ts`, `server/db/repositories/devices.repository.ts`, `src/pages/DevicesView.tsx`, `server/db/migrations/001_initial_schema.sql`
- **Endpoints**:
  - `GET /api/devices`: List paired devices (`id`, `device_name`, `device_type`, `status`, `last_seen`, `created_at`). Requires `requireRole('admin')`.
  - `POST /api/devices/generate`: Generates cryptographically secure 6-character alphanumeric pairing code valid for 10 minutes. Returns QR code DataURL (`qrDataUrl`), `deviceId`, `pairingCode`, `expiresAt`. Requires `admin`.
  - `POST /api/devices/pair`: Public endpoint with aggressive rate limiting (10 attempts / 15 min). Accepts `{ pairing_code, device_name, device_type }`. Atomically validates code, marks device `paired`, burns `pairing_code` (nullifies immediately to enforce single-use), generates device token, and returns `{ deviceId, deviceToken }`.
  - `DELETE /api/devices/:id`: Revokes device status to `revoked`. Requires `admin`. Subsequent calls from device receive HTTP 401.
- **Business Rules**:
  - Pairing codes are single-use and expire strictly after 10 minutes.
  - No database credentials, JWT secrets, or master passwords are ever returned during pairing.

---

### 2.3 Dashboard (`/api/dashboard`)
- **Related Files**: `server/routes/dashboard.ts`, `server/db/repositories/dashboard.repository.ts`, `src/pages/DashboardView.tsx`
- **Endpoints**:
  - `GET /api/dashboard/stats`: Returns real-time KPI metrics:
    - `revenue`: Total revenue, profit, today revenue, week revenue, month revenue.
    - `subscriptions`: Active subscriptions, expiring within 7 days, expired count.
    - `customers`: Total registered customers, active customers with current orders.
    - `inventory`: Total service account profiles available/total, available license keys.
    - `recentOrders`: Last 5 created orders with customer name, product name, duration, price.
    - `topProducts`: Top selling products ranked by order volume and total revenue.
- **Business Rules**:
  - Synchronizes subscription statuses (`expiring`, `expired`) based on current timestamp before computing aggregates.
  - All financial metrics dynamically respect the user's preferred currency via live exchange rate calculation.

---

### 2.4 Customers (`/api/customers`)
- **Related Files**: `server/routes/customers.ts`, `server/db/repositories/customers.repository.ts`, `src/pages/CustomersView.tsx`, `src/api/customers.api.ts`
- **Endpoints**:
  - `GET /api/customers`: List customers. Supports query params: `search` (ILIKE against name, email, whatsapp), `status` (`active`, `blocked`, `inactive`). Returns customer list with order counts and total spent.
  - `GET /api/customers/:id`: Retrieves full customer record, including order history, active subscriptions, and notes.
  - `POST /api/customers`: `{ name, email?, whatsapp?, notes? }` -> Creates customer. Requires `requireRole('agent')`.
  - `PUT /api/customers/:id`: `{ name, email?, whatsapp?, notes?, status? }` -> Updates customer. Requires `requireRole('agent')`.
  - `DELETE /api/customers/:id`: Deletes customer. Requires `requireRole('admin')`. Blocked if customer has active orders.
- **Business Rules**:
  - WhatsApp phone numbers sanitized via `sanitizeWhatsAppPhone` (strips formatting, enforces single leading `+`).
  - Blocked customers cannot have new orders created.

---

### 2.5 Product Catalog & Plans (`/api/products`, `/api/categories`, `/api/plans`)
- **Related Files**: `server/routes/products.ts`, `server/routes/categories.ts`, `server/routes/plans.ts`, `server/db/repositories/products.repository.ts`, `server/db/repositories/categories.repository.ts`, `server/db/repositories/plans.repository.ts`, `src/pages/ProductsView.tsx`
- **Endpoints**:
  - Categories:
    - `GET /api/categories`: List all categories with product counts.
    - `POST /api/categories`: `{ name, slug, description?, icon? }` (admin/manager).
    - `PUT /api/categories/:id`: `{ name, slug?, description?, status? }` (admin/manager).
    - `DELETE /api/categories/:id`: Deletes category. Can cascade or reassign products.
  - Products:
    - `GET /api/products`: List products. Query params: `category_id`, `search`, `status`. Returns brand, name, capabilities, plan count, in_stock.
    - `GET /api/products/:id`: Retrieves product details, associated plans, and real-time inventory summary (available service account profiles / license keys).
    - `POST /api/products`: `{ name, category_id, brand?, description?, capabilities, fulfillment_type }` (admin/manager).
    - `PUT /api/products/:id`: `{ name, category_id?, brand?, description?, capabilities?, fulfillment_type?, status? }` (admin/manager).
    - `DELETE /api/products/:id`: Deletes product (admin only). Restricted if orders exist.
  - Plans:
    - `GET /api/plans`: List plans (can filter by `product_id`).
    - `POST /api/plans`: `{ product_id, name, duration, duration_unit, price, cost, currency, stock_limit? }` (admin/manager).
    - `PUT /api/plans/:id`: Update plan duration, price, cost, currency, status (admin/manager).
    - `DELETE /api/plans/:id`: Deletes plan (admin only).
- **Business Rules**:
  - Capabilities array dictates behavior: `subscription`, `service_account`, `profiles`, `license_key`, `digital_file`, `automatic_fulfillment`, `manual_fulfillment`.
  - Zero hardcoding of brands (Netflix, Spotify, Gemini, etc. are dynamic DB records).

---

### 2.6 Inventory Bank: Service Accounts & License Keys (`/api/inventory`)
- **Related Files**: `server/routes/inventory.ts`, `server/services/inventory.service.ts`, `server/db/repositories/inventory.repository.ts`, `src/pages/InventoryView.tsx`, `src/api/inventory.api.ts`
- **Endpoints**:
  - Service Accounts:
    - `GET /api/inventory/accounts`: List accounts for a product. Returns masked credentials (`••••••••`), capacity, active/available profile counts, status, expiry date.
    - `POST /api/inventory/accounts`: `{ product_id, provider, login, password, capacity?, expiry_date?, notes? }` -> Encrypts password with AES-256-GCM. Automatically initializes `capacity` service profile slots (`Profile 1`, `Profile 2`, etc.). Requires `manager`.
    - `PUT /api/inventory/accounts/:id`: Updates provider, login, password (re-encrypts), expiry, notes, status. Requires `manager`.
    - `DELETE /api/inventory/accounts/:id`: Deletes account. Rejects with HTTP 400 if any profile is actively assigned to an ongoing order. Requires `manager`.
    - `POST /api/inventory/accounts/:id/reveal`: Decrypts and returns `{ login, password, provider }`. Audited to `audit_logs`. Restricted to `requireRole('manager')`.
  - Service Profiles:
    - `GET /api/inventory/accounts/:id/profiles`: Returns profile slots (`profile_name`, `pin`, `status`, `assigned_customer_id`, `assigned_order_id`).
    - `POST /api/inventory/accounts/:id/profiles`: Adds slot to account.
    - `PUT /api/inventory/profiles/:id`: Updates profile name or PIN.
    - `DELETE /api/inventory/profiles/:id`: Deletes profile (cannot delete if `assigned`).
  - License Keys:
    - `GET /api/inventory/licenses`: List license keys. Query params: `product_id`, `status`.
    - `POST /api/inventory/licenses/bulk`: `{ product_id, keys: string[] }` -> Bulk inserts pool of license keys. Requires `manager`.
    - `DELETE /api/inventory/licenses/:id`: Deletes key. Blocked if assigned to an active order.

---

### 2.7 Orders & Universal Fulfillment Engine (`/api/orders`, `/api/renewals`)
- **Related Files**: `server/routes/orders.ts`, `server/services/order.service.ts`, `server/db/repositories/orders.repository.ts`, `server/routes/renewals.ts`, `src/pages/OrdersView.tsx`, `src/components/OrderBuilderModal.tsx`, `src/components/EditOrderModal.tsx`, `src/components/DeliveryReceiptModal.tsx`
- **Endpoints**:
  - `GET /api/orders`: List orders. Query filters: `status`, `customer_id`, `product_id`, `search`. Returns order items with customer and product joins.
  - `GET /api/orders/:id`: Full order breakdown, including assigned resource (service profile credentials or license key) and renewal history.
  - `POST /api/orders`: Universal Order Creation. Payload:
    `{ customer_id, product_id, plan_id, start_date, payment_method, notes? }`
    - Engine automatically calculates `end_date` based on plan duration and duration unit (`days`, `months`, `years`).
    - Auto-allocates available inventory slot:
      - If service account: claims available profile, marks profile `assigned`, records assignment in `service_profiles`.
      - If license key: claims available license key, marks `assigned`.
    - Saves fulfillment data snapshot inside `fulfillment_data` JSONB.
    - Returns created order.
  - `POST /api/orders/calculate-dates`: `{ plan_id, start_date }` -> Pre-calculates exact `end_date`, price, currency.
  - `PUT /api/orders/:id`: `{ status?, start_date?, end_date?, payment_status?, notes? }` -> Updates order (agent/manager). Reconciles status against dates.
  - `POST /api/orders/:id/renew`: `{ new_end_date?, duration_months?, price? }` -> Extends subscription end date, increments `renewal_count`, records entry in `order_renewals`, logs audit event.
  - `DELETE /api/orders/:id`: Deletes order. Strictly `requireRole('admin')`. Atomically releases assigned profile slot (resets profile to `available`) and assigned license key.

---

### 2.8 Subscription Expiry Alerts & WhatsApp Automation (`/api/alerts`, `/api/whatsapp`)
- **Related Files**: `server/routes/alerts.ts`, `server/routes/whatsapp.ts`, `server/db/repositories/whatsapp.repository.ts`, `src/pages/AlertsView.tsx`, `src/pages/WhatsAppView.tsx`
- **Endpoints**:
  - `GET /api/alerts`: Returns subscriptions expiring within threshold (default 7 days), expired subscriptions, and low-stock product alerts. Auto-syncs statuses first.
  - `GET /api/whatsapp/templates`: Retrieves custom and system notification templates across languages (`en`, `fr`, `ar`, `ru`) and event types (`order_created`, `order_expiring`, `order_expired`).
  - `POST /api/whatsapp/templates`: Saves customized template into `notification_templates`.
  - `POST /api/whatsapp/compose`: `{ order_id, event_type, language }` -> Resolves customer, order, plan, and product variables, applies chosen template, updates `whatsapp_contacted_at`, and returns formatted message text and `https://wa.me/...` deep-link URL.

---

### 2.9 Settings, Team, Currencies & Audit (`/api/settings`, `/api/currencies`, `/api/users`, `/api/audit`)
- **Related Files**: `server/routes/settings.ts`, `server/routes/currencies.ts`, `server/routes/users.ts`, `server/routes/audit.ts`, `src/pages/SettingsView.tsx`
- **Endpoints**:
  - `GET /api/settings`: Retrieves global key-value settings (`company_name`, `base_currency`, `currency_symbol`, `support_phone`, `low_inventory_threshold`, `order_expiry_warning_days`).
  - `POST /api/settings`: Updates global settings. Requires `requireRole('admin')`.
  - `GET /api/currencies`: List supported currencies with exchange rates against base currency.
  - `POST /api/currencies`: Add new currency (`code`, `symbol`, `name`, `exchange_rate`, `decimal_precision`). Requires `admin`.
  - `PUT /api/currencies/:code`: Update exchange rate. Requires `admin`.
  - `GET /api/users`: List staff users (`id`, `username`, `name`, `email`, `role`, `status`, `last_login`). Requires `requireRole('admin')`.
  - `POST /api/users`: Create staff user (`username`, `name`, `email`, `password`, `role`). Requires `admin`.
  - `PUT /api/users/:id`: Edit staff user or reset password. Requires `admin`.
  - `DELETE /api/users/:id`: Deletes staff user. Cannot delete self or last owner. Requires `admin`.
  - `GET /api/audit`: Paginated audit log retrieval. Supports `page`, `limit` (max 30), `action`, `entity`. Auto-purges events older than 30 days. Requires `requireRole('admin')`.

---

### 2.10 Global Unified Search (`/api/search`)
- **Related Files**: `server/routes/search.ts`, `src/components/GlobalSearchModal.tsx`
- **Endpoints**:
  - `GET /api/search?q=`: Cross-entity search executing ILIKE across Customers, Orders, Products, Service Accounts, and License Keys. Returns top 15 unified results with `id`, `title`, `subtitle`, `type`, and navigation `route`.
