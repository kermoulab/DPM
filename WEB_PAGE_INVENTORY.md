# Web Page & Screen Inventory

This document provides a comprehensive inventory of all pages, routes, views, tabs, modals, and screen components in the **DPM Web Application** (`Vectis ERP`).

---

## 1. Authentication & Bootstrapping

### Page 1.1: Installer
- **Route**: `/` (rendered conditionally when `isInstalled === false` via `GET /api/install/status`)
- **Purpose**: First-time server bootstrap wizard for PostgreSQL database connection, automated schema migrations, initial admin user creation, and organization defaults.
- **Web Component**: `src/pages/Installer.tsx`
- **Related Components**: N/A (Self-contained 5-step wizard)
- **API Endpoints**:
  - `GET /api/install/status`
  - `POST /api/install/test-connection`
  - `POST /api/install/configure-db`
  - `POST /api/install/run-migrations`
  - `POST /api/install/create-admin`
  - `POST /api/install/finalize`
- **Database Tables**: `schema_migrations`, `users`, `system_settings`, `currencies`
- **Permissions / Roles**: Public during installation state; locked once installed.
- **CRUD Operations**: Create system configuration, apply database migrations, create root admin.
- **Validation**:
  - Database URL: PostgreSQL connection URI format validation.
  - Admin: Username (min 3 chars), email (RFC 5322 regex), password (min 6 chars, confirmed).
  - Business: Company name, base currency (3-letter ISO), support phone.
- **Business Rules**: Installer self-locks immediately upon finalization. Further requests return HTTP 400 `already_installed`.
- **Dialogs / Modals**: None.
- **Audit Events**: `INSTALL_COMPLETED`

---

### Page 1.2: Login
- **Route**: `/login` (rendered when `isInstalled === true` and no active session token exists)
- **Purpose**: Authenticates staff and administrative users via username and password.
- **Web Component**: `src/pages/Login.tsx`
- **API Endpoints**:
  - `POST /api/auth/login`
- **Database Tables**: `users`
- **Permissions / Roles**: Public
- **Validation**: Username required, password required.
- **Business Rules**:
  - Returns HMAC-SHA256 session token and authoritative user profile.
  - Verifies user status is `active`. Inactive/suspended accounts receive HTTP 401.
  - Updates `last_login` timestamp in `users` table.
- **Audit Events**: `LOGIN` (records user ID, username, client IP).

---

## 2. Main Navigation Views

### Page 2.1: Dashboard View
- **Route**: `activeTab === 'dashboard'` (Default view upon login)
- **Purpose**: Centralized operational cockpit providing real-time ACID metrics, financial performance, daily order trends, customer growth, subscription health, purchase category analytics, recent orders, top-selling products, and inventory stock turnover.
- **Web Component**: `src/pages/DashboardView.tsx`
- **Related Components**: `Sidebar.tsx`, `Topbar.tsx`, `OrderBuilderModal.tsx`
- **API Endpoints**:
  - `GET /api/dashboard/stats`
  - `GET /api/alerts`
  - `GET /api/currencies`
- **Database Tables**: `orders`, `customers`, `products`, `plans`, `service_accounts`, `service_profiles`, `license_keys`, `categories`, `currencies`
- **Permissions / Roles**: Accessible to all authenticated roles (`owner`, `admin`, `manager`, `agent`, `viewer`).
- **Cards & Data Visualizations**:
  1. **Total Revenue Card**: Formatted currency amount, % revenue growth against previous period, revenue recorded today.
  2. **Order Development Card**: Daily order counts across 7 days (Mon-Sun), total orders count, dynamic SVG spline wave chart with linear gradient fill.
  3. **Total Customers Card**: Total registered count, 8-month customer acquisition bar chart (Jan-Aug), active count badge, inactive/blocked count badge, average orders per customer with trend arrow.
  4. **Subscription Health Card**: Interactive SVG Donut chart displaying Active %, Expiring 3-day %, and Expired % with center percentage; legend with 3 distinct color states; quick "View Alerts" navigation link.
  5. **Purchase Analytics Card**: Monthly category trends multi-bar chart comparing top 5 product categories; metric toggle (Orders vs Revenue); year selector (e.g. 2025 vs 2026); top category legend pills with color dots and percentages.
  6. **Recent Orders Section**: Table showing top 5 most recent orders (Order/Product name, Subscription term `YYYY-MM-DD -> YYYY-MM-DD` with calendar icon, price formatted in transaction currency); "View Orders" link.
  7. **Top Selling Products Section**: Paginated list (4 per page) with product avatar initial, title, slug, brand badge, total order count, total revenue.
  8. **Inventory Management Card**: Stock status %, turnover rate %, ordered %; 3 progress bars (Active Subscriptions %, Assigned Profiles %, Unallocated Keys %); "View Bank" navigation link.
