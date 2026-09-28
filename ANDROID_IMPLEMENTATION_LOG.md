# Android Implementation & Modification Log

This log tracks every modification made to the **Android companion app** (`vectis`) during the page & function parity engineering process.

---

## Workspace Tracking
- **Primary Source Directory**: `c:\Users\kermou\Documents\DPM\vectis`
- **Mirror Workspace**: `C:\Users\kermou\Documents\vectis`
- **Parity Standard**: 100% SHA-256 byte-for-byte synchronization across both trees. Zero local SQLite/Room/Realm databases.

---

## Log Entries

### [2026-09-24] Initial Phase 0 Audit & Baseline Established
- **Audit Reports Created**:
  - `WEB_PAGE_INVENTORY.md`: All 11 web views, 4 sub-tabs, 4 global modals cataloged.
  - `WEB_FUNCTION_INVENTORY.md`: All CRUD, search, filter, calculate, renewal, reveal, and WhatsApp functions mapped.
  - `ANDROID_PAGE_AUDIT.md`: Current implementation state audited.
  - `WEB_ANDROID_PAGE_PARITY.md`: Feature-by-feature parity matrix established with statuses: COMPLETE, PARTIAL, MISSING.
  - `WEB_ISSUES_FOUND.md`: 3 web issues logged for reference (web application remained 100% untouched).
- **Target Implementation Sprints Identified**:
  1. **Sprint 1 (Shell & Global Navigation)**:
     - Add global top action bar / drawer shortcuts so Alerts, Settings, Global Search, and Currency Switcher can be accessed from any screen without returning to the Dashboard.
     - Add unread alert badge counter to Alerts tab.
  2. **Sprint 2 (Dashboard Visual Charts Parity)**:
     - Implement native Canvas/Compose Order Development 7-day spline wave chart.
     - Implement Total Customers acquisition bar chart with active/inactive/average pills.
     - Implement Subscription Health 3-state Donut chart (Active %, Expiring 3d %, Expired %).
     - Implement Purchase Analytics monthly category trends chart with Orders vs Revenue toggle and Year selector.
     - Add quick "+ New Order" action from Dashboard.
  3. **Sprint 3 (Orders & Fulfillment Parity)**:
     - Add real-time status count badges to Order list filter chips (`Active (X)`, `Expiring (Y)`, `Expired (Z)`).
     - Add "+ Quick Add Customer" inline dialog in `CreateOrderScreen`.
     - Wire dynamic `/api/plans/calculate-dates` in `CreateOrderScreen` to auto-calculate end dates and pricing based on calendar rules.
     - Implement multilingual WhatsApp Delivery Receipt generator (EN, FR, AR, RU) in `OrderDetailScreen` and `CreateOrderScreen`.
  4. **Sprint 4 (Alerts & WhatsApp Studio Parity)**:
     - Add projected renewal duration confirmation banner in `AlertsScreen` (new start date, end date, term feedback).
     - Enhance WhatsApp template studio with category tabs (`order_created`, `order_expiring`, `order_expired`), 4 languages (`en`, `fr`, `ar`, `ru`), variable tag chips, and live interpolated preview card.
