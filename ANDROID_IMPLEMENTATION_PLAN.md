# ANDROID IMPLEMENTATION PLAN — FULL WEB PARITY

## 1. Executive Strategy

This document establishes the precise phase-by-phase engineering roadmap to bring the Vectis ERP Android application from its current state (63.5% feature coverage) to **100% full functional parity** with the DPM web application.

Every operation supported on the web platform—including creation, updating, deletion, assignment, configuration, template editing, audit log inspection, currency administration, and device management—will be natively accessible on Android, while preserving strict security boundaries and the Single Source of Truth architecture (PostgreSQL via REST API).

---

## 2. Phase-by-Phase Execution Plan

### Phase 6: Product, Category & Plan Management Parity
- **Goal**: Allow store managers and admins to manage the entire digital product catalog directly from Android.
- **Components to Implement**:
  1. `ProductFormDialog.kt`:
     - Fields: Name, Brand, Category dropdown, Description, Capabilities checkboxes (`subscription`, `service_account`, `profiles`, `license_key`, `digital_file`), Fulfillment Type dropdown (`automatic`, `manual`), Status dropdown (`active`, `inactive`).
     - Validation: Required name, category, and at least one capability.
  2. `CategoryManagerDialog.kt` & `CategoryFormDialog.kt`:
     - List all categories with product count badges.
     - Add / Edit category modal (Name, Slug, Description).
     - Delete category with confirmation (check if products are assigned).
  3. `PlanFormDialog.kt`:
     - Add plan to selected product.
     - Fields: Name, Duration (int), Duration Unit (`days`, `months`, `years`), Price, Cost, Currency dropdown (`MAD`, `USD`, `EUR`), Stock Limit.
     - Edit existing plan / quick price update.
     - Delete plan (guarded if orders reference it).
  4. Repository & API Extensions:
     - Add `createProduct`, `updateProduct`, `deleteProduct` in `ProductInventoryRepository`.
     - Add `createCategory`, `updateCategory`, `deleteCategory` in `ProductInventoryRepository`.
     - Add `createPlan`, `updatePlan`, `deletePlan` in `ProductInventoryRepository`.

---

### Phase 7: Service Accounts, Profiles & Inventory Pool Parity
- **Goal**: Allow managers and admins to manage inventory resources, replenish accounts, configure sub-profiles, and bulk-load license keys.
- **Components to Implement**:
  1. `AccountFormDialog.kt`:
     - Add Service Account: Product selector, Provider name (e.g. Netflix, Spotify), Login/Username, Password (encrypted via backend AES-256-GCM), Capacity (profile slots count), Expiry date picker, Notes.
     - Edit Service Account: Update credentials, extend expiry date, change status (`active`, `suspended`, `expired`).
     - Delete Service Account: Guarded deletion with error prompt if any sub-profile is currently assigned to an active order.
  2. `ProfileFormDialog.kt`:
     - Add profile slot to account.
     - Edit profile name and PIN.
     - Delete unassigned profile slot.
  3. `BulkLicenseDialog.kt`:
     - Product selector.
     - Multi-line text area allowing bulk paste of license keys (split by newline).
     - Batch submit to `POST /api/inventory/licenses/bulk`.
     - Delete license key confirmation.
  4. Repository & API Extensions:
     - Add `createServiceAccount`, `updateServiceAccount`, `deleteServiceAccount`.
     - Add `createProfile`, `updateProfile`, `deleteProfile`.
     - Add `bulkCreateLicenses`, `deleteLicense`.

---

### Phase 8: Universal Order Workflow & Order Modification
- **Goal**: Full order lifecycle parity, including editing active subscription terms and adjusting statuses.
- **Components to Implement**:
  1. `EditOrderDialog.kt`:
     - Modify Start Date and End Date via date pickers.
     - Status selector: `active`, `expiring`, `expired`, `pending`, `cancelled`, `completed`.
     - Payment status selector: `paid`, `pending`, `refunded`.
     - Notes field.
     - Real-time date reconciliation (warns if end date is in past but status is set to active).
  2. Repository & API Extensions:
     - Add `updateOrder` in `OrderRepository`.

---

### Phase 9: Settings, Currencies, Team, Audit Logs & Global Search
- **Goal**: Replicate all administrative views and global navigation tools.
- **Components to Implement**:
  1. `GlobalSearchScreen.kt`:
     - Search bar querying `/api/search?q=...`.
     - Categorized results: Customers, Orders, Products, Service Accounts, License Keys.
     - One-tap deep navigation to relevant detail screen.
  2. `ChangePasswordDialog.kt`:
     - Current password, new password, confirm password fields.
     - Calls `PUT /api/auth/profile`.
  3. `TeamManagementScreen.kt`:
     - Staff members list with role badges (`owner`, `admin`, `manager`, `agent`, `viewer`) and status.
     - Add User dialog: Username, Full Name, Email, Password, Role selector.
     - Edit User role / reset password.
     - Delete User confirmation (cannot delete self).
  4. `CurrencyManagementScreen.kt`:
     - Currencies list with exchange rates relative to Base Currency.
     - Add Currency modal (Code, Symbol, Name, Rate, Precision).
     - Edit Exchange Rate inline.
  5. `GeneralSettingsScreen.kt`:
     - Edit Company Name, Support Phone, Low Inventory Threshold, Order Expiry Days.
  6. `AuditLogsScreen.kt`:
     - Paginated list of security audit logs.
     - Displays: Action, User, Entity, Entity ID, IP address, timestamp, JSON payload preview.
     - Filter by entity type (`order`, `customer`, `product`, `account`, `auth`).

---

### Phase 10: Push Alerts, WhatsApp Templates & Device Terminals
- **Goal**: Manage notification templates, configure paired terminal hardware, and handle notification intents.
- **Components to Implement**:
  1. `WhatsAppTemplatesScreen.kt`:
     - Tab selector: Order Delivery (`order_created`), Expiring Reminder (`order_expiring`), Expired Follow-up (`order_expired`).
     - Language chips: `EN`, `FR`, `AR`, `RU`.
     - Template content editor with variable tokens (`{customer_name}`, `{product_name}`, `{plan_name}`, `{end_date}`, `{order_id}`, `{days_remaining}`).
     - Save to backend database (`POST /api/whatsapp/templates`).
  2. `DevicesManagementScreen.kt`:
     - Paired terminals list with device model, last seen timestamp, and status.
     - Generate Pairing Code dialog (displays 6-character code and QR for onboarding new Android terminals).
     - Revoke Device confirmation.

---

### Phase 11: Security Hardening & Penetration Testing
- **Goal**: Validate security posture against hostile client threats.
- **Actions**:
  1. Run automated adversarial test script against API endpoints simulating an attacker bypassing Android UI:
     - Test Agent calling Admin endpoints (`DELETE /api/orders/:id`, `DELETE /api/customers/:id`, `POST /api/users`).
     - Test Agent attempting to decrypt master credentials (`POST /api/inventory/accounts/:id/reveal`).
     - Test IDOR/BOLA by attempting to access or modify records of other accounts.
     - Test pairing code brute forcing and expired/consumed code reuse.
  2. Verify Android runtime security:
     - No sensitive keys in logcat.
     - Android Keystore AES-256 GCM validation.
     - Verify ProGuard / R8 code obfuscation in release build.

---

### Phase 12: Final Parity Verification & Audit
- Cross-check every single row in `WEB_ANDROID_PARITY_MATRIX.md`.
- Run all 179+ backend unit/regression tests.
- Compile and install debug and release APKs.
- Generate `SECURITY_TEST_REPORT.md` and `ANDROID_PARITY_FINAL_REPORT.md`.