- **Actions**:
  - "+ New Order" quick action button opens `OrderBuilderModal`.
  - Filter category monthly trends by Year and Metric (Orders/Revenue).
  - Paginate Top Selling Products.
- **Audit Events**: Read-only analytics view.

---

### Page 2.2: Orders & Sales View
- **Route**: `activeTab === 'orders'`
- **Purpose**: Lifecycle order management, subscription fulfillment tracking, real-time status transitions, renewal processing, WhatsApp customer communications, and receipt generation.
- **Web Component**: `src/pages/OrdersView.tsx`
- **Related Components**: `EditOrderModal.tsx`, `OrderBuilderModal.tsx`, `DeliveryReceiptModal.tsx`, `PortalDropdown.tsx`
- **API Endpoints**:
  - `GET /api/orders?status=...&search=...`
  - `GET /api/orders/:id`
  - `POST /api/orders`
  - `PUT /api/orders/:id`
  - `DELETE /api/orders/:id`
  - `POST /api/renewals/:id`
- **Database Tables**: `orders`, `order_renewals`, `customers`, `products`, `plans`, `service_accounts`, `service_profiles`, `license_keys`
- **Permissions / Roles**:
  - View Orders: All authenticated roles.
  - Create Order: `owner`, `admin`, `manager`, `agent`.
  - Edit Order: `owner`, `admin`, `manager`, `agent`.
  - Renew Order: `owner`, `admin`, `manager`, `agent`.
  - Delete Order: `owner`, `admin` only (enforced independently on backend).
- **Status Tabs**:
  - `active` (Active subscriptions)
  - `expiring` (Expiring soon - within 7 days)
  - `expired` (Expired subscriptions)
  - `all` (All orders)
  - Also displays badges with real-time counts per status tab.
- **Table Columns**:
  - Order Number (`#ord-...`)
  - Customer (Name, WhatsApp number / Email)
  - Product & Plan (Product name, plan name)
  - Subscription Term (Start date -> End date, renewal badge `Renewed Xx`)
  - Status (Color-coded badge: Active, Expiring, Expired, Pending, Cancelled, Completed)
  - Price (Formatted in order currency)
  - Actions (3-dots contextual action dropdown)
- **Contextual Actions (3-Dots Menu)**:
  1. **View Order & Receipt**: Opens `DeliveryReceiptModal` with decrypted access credentials, order receipt details, and WhatsApp message builder.
  2. **Edit Order**: Opens `EditOrderModal` allowing edits to Customer, Product, Plan, Start Date, End Date, Price, Payment Status, Payment Method, Status, and Notes.
  3. **Contact via WhatsApp**: Opens WhatsApp delivery receipt composer.
  4. **Renew Subscription**: Calls `POST /api/renewals/:id`, extends subscription duration, creates audit log and renewal history, auto-updates order end date.
  5. **Delete Order**: Permanently removes order. Restricted if status is `active` or `expiring` (requires order cancellation/unassignment first).
- **Search & Highlighting**:
  - Responds to `highlightId` from global search: smoothly scrolls row into center view and applies pulsing border highlight.
- **Audit Events**: `CREATE_ORDER`, `UPDATE_ORDER`, `RENEW_ORDER`, `DELETE_ORDER`.

---

### Page 2.3: Products & Plans View
- **Route**: `activeTab === 'products'`
- **Purpose**: Product catalog administration, category taxonomy, capabilities configuration (subscription, service account, profiles, license key, digital asset), and multi-tier pricing plan management.
- **Web Component**: `src/pages/ProductsView.tsx`
- **Related Components**: `PortalDropdown.tsx`
- **API Endpoints**:
  - `GET /api/products`
  - `GET /api/products/:id`
  - `POST /api/products`
  - `PUT /api/products/:id`
  - `DELETE /api/products/:id`
  - `GET /api/categories`
  - `POST /api/categories`
  - `PUT /api/categories/:id`
  - `DELETE /api/categories/:id?mode=...`
  - `GET /api/categories/:id/plans`
  - `GET /api/plans?product_id=...`
  - `POST /api/plans`
  - `PUT /api/plans/:id`
  - `DELETE /api/plans/:id`
  - `POST /api/plans/calculate-dates`
