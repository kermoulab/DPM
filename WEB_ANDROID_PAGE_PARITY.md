# Web vs. Android Complete Feature Parity Matrix

This parity matrix maps every functional capability between the **DPM Web Application** and the **Android Companion App** (`vectis`).

---

## Parity Matrix

| Domain / View | Web Feature | Android Feature | Status | Notes / Plan |
| :--- | :--- | :--- | :--- | :--- |
| **Auth** | Staff Login (Username & Password) | Staff Login with Keystore Token | **COMPLETE** | Uses `POST /api/auth/login`, stores AES-256 GCM token |
| **Auth** | Authoritative `/api/auth/me` on startup/resume | Live Lifecycle `ON_RESUME` & periodic poll | **COMPLETE** | Syncs user profile, role, and preferred currency |
| **Auth** | Session Invalidation on 401 | Interceptor wipes Keystore token & navigates | **COMPLETE** | Prevents loop, returns to Login/Pairing |
| **Auth** | Device Revocation (`X-Device-Revoked`) | Device revoked event navigates to Pairing | **COMPLETE** | Real-time session termination |
| **Pairing** | One-time 6-digit code generation | Manual code entry with auto-focus | **COMPLETE** | Uses `POST /api/devices/confirm-pair` |
| **Pairing** | QR Code display & expiration timer | CameraX live viewfinder QR scanner | **COMPLETE** | Auto-parses JSON / token payload |
| **Pairing** | Revoke paired terminal | Unpair device in Settings with confirm dialog | **COMPLETE** | Deletes Keystore credentials |
| **Shell** | 9-item Navigation sidebar with badges | 5-item Bottom Bar | **PARTIAL** | Need access to Alerts & Settings from all screens |
| **Shell** | Global Currency switcher in Topbar | Preferred currency in Settings | **PARTIAL** | Add quick currency switcher in top bar or profile |
| **Shell** | Notification Bell with live count | Bell only on Dashboard | **PARTIAL** | Add badge count on alerts tab/topbar globally |
| **Shell** | Global `Ctrl+K` Search | Search Dialog on Dashboard | **COMPLETE** | Queries `/api/search`, navigates to entities |
| **Dashboard** | Total Revenue & Growth % | Total Revenue KPI card with preferred currency | **COMPLETE** | Displays formatted currency |
| **Dashboard** | Order Development Spline Wave Chart | Simple text count KPI card | **PARTIAL** | Implement 7-day spline wave chart in Compose |
| **Dashboard** | Customer Acquisition Bar Chart | Simple text count KPI card | **PARTIAL** | Implement monthly acquisition bar chart |
| **Dashboard** | Subscription Health Donut Chart | Simple text count KPI card | **PARTIAL** | Implement 3-segment SVG/Canvas Donut chart |
| **Dashboard** | Purchase Analytics Category Trends | Missing on Android | **PARTIAL** | Implement category trends chart with metric toggle |
| **Dashboard** | Recent Orders (5 items with dates & price) | Recent Orders card (top 5 with dates & price) | **COMPLETE** | Clean layout with "View Orders" link |
| **Dashboard** | Top Selling Products (paginated) | Top Selling Products card (top 4 items) | **COMPLETE** | Shows name, brand, orders, revenue |
| **Dashboard** | Inventory Turnover & Progress Bars | Inventory Turnover card with metrics | **COMPLETE** | Shows Stock status, turnover, ordered % |
| **Dashboard** | Quick "+ New Order" action | FAB in Orders tab | **PARTIAL** | Add quick New Order action to Dashboard |
| **Orders** | Status Filter Tabs with live counts | Status Filter Chips (Active/Expiring/Expired) | **PARTIAL** | Add badge counts to filter chips |
| **Orders** | Orders List (Number, Customer, Dates, Price) | Order cards with full metadata | **COMPLETE** | Shows formatted price, dates, status |
| **Orders** | Edit Order (Dates, Price, Status, Notes) | Edit Order Dialog | **COMPLETE** | Uses `PUT /api/orders/:id` |
| **Orders** | Delete Order (Restricted for active/expiring) | Delete Order with restriction checks | **COMPLETE** | Blocks deletion if active/expiring |
| **Orders** | Renew Subscription (Extends dates) | Renew Order Dialog with duration | **COMPLETE** | Uses `POST /api/renewals/:id` |
| **Orders** | Create Order (Customer, Product, Plan) | Create Order Screen | **COMPLETE** | Allocates profile/key automatically |
| **Orders** | Inline Quick Add Customer in Order Builder | Missing in Create Order Screen | **PARTIAL** | Add "+ Quick Add Customer" dialog |
| **Orders** | Dynamic `/api/plans/calculate-dates` | Client-side date calculation | **PARTIAL** | Call `/api/plans/calculate-dates` for exact dates |
| **Orders** | Multilingual WhatsApp Delivery Receipt | Simple WhatsApp action | **PARTIAL** | Add EN/FR/AR/RU receipt generator |
| **Products** | Category filter pills | Category filter pills horizontally scrollable | **COMPLETE** | Filter by All or specific category |
| **Products** | Add Category (single & bulk) | Category Manager dialog | **COMPLETE** | Uses `POST /api/categories` |
| **Products** | Manage Categories (Edit, plans, delete modes) | Full Category Manager dialog | **COMPLETE** | Supports `move_to_general` / `unassign_plans` |
| **Products** | Add Product (Capabilities & fulfillment) | Product Form Dialog | **COMPLETE** | Supports subscription, accounts, keys, files |
| **Products** | Edit Product | Product Form Dialog | **COMPLETE** | Uses `PUT /api/products/:id` |
| **Products** | Delete Product | Delete confirmation dialog | **COMPLETE** | Uses `DELETE /api/products/:id` |
| **Products** | Manage Plans (Duration, Unit, Price, Cost) | Manage Plans Dialog per product | **COMPLETE** | Add, edit, delete pricing tiers |
| **Inventory** | Service Accounts List (Masked creds, capacity) | Service Accounts cards | **COMPLETE** | Shows `X/Y assigned` slots, provider, login |
| **Inventory** | Reveal Master Credentials (AES-256 decrypted) | Reveal Credentials action with Copy | **COMPLETE** | Uses `POST /api/inventory/accounts/:id/reveal` |
| **Inventory** | View/Manage Profile Slots (PIN, status) | Expandable profile slots with edit dialog | **COMPLETE** | Available, assigned, reserved, blocked |
| **Inventory** | Add Service Account (Auto-creates slots) | Add Service Account Dialog | **COMPLETE** | Uses `POST /api/inventory/accounts` |
| **Inventory** | Edit Service Account | Edit Service Account Dialog | **COMPLETE** | Uses `PUT /api/inventory/accounts/:id` |
| **Inventory** | Delete Service Account (Blocked if slots > 0) | Delete Service Account with guard check | **COMPLETE** | Validates `assigned_profiles == 0` |
| **Inventory** | Bulk Add License Keys (Multiline paste) | Bulk Add License Keys Dialog | **COMPLETE** | Uses `POST /api/inventory/licenses` |
| **Inventory** | Delete License Key | Delete License Key action | **COMPLETE** | Uses `DELETE /api/inventory/licenses/:id` |
| **Customers** | Customer Directory with Search | Customer List Screen with search | **COMPLETE** | Searches name, email, WhatsApp |
| **Customers** | Add Customer (Name, WhatsApp, Email, Notes) | Customer Form Dialog | **COMPLETE** | Uses `POST /api/customers` |
| **Customers** | Edit Customer | Customer Form Dialog | **COMPLETE** | Uses `PUT /api/customers/:id` |
| **Customers** | Deactivate / Activate Status Toggle | Status toggle in Customer Form | **COMPLETE** | Toggles `active` / `inactive` |
| **Customers** | Delete Customer (Blocked if orders exist) | Delete with backend error propagation | **COMPLETE** | Requires admin, blocked if orders exist |
| **Customers** | WhatsApp deep link on customer card | WhatsApp intent button | **COMPLETE** | Launches WhatsApp with sanitized phone |
| **Customers** | Customer Profile & Order History | Customer Detail Screen | **COMPLETE** | Shows profile, orders, and audit logs |
| **Alerts** | Expiring Soon Subscriptions List | Expiring Subscriptions tab | **COMPLETE** | Filtered < 7 days |
| **Alerts** | Expired Subscriptions List | Expired Subscriptions tab | **COMPLETE** | Lists past-due subscriptions |
| **Alerts** | One-click WhatsApp Reminder | One-click WhatsApp action | **COMPLETE** | Dispatches `order_expiring` / `order_expired` |
| **Alerts** | One-click Renew Subscription | Renew action button | **COMPLETE** | Uses `/api/renewals/:id` |
| **Alerts** | Projected Renewal Duration Feedback Banner | Missing duration banner | **PARTIAL** | Show start date, end date & term feedback |
| **WhatsApp** | Template Studio (3 categories, 4 languages) | Basic template editor in Alerts | **PARTIAL** | Add full Template Studio screen / dialog |
| **WhatsApp** | Live Preview with Real-time Tag Interpolation | Missing in Android template editor | **PARTIAL** | Add live interpolated preview card |
| **Settings** | My Profile (Name, Username, Email, Role) | Security Tab Profile Card | **COMPLETE** | Displays user profile info |
| **Settings** | Preferred Currency selection | Preferred Currency dropdown | **COMPLETE** | Uses `PUT /api/auth/currency` & reactive Flow |
| **Settings** | Change Password (Current, New, Confirm) | Change Password Dialog | **COMPLETE** | Uses `POST /api/auth/change-password` |
| **Settings** | General Settings (Company, Currency, Phone) | General Tab | **COMPLETE** | Uses `PUT /api/settings` |
| **Settings** | Team Members Directory & Roles | Team Tab User Cards | **COMPLETE** | Shows role badges (`owner` to `viewer`) |
| **Settings** | Add Team Member | Add User Dialog | **COMPLETE** | Uses `POST /api/users` |
| **Settings** | Delete Team Member | Delete User with confirm dialog | **COMPLETE** | Uses `DELETE /api/users/:id` |
| **Settings** | System Audit Trail with 30-day notice | Audit Tab | **COMPLETE** | Lists timestamp, user, action, details |
| **Settings** | Audit Trail Pagination (30/page, prev/next) | Audit Pagination (Previous/Next) | **COMPLETE** | Uses `GET /api/audit?page=...&limit=30` |
| **Settings** | Terminal Logout | Logout Dialog | **COMPLETE** | Revokes session & clears storage |
| **Settings** | Terminal Unpair | Unpair Device Dialog | **COMPLETE** | Revokes device token & clears Keystore |
| **Currency** | Real-time Currency Sync across all views | Reactive `preferredCurrencyFlow` | **COMPLETE** | Instant recomposition across screens |
