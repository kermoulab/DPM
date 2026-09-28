# Web Function & Business Operation Inventory

This document maps all meaningful business functions, client event handlers, calculations, API integrations, and backend business logic in the **DPM Web Application**.

---

## 1. Authentication & Session Operations

| Function Name | Location | Purpose & Business Logic | API & Database Effect |
| :--- | :--- | :--- | :--- |
| `login(credentials)` | `src/api/auth.api.ts` | Authenticates user; validates status `active`; stores JWT token in storage; updates `last_login` in DB. | `POST /api/auth/login` → `users` table |
| `getMe()` | `src/api/auth.api.ts` | Authoritatively fetches current user profile and role from PostgreSQL on every route change or app focus. | `GET /api/auth/me` → `users` table |
| `logout()` | `src/api/auth.api.ts`, `App.tsx` | Revokes server session, clears client token storage, resets memory states. | `POST /api/auth/logout` |
| `updateMyProfile(payload)` | `src/api/auth.api.ts` | Updates user's name, username, email, preferred currency, and changes password if current password matches. | `PUT /api/auth/profile` → `users` table |
| `updatePreferredCurrency(curr)` | `src/api/auth.api.ts` | Updates active user's `preferred_currency` in DB and emits global update. | `PUT /api/auth/currency` → `users.preferred_currency` |
| `changePassword(passwords)` | `src/api/auth.api.ts` | Verifies current password hash and replaces with new salt and argon2/sha256 hash. | `POST /api/auth/change-password` → `users` table |

---

## 2. Dashboard Analytics Operations