- **Database Tables**: `products`, `categories`, `plans`, `service_accounts`, `license_keys`
- **Permissions / Roles**:
  - View Products/Plans: All roles.
  - Create/Update/Delete Product: `owner`, `admin`, `manager`.
  - Create/Update/Delete Category: `owner`, `admin`, `manager`.
  - Create/Update/Delete Plan: `owner`, `admin`, `manager`.
- **Features & UI Elements**:
  - **Category Filter Pills**: "All" + horizontal pill list of all categories in DB.
  - **Add Category Button**: Opens modal for single or bulk category creation (delimited by comma or newline).
  - **Manage Categories Button & Drawer**:
    - Lists all categories with product counts.
    - Edit category name, slug, description.
    - Category Plans viewer with inline price editor.
    - Add plan directly to a category.
    - Delete Category modal with 2 deletion modes: (A) Move products to General category, or (B) Delete category and unassign associated products.
  - **Add Product Button & Modal**:
    - Product Name, Category dropdown, Brand/Vendor, Description.
    - Capabilities toggles: Subscription, Service Account, Profiles, License Key, Digital Asset, Manual / Automatic fulfillment.
  - **Product Cards Grid**:
    - Product title, slug, brand badge, category badge, status badge.
    - Capability badges (Subscription, Service Account, Profiles, Serial Key).
    - Plans list preview with duration, price, and margin calculation.
    - Inventory capacity & slot availability summary.
    - 3-dots action menu:
      - **Edit Product**: Edit details, capabilities, fulfillment type, status.
      - **Manage Plans**: Modal displaying all plans for this product; add new plan (name, duration, duration unit: days/months/years, price, cost); inline edit plan price/cost; delete plan.
      - **Delete Product**: Deletes product from DB.
- **Search & Highlighting**:
  - Responds to `highlightId`: scrolls target product card into view with pulsing blue ring.
- **Audit Events**: `CREATE_PRODUCT`, `UPDATE_PRODUCT`, `DELETE_PRODUCT`, `CREATE_CATEGORY`, `UPDATE_CATEGORY`, `DELETE_CATEGORY`, `CREATE_PLAN`, `UPDATE_PLAN`, `DELETE_PLAN`.

---

### Page 2.4: Inventory Bank View
- **Route**: `activeTab === 'inventory'`
- **Purpose**: Encrypted service account management, multi-profile allocation tracking, master credential reveal, and bulk serial license key pools.
- **Web Component**: `src/pages/InventoryView.tsx`
- **Related Components**: `PortalDropdown.tsx`
- **API Endpoints**:
  - `GET /api/inventory/accounts`
  - `POST /api/inventory/accounts`
  - `PUT /api/inventory/accounts/:id`
  - `DELETE /api/inventory/accounts/:id`
  - `GET /api/inventory/accounts/:id/profiles`
  - `PUT /api/inventory/profiles/:id`
  - `POST /api/inventory/accounts/:id/reveal-credentials`
  - `GET /api/inventory/licenses`
  - `POST /api/inventory/licenses`
  - `DELETE /api/inventory/licenses/:id`
- **Database Tables**: `service_accounts`, `service_profiles`, `license_keys`, `products`, `customers`, `orders`
- **Permissions / Roles**:
  - View Inventory: All roles.
  - Reveal Master Credentials: `owner`, `admin`, `manager` (audited).
  - Add/Edit/Delete Accounts: `owner`, `admin`, `manager`.
  - Add/Delete Licenses: `owner`, `admin`, `manager`.
- **Sub-Tabs**:
  1. **Service Accounts**:
     - "+ Add Service Account" button: Product selector, Provider (e.g. Netflix, Spotify), Login, Password, Capacity (slots count, default 5), Expiry date. Auto-creates profile slots.
     - Table / Cards: Product & Provider, masked login (`****`), Capacity badge (e.g. `2/5 assigned`), Expiry date, Status badge (`active`, `suspended`, `expired`), Notes.
     - **Reveal Credentials Action**: Calls authenticated `/reveal-credentials` endpoint; displays modal with decrypted login, password, and provider with Copy buttons.
     - 3-dots action menu:
       - **View/Manage Profiles**: Opens modal listing profile slots (Profile Name, PIN, Status: Available/Assigned/Reserved/Blocked, Assigned Customer, Order ID). Edit profile inline.
       - **Edit Service Account**: Edit product, provider, login, optional password change, capacity, expiry, status, notes.
       - **Delete Service Account**: Blocked if account has assigned profiles > 0.
  2. **License Keys**:
     - "+ Bulk Add License Keys" button: Product selector, bulk keys textarea (paste multiple serial codes separated by newline or comma).
     - Table / Cards: Product name, key preview, Status badge (`available`, `assigned`, `expired`, `blocked`), Assigned Customer, Expiry date, Added timestamp.
     - Delete License Key button.
