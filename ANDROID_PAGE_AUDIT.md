# Android Screen & Module Audit

This document audits the current state of every screen, viewmodel, and module in the **Android companion app** (`vectis`).

---

## 1. Authentication & Pairing Modules

### Android 1.1: Pairing Screen & QR Scanner
- **Files**:
  - `feature/pairing/PairingScreen.kt`
  - `feature/pairing/ScanQrScreen.kt`
  - `feature/pairing/EnterCodeScreen.kt`
  - `feature/pairing/PairingViewModel.kt`
  - `data/api/PairingApiService.kt`
  - `data/repository/PairingRepositoryImpl.kt`
- **Route**: `Screen.Pairing.route`, `Screen.ScanQr.route`, `Screen.EnterCode.route`
- **Status**: **COMPLETE**
- **Evaluation**:
  - CameraX-based QR code scanner with viewfinder overlay.
  - Manual 6-digit numeric pairing code entry with automated uppercase normalization and focus advancement.
  - Generates AES-256 GCM encrypted terminal key in Android Keystore via `SecureStorage`.
  - On pairing success, seamlessly advances to `LoginScreen`.
  - Rate limiting (HTTP 429) and expired code handling implemented cleanly.

### Android 1.2: Login Screen
- **Files**:
  - `feature/auth/LoginScreen.kt`
  - `feature/auth/LoginViewModel.kt`
  - `data/api/AuthApiService.kt`
  - `data/repository/AuthRepositoryImpl.kt`
- **Route**: `Screen.Login.route`
- **Status**: **COMPLETE**
- **Evaluation**:
  - Username & password inputs with validation and password visibility toggle.
  - Authenticates against `POST /api/auth/login`.
  - Stores session token in Android Keystore encrypted preferences.
  - Emits user role and preferred currency immediately to `SecureStorage`.
  - Unpair terminal action provided in dialog with safety confirmation.

---

## 2. Main Navigation & Shell

### Android 2.1: Navigation Host & Shell (`VectisNavGraph.kt`)
- **Files**:
  - `navigation/VectisNavGraph.kt`
  - `navigation/Screen.kt`
- **Status**: **PARTIAL**
- **Existing**:
  - Bottom navigation bar with 5 tabs: Dashboard, Orders, Products, Inventory, Customers.
  - Backstack management with `popUpTo(Screen.Dashboard.route)` and state preservation.
  - Background 10-second polling and `ON_RESUME` lifecycle listener for live sync.
  - Global Search dialog overlay.
  - Automatic session invalidation on HTTP 401 and device revocation.
- **Missing / Parity Gaps**:
  - Navigation drawer or app header actions: When user is on Orders, Products, Inventory, or Customers, there is no way to reach Alerts, Settings, or Global Search without switching back to the Dashboard tab.
  - Bottom bar lacks badge indicator for unread alert count (Web sidebar displays red badge on Alerts).
  - WhatsApp view (Template Studio) is not present as a top-level accessible screen.
  - Topbar does not display the active currency switcher dropdown available on every web page.

---

## 3. Core Feature Screens

### Android 3.1: Dashboard (`DashboardScreen.kt`)
- **Files**:
  - `feature/dashboard/DashboardScreen.kt`
  - `feature/dashboard/DashboardViewModel.kt`
  - `feature/dashboard/DashboardUiState.kt`
  - `data/api/DashboardApiService.kt`
- **Route**: `Screen.Dashboard.route`
- **Status**: **PARTIAL**
- **Existing**:
  - TopAppBar with search trigger, alert bell with badge, settings gear, and manual refresh button.
  - 4 KPI summary cards (Total Revenue, Order Development, Total Customers, Subscription Health).
  - Streamlined Recent Orders list (top 5 with dates and price, text link to Orders).
  - Top Selling Products list (top 4 with avatars, orders count, revenue).
  - Inventory management summary (stock status, turnover, ordered %).
- **Missing / Parity Gaps**:
  - Lacks visual SVG spline wave chart for Order Development daily orders (7-day Mon-Sun).
  - Lacks visual bar chart for Total Customers acquisition (Jan-Aug) and active/inactive/average pills.
  - Lacks visual Donut chart for Subscription Health (Active %, Expiring 3d %, Expired %).
  - Lacks Purchase Analytics monthly category trends comparison chart (with Orders vs Revenue metric switcher and Year selector).
  - Floating action button or quick action for "+ New Order" from the dashboard.

