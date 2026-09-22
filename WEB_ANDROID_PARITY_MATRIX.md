# WEB → ANDROID FUNCTIONAL PARITY MATRIX — DPM / VECTIS ERP

This matrix maps every functional capability present in the existing DPM Web Application to its corresponding native Android implementation in Vectis ERP.

| Domain | Web Capability | Web Source Component | API Endpoint | Android Destination | Android Implementation | Current Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Pairing** | QR Code Pairing | `DevicesView.tsx` | `POST /api/devices/pair` | `ScanQrScreen.kt` | CameraX MLKit barcode scanner + API pair | ✅ Complete |
| **Pairing** | Manual 6-Char Pairing Code | `DevicesView.tsx` | `POST /api/devices/pair` | `EnterCodeScreen.kt` | 6-digit text input with auto-formatting | ✅ Complete |
| **Pairing** | Device Revocation Detection | `App.tsx` | `401 X-Device-Revoked` | `AuthInterceptor.kt` | Intercepts 401, clears keystore, returns to Pairing | ✅ Complete |
| **Pairing** | Paired Terminals List | `DevicesView.tsx` | `GET /api/devices` | `DevicesManagementScreen.kt` | Device list with status & revoke action | 🔄 Phase 10 |
| **Pairing** | Generate Pairing Token | `DevicesView.tsx` | `POST /api/devices/generate` | `DevicesManagementScreen.kt` | Admin creates pairing QR/code for another terminal | 🔄 Phase 10 |
| **Auth** | Staff Login | `Login.tsx` | `POST /api/auth/login` | `LoginScreen.kt` | Username/password login with error state | ✅ Complete |
| **Auth** | Staff Logout | `Topbar.tsx` | `POST /api/auth/logout` | `SettingsScreen.kt` | Clear token from Keystore and navigate to Login | ✅ Complete |
| **Auth** | Profile & Role Inspection | `Topbar.tsx`, `SettingsView.tsx` | `GET /api/auth/me` | `SettingsScreen.kt` | Real-time profile card with role badges | ✅ Complete |
| **Auth** | Password Change | `SettingsView.tsx` | `PUT /api/auth/profile` | `ChangePasswordDialog.kt` | Current/new/confirm password modal | 🔄 Phase 9 |
| **Auth** | Client-side RBAC Guarding | `App.tsx`, `Sidebar.tsx` | Role hierarchy | `PermissionManager.kt` | Dynamic UI restriction based on server role | ✅ Complete |
| **Dashboard**| Real-time Revenue & Profit KPI | `DashboardView.tsx` | `GET /api/dashboard/stats` | `DashboardScreen.kt` | KPI card with formatted currency | ✅ Complete |
| **Dashboard**| Active & Expiring Subs KPI | `DashboardView.tsx` | `GET /api/dashboard/stats` | `DashboardScreen.kt` | KPI card with warning state | ✅ Complete |
| **Dashboard**| Customer Counts KPI | `DashboardView.tsx` | `GET /api/dashboard/stats` | `DashboardScreen.kt` | KPI card with active customer count | ✅ Complete |
| **Dashboard**| Inventory Availability KPI | `DashboardView.tsx` | `GET /api/dashboard/stats` | `DashboardScreen.kt` | Available profile slots & license count | ✅ Complete |
| **Dashboard**| Recent Orders Feed | `DashboardView.tsx` | `GET /api/dashboard/stats` | `DashboardScreen.kt` | Top 5 recent orders table with click-to-view | ✅ Complete |
| **Dashboard**| Top Products Ranking | `DashboardView.tsx` | `GET /api/dashboard/stats` | `DashboardScreen.kt` | Best-selling products ranked by volume | ✅ Complete |
| **Customers**| Customer Catalog List | `CustomersView.tsx` | `GET /api/customers` | `CustomerListScreen.kt` | LazyColumn with contact & spending metrics | ✅ Complete |
| **Customers**| Customer Live Search | `CustomersView.tsx` | `GET /api/customers?search=` | `CustomerListScreen.kt` | Real-time server-side debounced search | ✅ Complete |
| **Customers**| Customer Status Filtering | `CustomersView.tsx` | `GET /api/customers?status=` | `CustomerListScreen.kt` | Filter chips: All, Active, Blocked | ✅ Complete |
| **Customers**| Create Customer | `CustomersView.tsx` | `POST /api/customers` | `CustomerFormDialog.kt` | Full validation dialog (Name, Email, WhatsApp) | ✅ Complete |
| **Customers**| Edit Customer Info | `CustomersView.tsx` | `PUT /api/customers/:id` | `CustomerFormDialog.kt` | Edit modal with status update | ✅ Complete |
| **Customers**| Delete Customer | `CustomersView.tsx` | `DELETE /api/customers/:id` | `CustomerDetailScreen.kt` | Admin confirmation dialog; guarded against active orders | ✅ Complete |
| **Customers**| Block / Unblock Customer | `CustomersView.tsx` | `PUT /api/customers/:id` | `CustomerDetailScreen.kt` | One-tap block toggle | ✅ Complete |
| **Customers**| Customer Order History | `CustomersView.tsx` | `GET /api/customers/:id` | `CustomerDetailScreen.kt` | Order list with subscription terms | ✅ Complete |
| **Customers**| WhatsApp Direct Deep Link | `CustomersView.tsx` | `wa.me/` | `CustomerListScreen.kt` | Native Android WhatsApp Intent with sanitized phone | ✅ Complete |
| **Customers**| Direct Phone Call & Email | `CustomersView.tsx` | `tel:`, `mailto:` | `CustomerDetailScreen.kt` | Native `ACTION_DIAL` and `ACTION_SENDTO` | ✅ Complete |
| **Products** | Product Catalog Grid | `ProductsView.tsx` | `GET /api/products` | `ProductsScreen.kt` | Cards with brand, name, stock badge, capabilities | ✅ Complete |
| **Products** | Filter by Capability | `ProductsView.tsx` | `GET /api/products` | `ProductsScreen.kt` | Filter chips: All, Subs, Service Accounts, Keys | ✅ Complete |
| **Products** | Create Product | `ProductsView.tsx` | `POST /api/products` | `ProductFormDialog.kt` | Modal for generic product + capability selection | 🔄 Phase 6 |
| **Products** | Edit Product | `ProductsView.tsx` | `PUT /api/products/:id` | `ProductFormDialog.kt` | Edit product metadata, fulfillment, status | 🔄 Phase 6 |
| **Products** | Delete Product | `ProductsView.tsx` | `DELETE /api/products/:id` | `ProductsScreen.kt` | Admin delete confirmation dialog | 🔄 Phase 6 |
| **Categories**| Manage Product Categories | `ProductsView.tsx` | `GET /api/categories` | `CategoryManagerDialog.kt` | Category list with product counts | 🔄 Phase 6 |
| **Categories**| Create / Edit Category | `ProductsView.tsx` | `POST / PUT /api/categories` | `CategoryFormDialog.kt` | Name, slug, description form | 🔄 Phase 6 |
| **Categories**| Delete Category | `ProductsView.tsx` | `DELETE /api/categories/:id`| `CategoryManagerDialog.kt` | Guarded delete with reassign option | 🔄 Phase 6 |
| **Plans** | View Product Plans | `ProductsView.tsx` | `GET /api/plans` | `ProductsScreen.kt` | Plan cards showing duration, unit, price, cost | ✅ Complete |
| **Plans** | Add Plan to Product | `ProductsView.tsx` | `POST /api/plans` | `PlanFormDialog.kt` | Duration, unit, price, cost, currency modal | 🔄 Phase 6 |
| **Plans** | Edit Plan / Quick Price | `ProductsView.tsx` | `PUT /api/plans/:id` | `PlanFormDialog.kt` | Edit pricing and stock limits | 🔄 Phase 6 |
| **Plans** | Delete Plan | `ProductsView.tsx` | `DELETE /api/plans/:id` | `PlanFormDialog.kt` | Admin delete plan confirmation | 🔄 Phase 6 |
| **Inventory**| Service Accounts Pool | `InventoryView.tsx` | `GET /api/inventory/accounts` | `InventoryScreen.kt` | Masked accounts list with capacity & occupancy | ✅ Complete |
| **Inventory**| Reveal Master Credentials | `InventoryView.tsx` | `POST .../accounts/:id/reveal`| `InventoryScreen.kt` | Role-guarded on-demand decryption dialog | ✅ Complete |
| **Inventory**| Add Service Account | `InventoryView.tsx` | `POST /api/inventory/accounts` | `AccountFormDialog.kt` | Provider, login, password, capacity form | 🔄 Phase 7 |
| **Inventory**| Edit Service Account | `InventoryView.tsx` | `PUT /api/inventory/accounts/:id`| `AccountFormDialog.kt` | Edit login/password/notes/status | 🔄 Phase 7 |
| **Inventory**| Delete Service Account | `InventoryView.tsx` | `DELETE .../accounts/:id` | `InventoryScreen.kt` | Blocked if active profiles assigned | 🔄 Phase 7 |
| **Profiles** | Expandable Account Profiles | `InventoryView.tsx` | `GET .../accounts/:id/profiles` | `InventoryScreen.kt` | Profile slots with assigned customer & status | ✅ Complete |
| **Profiles** | Add Profile Slot | `InventoryView.tsx` | `POST .../accounts/:id/profiles` | `ProfileFormDialog.kt` | Name and PIN modal | 🔄 Phase 7 |
| **Profiles** | Edit Profile / Change PIN | `InventoryView.tsx` | `PUT /api/inventory/profiles/:id`| `ProfileFormDialog.kt` | Edit slot name, PIN | 🔄 Phase 7 |
| **Profiles** | Delete Profile Slot | `InventoryView.tsx` | `DELETE .../profiles/:id` | `InventoryScreen.kt` | Blocked if currently assigned | 🔄 Phase 7 |
| **License Keys**| License Keys Pool Table | `InventoryView.tsx` | `GET /api/inventory/licenses` | `InventoryScreen.kt` | License pool list with product & status badges | ✅ Complete |
| **License Keys**| Bulk Add License Keys | `InventoryView.tsx` | `POST .../licenses/bulk` | `BulkLicenseDialog.kt` | Multi-line key paste & batch creation | 🔄 Phase 7 |
| **License Keys**| Delete License Key | `InventoryView.tsx` | `DELETE .../licenses/:id` | `InventoryScreen.kt` | Delete key from available pool | 🔄 Phase 7 |
| **Orders** | Orders List & Status Tabs | `OrdersView.tsx` | `GET /api/orders` | `OrderListScreen.kt` | Status tabs (Active, Expiring, Expired, All) | ✅ Complete |
| **Orders** | Search Orders | `OrdersView.tsx` | `GET /api/orders?search=` | `OrderListScreen.kt` | Server-side debounced search | ✅ Complete |
| **Orders** | Universal Order Creator | `OrderBuilderModal.tsx` | `POST /api/orders` | `CreateOrderScreen.kt` | Customer -> Product -> Plan -> Auto-fulfillment | ✅ Complete |
| **Orders** | Dynamic End-Date Calculation | `OrderBuilderModal.tsx` | `POST /api/orders/calculate-dates`| `CreateOrderScreen.kt` | Real-time calculation on date/plan change | ✅ Complete |
| **Orders** | Quick Create Customer in Order | `OrderBuilderModal.tsx` | `POST /api/customers` | `CreateOrderScreen.kt` | Inline modal to register customer on the fly | ✅ Complete |
| **Orders** | View Order Breakdown | `OrdersView.tsx` | `GET /api/orders/:id` | `OrderDetailScreen.kt` | Full order detail with assigned credentials/key | ✅ Complete |
| **Orders** | WhatsApp Delivery Receipt | `DeliveryReceiptModal.tsx`| `POST /api/whatsapp/compose` | `OrderDetailScreen.kt` | Generated formatted message + one-tap WhatsApp | ✅ Complete |
| **Orders** | Renew Subscription | `OrdersView.tsx` | `POST /api/orders/:id/renew` | `OrderDetailScreen.kt` | Extend duration, add price, log renewal | ✅ Complete |
| **Orders** | Edit Order Dates & Status | `EditOrderModal.tsx` | `PUT /api/orders/:id` | `EditOrderDialog.kt` | Modify dates, reconcile status, payment state | 🔄 Phase 8 |
| **Orders** | Cancel Order | `OrdersView.tsx` | `PUT /api/orders/:id` | `OrderDetailScreen.kt` | Mark cancelled | ✅ Complete |
| **Orders** | Delete Order | `OrdersView.tsx` | `DELETE /api/orders/:id` | `OrderDetailScreen.kt` | Admin only: releases profile and license slot | ✅ Complete |
| **Alerts** | Expiring Subscriptions List | `AlertsView.tsx` | `GET /api/alerts` | `AlertsScreen.kt` | Subscriptions expiring within 7 days | ✅ Complete |
| **Alerts** | Expired Subscriptions List | `AlertsView.tsx` | `GET /api/alerts` | `AlertsScreen.kt` | Subscriptions past end-date | ✅ Complete |
| **Alerts** | Low Inventory Stock Alert | `AlertsView.tsx` | `GET /api/alerts` | `AlertsScreen.kt` | Products below inventory threshold | ✅ Complete |
| **Alerts** | Multilingual WhatsApp Reminders| `AlertsView.tsx` | `POST /api/whatsapp/compose` | `AlertsScreen.kt` | Instant WhatsApp dispatch in EN, FR, AR, RU | ✅ Complete |
| **WhatsApp** | Notification Templates List | `WhatsAppView.tsx` | `GET /api/whatsapp/templates` | `WhatsAppTemplatesScreen.kt` | Browse templates for delivery, expiring, expired | 🔄 Phase 10 |
| **WhatsApp** | Edit / Save Custom Template | `WhatsAppView.tsx` | `POST /api/whatsapp/templates` | `WhatsAppTemplatesScreen.kt` | Customize template text and variables | 🔄 Phase 10 |
| **Currency** | Live Display Currency Switch | `CurrencyContext.tsx` | `POST /api/auth/currency` | `SettingsScreen.kt` | Instant update of active currency (MAD, USD, EUR) | ✅ Complete |
| **Currency** | Currencies & Exchange Rates | `SettingsView.tsx` | `GET /api/currencies` | `CurrencyManagementScreen.kt`| List rates, add currency, update conversion rates | 🔄 Phase 9 |
| **Settings** | General ERP Settings | `SettingsView.tsx` | `GET / POST /api/settings` | `GeneralSettingsScreen.kt` | Edit company name, thresholds, support phone | 🔄 Phase 9 |
| **Team** | Staff User Management | `SettingsView.tsx` | `GET / POST / PUT / DELETE /api/users` | `TeamManagementScreen.kt` | Add staff, change roles, suspend/delete staff | 🔄 Phase 9 |
| **Audit** | Security Audit Logs Viewer | `SettingsView.tsx` | `GET /api/audit` | `AuditLogsScreen.kt` | Paginated event history with 30-day policy | 🔄 Phase 9 |
| **Search** | Global Unified Search | `GlobalSearchModal.tsx` | `GET /api/search?q=` | `GlobalSearchScreen.kt` | Cross-entity search (customers, orders, catalog) | 🔄 Phase 9 |
| **Security** | Zero Local Business Database | N/A | PostgreSQL REST API | App Architecture | Strict compliance: no Room/SQLite business caching | ✅ Complete |
| **Security** | Hardware Keystore Encryption | N/A | Android Keystore | `SecureStorage.kt` | Master keys, session tokens, device tokens encrypted | ✅ Complete |
| **Security** | Anti-Tampering & Anti-Backup | N/A | AndroidManifest.xml | Android Manifest | `allowBackup=false`, `fullBackupContent=false` | ✅ Complete |
| **Security** | Obfuscation & R8 Rule Set | N/A | ProGuard | `proguard-rules.pro` | Strips logs, obfuscates models and networking | ✅ Complete |

---

## Parity Metrics Summary
- **Total Web Capabilities Identified**: 52
- **Completed in Android**: 33 (63.5%)
- **Pending Implementation Across Phases 6–10**: 19 (36.5%)
- **Target Parity**: 100% (52 / 52)