- **Search & Highlighting**:
  - Automatically switches to corresponding tab (`accounts` or `licenses`) and scrolls highlighted account/license row into view.
- **Audit Events**: `REVEAL_CREDENTIALS` (logged with security warning), `CREATE_SERVICE_ACCOUNT`, `UPDATE_SERVICE_ACCOUNT`, `DELETE_SERVICE_ACCOUNT`, `ADD_LICENSE_KEYS`, `DELETE_LICENSE_KEY`.

---

### Page 2.5: Customers View
- **Route**: `activeTab === 'customers'`
- **Purpose**: Customer directory, contact channels (WhatsApp, Email), active subscription counts, lifetime spent tracking, and customer order management.
- **Web Component**: `src/pages/CustomersView.tsx`
- **Related Components**: `PortalDropdown.tsx`
- **API Endpoints**:
  - `GET /api/customers?search=...&status=...`
  - `GET /api/customers/:id`
  - `POST /api/customers`
  - `PUT /api/customers/:id`
  - `DELETE /api/customers/:id`
- **Database Tables**: `customers`, `orders`, `audit_logs`
- **Permissions / Roles**:
  - View Customers: All roles.
  - Add Customer: `owner`, `admin`, `manager`, `agent`.
  - Edit Customer: `owner`, `admin`, `manager`, `agent`.
  - Delete Customer: `owner`, `admin` only (rejected with HTTP 403 for agents; blocked if orders exist).
- **Features & UI Elements**:
  - Customer count header badge.
  - "+ Add Customer" button & modal: Name (required), Email (optional), WhatsApp (optional), Notes.
  - Real-time search input (filters by name, email, WhatsApp).
  - Customers table:
    - Customer Avatar with initial, Full Name, Joined date.
    - Contact Details (WhatsApp with mono font, Email).
    - Active / Total Orders ratio (`2 / 5`).
    - Lifetime Spent formatted with currency.
    - Status badge (`Active` green pill vs `Deactivated` slate pill).
    - 3-dots action menu:
      - **Edit Customer**: Edit Name, Email, WhatsApp, Notes, Status.
      - **Deactivate / Activate**: One-click status toggle.
      - **New Order**: Opens `OrderBuilderModal` with this customer preselected.
      - **Delete Customer**: Confirmation dialog (blocked with error message if customer has orders).
- **Search & Highlighting**:
  - Responds to `highlightId`: scrolls target customer row into view with pulsing blue outline.
- **Audit Events**: `CREATE_CUSTOMER`, `UPDATE_CUSTOMER`, `DELETE_CUSTOMER`.

---

### Page 2.6: Alerts View & Action Center
- **Route**: `activeTab === 'alerts'` (also accessible via Topbar notification bell as `AlertsDrawer.tsx`)
- **Purpose**: Real-time notification center monitoring expiring subscriptions (within 7 days), expired subscriptions, and low inventory stock; dispatching multilingual WhatsApp reminders; executing one-click subscription renewals.
- **Web Component**: `src/pages/AlertsView.tsx` and `src/components/AlertsDrawer.tsx`
- **API Endpoints**:
  - `GET /api/alerts`
  - `POST /api/renewals/:id`
  - `POST /api/whatsapp/compose`
- **Database Tables**: `orders`, `customers`, `products`, `plans`, `service_accounts`, `license_keys`, `notification_templates`
- **Permissions / Roles**: All roles can view alerts; renewals require `agent` or higher.
- **Tabs**:
  - `all` (All active alerts)
  - `expiring` (Expiring soon)
  - `expired` (Expired subscriptions)
- **Features & UI Elements**:
  - Badge counter showing total active alerts.
  - **Expiring Subscriptions Card**:
    - Customer name, WhatsApp number, Product & Plan, Days remaining, Expiry date.
    - "Send WhatsApp Reminder" action button (formats message using `order_expiring` template and opens WhatsApp URL).
    - "Renew Subscription" action button (calls `/api/renewals/:id`, displays projected renewal start/end date and duration feedback banner).
  - **Expired Subscriptions Card**:
    - Customer name, WhatsApp, Product, Expiration date, Days expired.
    - "Send Follow-up WhatsApp" action button (`order_expired` template).
    - "Renew Subscription" action button.
  - Low inventory & service account capacity warnings.