---

### Android 3.2: Orders & Sales (`OrderListScreen.kt`, `OrderDetailScreen.kt`, `CreateOrderScreen.kt`, `EditOrderDialog.kt`)
- **Files**:
  - `feature/orders/OrderListScreen.kt`
  - `feature/orders/OrderDetailScreen.kt`
  - `feature/orders/CreateOrderScreen.kt`
  - `feature/orders/EditOrderDialog.kt`
  - `feature/orders/OrderViewModel.kt`
  - `data/api/OrderApiService.kt`
- **Route**: `Screen.Orders.route`, `Screen.OrderDetail.route`, `Screen.CreateOrder.route`
- **Status**: **PARTIAL**
- **Existing**:
  - Order status filter chips (Active, Expiring, Expired, All).
  - Order search bar.
  - Order cards with status badges, price in preferred currency, dates, customer name, product/plan.
  - OrderDetailScreen with credentials display (license key, service account credentials), renewals list.
  - Edit Order dialog (status, payment status, dates, price, notes).
  - Create Order screen with customer dropdown, product dropdown, plan dropdown, notes.
  - Renew order and cancel order actions.
- **Missing / Parity Gaps**:
  - `CreateOrderScreen` lacks "+ Quick Add Customer" inline action (Web has inline quick customer modal).
  - `CreateOrderScreen` does not invoke `/api/plans/calculate-dates` to calculate end date dynamically based on plan calendar duration.
  - `OrderDetailScreen` and `CreateOrderScreen` lack the full multilingual WhatsApp Delivery Receipt generator (Web has English, French, Arabic, Russian templates with one-click WhatsApp deep link).
  - `OrderListScreen` does not show the real-time status count badges on the filter chips (`Active (12)`, `Expiring (3)`, `Expired (5)`).

---

### Android 3.3: Products & Plans (`ProductsScreen.kt`, `ProductDialogs.kt`)
- **Files**:
  - `feature/products/ProductsScreen.kt`
  - `feature/products/ProductDialogs.kt`
  - `feature/inventory/InventoryViewModel.kt`
  - `data/api/ProductInventoryApiService.kt`
- **Route**: `Screen.Products.route`
- **Status**: **COMPLETE**
- **Evaluation**:
  - Category filter pills horizontally scrollable ("All" + categories from DB).
  - Category Manager dialog: view categories, create category, edit category name/description, view category plans with inline price editor, delete category with move-to-general vs unassign modes.
  - Product Form dialog: create product and edit product with capabilities (Subscription, Service Account, Profiles, License Key, Digital File) and fulfillment type.
  - Manage Plans dialog: list plans per product, add plan with duration, duration unit (`days`, `months`, `years`), price, cost, margin calculation; edit plan; delete plan.
  - Delete product confirmation dialog with cascading checks.
  - Real-time search query filtering across product titles and brands.

---

### Android 3.4: Inventory Bank (`InventoryScreen.kt`, `InventoryDialogs.kt`)
- **Files**:
  - `feature/inventory/InventoryScreen.kt`
  - `feature/inventory/InventoryDialogs.kt`
  - `feature/inventory/InventoryViewModel.kt`
  - `data/api/ProductInventoryApiService.kt`
- **Route**: `Screen.Inventory.route`
- **Status**: **COMPLETE**
- **Evaluation**:
  - Tabs: "Service Accounts" and "License Keys".
  - Service Accounts:
    - Add service account dialog: product selector, provider, login, password, capacity (default 5), expiry date. Auto-creates profile slots.
    - Card: provider, product, masked login, capacity badge (`X/Y assigned`), expiry date, status badge.
    - Master credential reveal: calls `/reveal-credentials` with authenticated endpoint; displays decrypted login, password, and provider with copy buttons.
    - Expandable profile slots list: profile name, PIN code, status (Available, Assigned, Reserved, Blocked), assigned customer name, order ID; edit profile dialog.
    - Edit service account dialog: product, provider, login, password, capacity, expiry, status, notes.
    - Delete service account with validation guard (blocked if assigned profiles > 0).
  - License Keys:
    - Bulk add license keys dialog: product selector, multiline keys input.
    - Card: product name, key preview, status, assigned customer, expiry date, delete action.

