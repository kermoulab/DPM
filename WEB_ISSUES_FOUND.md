# Web Issues Discovered (Read-Only Log)

> 🚨 **NOTICE**: Per engineering rules, the Web Application is strictly **READ-ONLY**. The issues listed below are documented for future web sprints and architectural review. **No web code has been modified or altered.**

---

### Issue 1: Client-side Fallback in `DeliveryReceiptModal` Duplicates Server WhatsApp Template Logic
- **File**: `src/components/DeliveryReceiptModal.tsx` (Lines 13–67)
- **Observation**:
  - The frontend defines a local function `buildClientFallback(ord, l)` that hardcodes default English, French, Arabic, and Russian template strings.
  - The backend route `/api/whatsapp/compose` and `/api/whatsapp/templates` already stores and dynamically interpolates database-driven templates.
  - If the database templates are edited in `WhatsAppView`, the client fallback still falls back to the hardcoded strings if the endpoint call fails or is bypassed.
- **Impact**: Minor divergence between database templates and hardcoded fallback strings in offline or edge network scenarios.
- **Recommended Web Action**: Rely on cached templates from `GET /api/whatsapp/templates` rather than hardcoding parallel strings.

---

### Issue 2: Date String Formatting without Timezone Normalization in `OrdersView`
- **File**: `src/pages/OrdersView.tsx` (Lines 48–51)
- **Observation**:
  - `formatDateOnly` splits strings on `'T'` or `' '` (`String(d).split('T')[0].split(' ')[0]`).
  - If a start date or end date is serialized as a full ISO 8601 UTC timestamp (e.g. `2026-09-24T00:00:00.000Z`), clients in negative UTC offsets (e.g. UTC-5 EST) could display the preceding calendar day if converted via `new Date()`.
  - The string splitting approach avoids timezone shift, but will display `NaN` or unexpected tokens if non-ISO date formats are introduced.
- **Impact**: Display-only potential inconsistency across varying client local timezones.

---

### Issue 3: Pagination Controls in `SettingsView` Lack Disabled State for Previous on Page 1
- **File**: `src/pages/SettingsView.tsx`
- **Observation**:
  - In the Audit Trail sub-tab, clicking "Previous" on page 1 guards against decrementing below 1 (`Math.max(1, page - 1)`), but the visual button does not always show `opacity-40` or `disabled` attribute depending on CSS class bindings.
- **Impact**: Cosmetic clickability of previous button when on the first page.