- **Audit Events**: `RENEW_ORDER`, `COMPOSE_WHATSAPP`.

---

### Page 2.7: WhatsApp View (Template Studio)
- **Route**: `activeTab === 'whatsapp'`
- **Purpose**: Multilingual WhatsApp message template management, dynamic parameter tags interpolation, and live customer message preview.
- **Web Component**: `src/pages/WhatsAppView.tsx`
- **API Endpoints**:
  - `GET /api/whatsapp/templates`
  - `POST /api/whatsapp/templates`
  - `DELETE /api/whatsapp/templates/:id`
- **Database Tables**: `notification_templates`
- **Permissions / Roles**: `owner`, `admin`, `manager` to edit templates; all roles to read.
- **Template Categories**:
  1. `order_created` ("Thank You & Delivery Receipt")
  2. `order_expiring` ("Renewal Reminder")
  3. `order_expired` ("Expired Follow-up")
- **Languages**: English (`en`), French (`fr`), Arabic (`ar`), Russian (`ru`).
- **Template Variables Supported**:
  - `{customer_name}`, `{product_name}`, `{plan_name}`, `{order_id}`, `{start_date}`, `{end_date}`, `{days_remaining}`, `{days_expired}`, `{credentials}`
- **Features**:
  - Variable tag pills (click to insert into cursor position).
  - Live interactive preview card displaying interpolated message with realistic sample data.
  - "Save Template to Database" button.
  - "Reset to Default" button.
- **Audit Events**: `UPDATE_WHATSAPP_TEMPLATE`.

---

### Page 2.8: Android Pairing & Devices View
- **Route**: `activeTab === 'devices'`
- **Purpose**: Mobile terminal management, secure one-time pairing code generation, QR code scanning, and device access revocation.
- **Web Component**: `src/pages/DevicesView.tsx`
- **API Endpoints**:
  - `GET /api/devices`
  - `POST /api/devices/generate-pairing-code`
  - `POST /api/devices/confirm-pair`
  - `DELETE /api/devices/:id`
- **Database Tables**: `paired_devices`, `users`
- **Permissions / Roles**: `owner`, `admin` only.
- **Features**:
  - List of paired terminals: Device name, device type (`android`), status (`pending`, `paired`, `revoked`), last seen timestamp, paired by user, paired date.
  - "+ Pair New Device" button:
    - Calls `POST /api/devices/generate-pairing-code`.
    - Displays 6-digit numeric pairing code.
    - Displays QR Code data URL.
    - Expiration countdown timer (5 minutes).
    - Real-time polling detects when the Android device finishes pairing and automatically closes modal with success feedback.
  - Revoke / Delete device button: Immediately invalidates terminal credentials (next Android request receives HTTP 401 with `X-Device-Revoked: true`).
- **Audit Events**: `GENERATE_PAIRING_CODE`, `PAIR_DEVICE`, `REVOKE_DEVICE`.

---

### Page 2.9: Settings View
- **Route**: `activeTab === 'settings'` (and `activeTab === 'users'` mapping to `initialTab="team"`)
- **Purpose**: Multi-tab administrative center covering user profile & password security, general business parameters, staff user management, and the system audit trail.
- **Web Component**: `src/pages/SettingsView.tsx`
- **API Endpoints**:
  - `GET /api/auth/me`
  - `PUT /api/auth/profile`
  - `PUT /api/auth/currency`
  - `POST /api/auth/change-password`
  - `GET /api/settings`
  - `PUT /api/settings`
  - `GET /api/currencies`
  - `GET /api/users`
  - `POST /api/users`
  - `PUT /api/users/:id`
  - `DELETE /api/users/:id`
  - `GET /api/audit?page=...&limit=...`
- **Database Tables**: `users`, `system_settings`, `currencies`, `audit_logs`
- **Permissions / Roles**:
  - Profile tab: All authenticated users.
  - General Settings: `owner`, `admin`.
  - Team Users: `owner`, `admin`.
  - Audit Trail: `owner`, `admin`.