---

### Android 3.5: Customers (`CustomerListScreen.kt`, `CustomerDetailScreen.kt`, `CustomerFormDialog.kt`)
- **Files**:
  - `feature/customers/CustomerListScreen.kt`
  - `feature/customers/CustomerDetailScreen.kt`
  - `feature/customers/CustomerFormDialog.kt`
  - `feature/customers/CustomerViewModel.kt`
  - `data/api/CustomerApiService.kt`
- **Route**: `Screen.Customers.route`, `Screen.CustomerDetail.route`
- **Status**: **COMPLETE**
- **Evaluation**:
  - Customer directory with search by name, email, WhatsApp.
  - Customer cards show customer name, WhatsApp, email, active orders count, lifetime spent formatted in preferred currency.
  - Quick WhatsApp button directly on card.
  - Add customer dialog with name, email, WhatsApp, notes.
  - CustomerDetailScreen shows complete profile, contact buttons (Call, WhatsApp, Email), Edit Customer dialog, Delete Customer dialog (blocked if customer has orders), Order History list, and Customer Audit Logs.

---

### Android 3.6: Subscription Alerts & Notifications (`AlertsScreen.kt`)
- **Files**:
  - `feature/alerts/AlertsScreen.kt`
  - `feature/alerts/AlertsViewModel.kt`
  - `data/api/AlertWhatsAppApiService.kt`
- **Route**: `Screen.Alerts.route`
- **Status**: **PARTIAL**
- **Existing**:
  - Tabs: Expiring Soon, Expired Subscriptions, WhatsApp Templates.
  - Expiring orders list with customer WhatsApp, days remaining, expiry date.
  - Expired orders list with customer WhatsApp, days expired.
  - Direct WhatsApp compose button dispatching `order_expiring` and `order_expired` events.
  - Renew order action button.
- **Missing / Parity Gaps**:
  - Renew order action does not show the projected renewal duration feedback banner (showing new start date, new end date, and term) that Web `AlertsView` provides.
  - Dedicated WhatsApp Template Studio: The template editor inside Alerts is minimal. On Web, `WhatsAppView` provides full category tabs (Thank You, Expiring, Expired), 4 language selectors (English, French, Arabic, Russian), clickable variable tags, and live interactive message preview.

---

### Android 3.7: Settings & Administration (`SettingsScreen.kt`, `SettingsDialogs.kt`)
- **Files**:
  - `feature/settings/SettingsScreen.kt`
  - `feature/settings/SettingsDialogs.kt`
  - `feature/settings/SettingsViewModel.kt`
  - `data/api/SettingsApiService.kt`
- **Route**: `Screen.Settings.route`
- **Status**: **COMPLETE**
- **Evaluation**:
  - 4 Tabs: GENERAL, SECURITY, TEAM, AUDIT.
  - General Tab: Company name, base currency, currency symbol, support phone, low inventory threshold, expiry warning days, edit server URL dialog.
  - Security Tab: User profile info (name, username, email, role, preferred currency dropdown), Change Password form (current, new, confirm password with toggle).
  - Team Tab: Staff users directory (name, email, role badge), Add Team Member dialog (username, name, email, password, role), Delete Team Member dialog.
  - Audit Tab: 30-day retention notice, audit log cards (timestamp, user, action, entity, details), pagination controls (Previous, Next, Page X of Y).
  - Unpair terminal and Logout actions.

---

### Android 3.8: Global Search (`GlobalSearchDialog.kt`)
- **Files**:
  - `feature/search/GlobalSearchDialog.kt`
  - `feature/search/SearchViewModel.kt`
  - `data/api/SearchApiService.kt`
- **Status**: **COMPLETE**
- **Evaluation**:
  - Modal search dialog accessible via search icon on Dashboard.
  - Debounced input querying `GET /api/search?q=...`.
  - Displays multi-entity results: Customers, Orders, Products, Service Accounts, License Keys with icons and type badges.
  - Clicking result navigates directly to corresponding detail screen or catalog.