| Function Name | Location | Purpose & Business Logic | API & Database Effect |
| :--- | :--- | :--- | :--- |
| `getDashboardStats()` | `src/api/system.api.ts` | Queries PostgreSQL to aggregate financial metrics (revenue, today's revenue, growth %), daily order counts (7-day Mon-Sun), customer acquisition (Jan-Aug), subscription health percentages (active %, expiring 3d %, expired %), category purchase trends by year/metric, recent 5 orders, top selling products (4/page), and inventory turnover. | `GET /api/dashboard/stats` → `orders`, `customers`, `products`, `plans`, `service_accounts`, `service_profiles`, `license_keys` |
| `formatMoney(amount, currency)` | `src/context/CurrencyContext.tsx` | Converts base currency amount to user's preferred currency using exchange rates from `currencies` table and formats with symbol and decimal precision. | Pure client conversion using DB exchange rates |
| `renderPurchaseCategoryChart()` | `src/pages/DashboardView.tsx` | Computes dynamic bar heights and tooltips for monthly category trends based on selected metric (`orders` vs `revenue`) and active year. | Pure UI computation |

---

## 3. Customer Operations

| Function Name | Location | Purpose & Business Logic | API & Database Effect |
| :--- | :--- | :--- | :--- |
| `getCustomers(params)` | `src/api/customers.api.ts` | Fetches customer directory with lifetime spent sum, active orders count, and total orders count. | `GET /api/customers` → `customers` joined with `orders` |
| `getCustomer(id)` | `src/api/customers.api.ts` | Fetches single customer with full order history and related audit logs. | `GET /api/customers/:id` |
| `createCustomer(payload)` | `src/api/customers.api.ts` | Inserts new customer record with name, email, sanitized WhatsApp, and notes. Generates `cust-...` ID. | `POST /api/customers` → `customers`, `audit_logs` |
| `updateCustomer(id, payload)` | `src/api/customers.api.ts` | Updates customer details or toggles status between `active` and `inactive`. Uses optimistic UI updates. | `PUT /api/customers/:id` → `customers`, `audit_logs` |
| `deleteCustomer(id)` | `src/api/customers.api.ts` | Deletes customer if no associated orders exist. If orders exist, backend rejects with HTTP 400. Admin role required. | `DELETE /api/customers/:id` → `customers`, `audit_logs` |
| `sanitizeWhatsAppPhone(phone)` | `src/types.ts` | Cleans phone strings: keeps leading `+`, removes spaces, dashes, letters, and extraneous embedded plus signs. | Pure utility |

---

## 4. Product, Category & Plan Operations

| Function Name | Location | Purpose & Business Logic | API & Database Effect |
| :--- | :--- | :--- | :--- |
| `getProducts(params)` | `src/api/products.api.ts` | Fetches product catalog filtered by category, status, and search query. | `GET /api/products` → `products` |
| `getProduct(id)` | `src/api/products.api.ts` | Fetches product detail with all associated subscription plans and live inventory capacity summary. | `GET /api/products/:id` → `products`, `plans`, `service_accounts`, `license_keys` |
| `createProduct(payload)` | `src/api/products.api.ts` | Creates product with name, brand, description, category ID, fulfillment type, and capability flags (`subscription`, `service_account`, `profiles`, `license_key`, `digital_file`). | `POST /api/products` → `products`, `audit_logs` |
| `updateProduct(id, payload)` | `src/api/products.api.ts` | Updates product metadata, fulfillment parameters, and capability flags. | `PUT /api/products/:id` → `products`, `audit_logs` |
| `deleteProduct(id)` | `src/api/products.api.ts` | Permanently deletes product and cascades plan removal. | `DELETE /api/products/:id` → `products`, `plans`, `audit_logs` |
| `getCategories()` | `src/api/products.api.ts` | Fetches all product categories. | `GET /api/categories` → `categories` |
| `createCategory(payload)` | `src/api/products.api.ts` | Creates single category. Handles bulk creation by splitting newlines and commas. | `POST /api/categories` → `categories`, `audit_logs` |
| `updateCategory(id, payload)` | `src/api/products.api.ts` | Updates category name and description. | `PUT /api/categories/:id` → `categories`, `audit_logs` |
| `deleteCategory(id, mode)` | `src/api/products.api.ts` | Deletes category with mode: `move_to_general` or `unassign_plans`. | `DELETE /api/categories/:id` → `categories`, `products` |
| `getPlans(product_id)` | `src/api/products.api.ts` | Fetches plans for a product. | `GET /api/plans` → `plans` |
| `createPlan(payload)` | `src/api/products.api.ts` | Creates a pricing tier: name, duration, duration unit (`hours`, `days`, `weeks`, `months`, `years`), retail price, supplier cost, currency. | `POST /api/plans` → `plans`, `audit_logs` |
| `updatePlan(id, payload)` | `src/api/products.api.ts` | Updates plan pricing, duration, or supplier cost. | `PUT /api/plans/:id` → `plans`, `audit_logs` |
| `deletePlan(id)` | `src/api/products.api.ts` | Deletes pricing plan. | `DELETE /api/plans/:id` → `plans`, `audit_logs` |
| `calculateDates(plan_id, start_date)` | `src/api/products.api.ts` | Calculates exact projected end date, duration, unit, price, and currency based on calendar rules. | `POST /api/plans/calculate-dates` |

---

## 5. Inventory Operations

| Function Name | Location | Purpose & Business Logic | API & Database Effect |
| :--- | :--- | :--- | :--- |
| `getAccounts(params)` | `src/api/inventory.api.ts` | Lists master service accounts with assigned vs total profile slot counts and masked passwords. | `GET /api/inventory/accounts` → `service_accounts`, `service_profiles` |
| `createAccount(payload)` | `src/api/inventory.api.ts` | Creates encrypted master service account. Encrypts credentials via AES-256-GCM. Auto-creates profile slots (e.g. Profile 1..5). | `POST /api/inventory/accounts` → `service_accounts`, `service_profiles`, `audit_logs` |
| `updateAccount(id, payload)` | `src/api/inventory.api.ts` | Updates account provider, login, password (re-encrypts if provided), capacity, expiry, status, notes. | `PUT /api/inventory/accounts/:id` → `service_accounts`, `audit_logs` |
| `deleteAccount(id)` | `src/api/inventory.api.ts` | Deletes account if assigned profiles == 0. Blocked if assigned profiles > 0. | `DELETE /api/inventory/accounts/:id` → `service_accounts`, `audit_logs` |
| `getAccountProfiles(accountId)` | `src/api/inventory.api.ts` | Fetches profile slots for an account with PIN, assigned customer name, and order ID. | `GET /api/inventory/accounts/:id/profiles` → `service_profiles` |
| `updateProfile(id, payload)` | `src/api/inventory.api.ts` | Updates profile name, PIN code, or status (`available`, `assigned`, `reserved`, `blocked`). | `PUT /api/inventory/profiles/:id` → `service_profiles` |
| `revealCredentials(accountId)` | `src/api/inventory.api.ts` | Authenticates caller and decrypts master login and password in memory using AES-256-GCM. Logs security audit event. | `POST /api/inventory/accounts/:id/reveal-credentials` → `audit_logs` |
| `getLicenses(params)` | `src/api/inventory.api.ts` | Fetches serial license keys with assigned order/customer and status. | `GET /api/inventory/licenses` → `license_keys` |
| `addLicenses(payload)` | `src/api/inventory.api.ts` | Bulk inserts license keys parsed from multiline string or array. | `POST /api/inventory/licenses` → `license_keys`, `audit_logs` |
| `deleteLicense(id)` | `src/api/inventory.api.ts` | Deletes unallocated license key from inventory. | `DELETE /api/inventory/licenses/:id` → `license_keys`, `audit_logs` |

---

## 6. Order Operations

| Function Name | Location | Purpose & Business Logic | API & Database Effect |
| :--- | :--- | :--- | :--- |
| `getOrders(params)` | `src/api/orders.api.ts` | Fetches orders list filtered by status (`active`, `expiring`, `expired`, `all`) with real-time status counts. | `GET /api/orders` → `orders` joined with `customers`, `products`, `plans` |
| `getOrder(id)` | `src/api/orders.api.ts` | Fetches complete order details, fulfillment data, and renewal history. | `GET /api/orders/:id` → `orders`, `order_renewals` |
| `createOrder(payload)` | `src/api/orders.api.ts` | Universal order engine: automatically allocates profile from active service account or unallocated license key, binds customer, calculates dates, updates inventory slot status to `assigned`. | `POST /api/orders` → `orders`, `service_profiles`, `license_keys`, `audit_logs` |
| `updateOrder(id, payload)` | `src/api/orders.api.ts` | Modifies order terms, dates, price, payment status, payment method, or notes. Auto-reconciles status based on new end date. | `PUT /api/orders/:id` → `orders`, `audit_logs` |
| `deleteOrder(id)` | `src/api/orders.api.ts` | Deletes order from database. Blocked if order is active or expiring (must cancel first to unassign assets). Admin role required. | `DELETE /api/orders/:id` → `orders`, `audit_logs` |
| `cancelOrder(id, reason)` | `src/api/orders.api.ts` | Marks order cancelled and releases allocated profile slot or serial key back to inventory. | `POST /api/orders/:id/cancel` → `orders`, `service_profiles`, `license_keys` |
| `renewOrder(id, payload)` | `src/api/orders.api.ts` | Extends subscription: computes new end date based on plan duration. If expired, starts from today; if active/expiring, starts from previous end date. Inserts row into `order_renewals` and increments `renewal_count`. | `POST /api/renewals/:id` → `orders`, `order_renewals`, `audit_logs` |

---

## 7. Alerts & WhatsApp Operations

| Function Name | Location | Purpose & Business Logic | API & Database Effect |
| :--- | :--- | :--- | :--- |
| `getAlerts()` | `src/api/system.api.ts` | Synchronizes subscription statuses in DB then queries expiring orders (< 7 days), expired orders, and low inventory stock. Returns total badge count. | `GET /api/alerts` → `orders`, `service_accounts`, `license_keys` |
| `getWhatsAppTemplates()` | `src/api/system.api.ts` | Fetches notification templates across event types and languages. | `GET /api/whatsapp/templates` → `notification_templates` |
| `saveWhatsAppTemplate(payload)` | `src/api/system.api.ts` | Upserts notification template by `(event_type, language)`. | `POST /api/whatsapp/templates` → `notification_templates`, `audit_logs` |
| `composeWhatsApp(payload)` | `src/api/system.api.ts` | Loads template for order event, interpolates placeholders with customer & fulfillment credentials, cleans phone, generates `wa.me` deep link. | `POST /api/whatsapp/compose` → `orders.whatsapp_contacted_at` |

---

## 8. Devices, System Settings, Team & Audit Operations

| Function Name | Location | Purpose & Business Logic | API & Database Effect |
| :--- | :--- | :--- | :--- |
| `getDevices()` | `src/api/system.api.ts` | Lists paired Android terminals. | `GET /api/devices` → `paired_devices` |
| `generatePairingCode()` | `src/api/system.api.ts` | Generates 6-digit numeric pairing code and QR code data URL; sets 5-minute expiration; creates `pending` device record. | `POST /api/devices/generate-pairing-code` → `paired_devices` |
| `confirmPair(deviceId, name)` | `src/api/system.api.ts` | Validates pairing code, generates device token, sets status to `paired`, wipes pairing code (single-use). | `POST /api/devices/confirm-pair` → `paired_devices` |
| `revokeDevice(deviceId)` | `src/api/system.api.ts` | Revokes terminal. Sets status `revoked` and rejects subsequent device requests with HTTP 401 `X-Device-Revoked`. | `DELETE /api/devices/:id` → `paired_devices` |
| `getSettings()` | `src/api/system.api.ts` | Fetches general business configuration settings. | `GET /api/settings` → `system_settings` |
| `updateSettings(settings)` | `src/api/system.api.ts` | Updates business settings (company name, base currency, support phone, alert thresholds). | `PUT /api/settings` → `system_settings`, `audit_logs` |
| `getCurrencies()` | `src/api/system.api.ts` | Fetches supported currencies and exchange rates. | `GET /api/currencies` → `currencies` |
| `getUsers()` | `src/api/system.api.ts` | Fetches staff users. | `GET /api/users` → `users` |
| `createUser(payload)` | `src/api/system.api.ts` | Creates staff user with username, name, email, password hash, and role (`admin`, `manager`, `agent`, `viewer`). | `POST /api/users` → `users`, `audit_logs` |
| `deleteUser(id)` | `src/api/system.api.ts` | Deletes staff member. Prevented for the last remaining owner/admin. | `DELETE /api/users/:id` → `users`, `audit_logs` |
| `getAuditLogs(params)` | `src/api/system.api.ts` | Fetches paginated audit logs (capped at 30 per page) with entity/action filters. | `GET /api/audit` → `audit_logs` |
| `search(q)` | `src/api/system.api.ts` | Global search across customers, orders, products, and inventory items. | `GET /api/search` → `customers`, `orders`, `products`, `service_accounts`, `license_keys` |