- **Sub-Tabs**:
  1. **Profile Tab (`profile`)**:
     - Name, Username, Email, Role (read-only), Preferred Currency dropdown.
     - Change Password: Current password, New password, Confirm password (with show/hide toggles).
     - Save Profile -> `PUT /api/auth/profile`.
  2. **General Tab (`general`)**:
     - Company Name (`company_name`)
     - Base Currency & Currency Symbol (`base_currency`, `currency_symbol`)
     - Support Phone / WhatsApp (`support_phone`)
     - Low Inventory Alert Threshold (`low_inventory_threshold`)
     - Order Expiry Warning Days (`order_expiry_warning_days`)
     - Save Settings -> `PUT /api/settings`.
  3. **Team Users Tab (`team`)**:
     - Table of staff members: Avatar, Full Name, Username, Email, Role badge (`owner`, `admin`, `manager`, `agent`, `viewer`), Joined Date.
     - "+ Add Team Member" button & modal: Username, Full Name, Email, Temporary Password, Role dropdown.
     - Delete User button with confirmation dialog -> `DELETE /api/users/:id`.
  4. **Audit Trail Tab (`audit`)**:
     - 30-day retention notice banner.
     - Table: Timestamp (`YYYY-MM-DD HH:mm:ss`), User & Role, Action (`CREATE_ORDER`, `LOGIN`, `UPDATE_CUSTOMER`, etc.), Entity (`order`, `customer`, `service_account`, etc.), Entity ID, IP Address, Details JSON inspector.
     - Pagination controls: Previous, Next, Page X of Y, total events count (capped at 30 events per page).
- **Audit Events**: `UPDATE_PROFILE`, `UPDATE_SETTINGS`, `CREATE_USER`, `DELETE_USER`.

---

## 3. Global Overlays & Modals

### Modal 3.1: Global Search Modal
- **Trigger**: `Ctrl+K` / `Cmd+K` keyboard shortcut, or clicking search input in Topbar.
- **Component**: `src/components/GlobalSearchModal.tsx`
- **API Endpoint**: `GET /api/search?q=...`
- **Features**:
  - Debounced input searching across Customers, Orders, Products, Service Accounts, and License Keys.
  - Displays icon, entity title, subtitle, and entity type badge.
  - Pressing Escape closes modal.
  - Clicking any result navigates to the target tab and triggers auto-scroll and highlight (`highlightId`).

### Modal 3.2: Universal Order Builder Modal
- **Trigger**: "+ New Order" button in Sidebar, Dashboard, OrdersView, or Customer action menu.
- **Component**: `src/components/OrderBuilderModal.tsx`
- **API Endpoints**:
  - `GET /api/customers?status=active`
  - `GET /api/products?status=active`
  - `GET /api/products/:id`
  - `POST /api/plans/calculate-dates`
  - `POST /api/customers` (inline quick create)
  - `POST /api/orders`
- **Features**:
  - Step 1: Customer Selection (searchable dropdown + "+ Quick Add Customer" inline form).
  - Step 2: Product & Plan Selection (product dropdown, plan selector, dynamic calculation of start/end dates via `/api/plans/calculate-dates`, inventory summary check).
  - Step 3: Terms & Payment (start date, payment method: `cash`, `transfer`, `card`, `crypto`, notes).
  - Dynamic fulfillment allocation: automatically assigns profile from active service account or serial key.
  - On submit: creates order, invalidates dashboard metrics, and automatically launches `DeliveryReceiptModal`.

### Modal 3.3: Delivery Receipt Modal
- **Trigger**: Triggered automatically upon order creation, or clicking "View Order & Receipt" from order actions menu.
- **Component**: `src/components/DeliveryReceiptModal.tsx`
- **API Endpoint**: `POST /api/whatsapp/compose`
- **Features**:
  - Displays customer name, order number, product name, duration, active end date, price.
  - Displays access credentials (license key or login, password, profile, PIN).
  - Multilingual WhatsApp delivery message generator (EN, FR, AR, RU).
  - Phone input with WhatsApp number sanitation.
  - "Send via WhatsApp" button (`https://wa.me/...`).
  - Copy receipt / credentials buttons with visual checkmark feedback.

### Modal 3.4: Edit Order Modal
- **Trigger**: "Edit Order" action from Orders table.
- **Component**: `src/components/EditOrderModal.tsx`
- **API Endpoint**: `PUT /api/orders/:id`
- **Features**:
  - Customer selection, Product selection, Plan selection.
  - Start Date and End Date inputs with auto-reconciliation of status (`active`, `expiring`, `expired`).
  - Price, Payment Status (`paid`, `pending`, `refunded`), Payment Method (`cash`, `transfer`, `card`, `crypto`).
  - Order status toggle, Notes textarea.
  - Optimistic in-place update with rollback on failure.
