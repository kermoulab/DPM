# Vectis ERP — Android Mobile Application Specification

This document provides a comprehensive technical architecture and component specification for building the **Vectis ERP Companion Android Application**. It is structured for consumption by Google AI Studio, mobile developers, and LLM coding agents to generate production-ready Kotlin / Jetpack Compose codebases.

---

## 1. System Overview & Core Business Domain

Vectis ERP is an Enterprise Resource Planning system purpose-built for digital products resellers. The platform automates the fulfillment, inventory tracking, renewal lifecycle, and customer communication for:

1. **Shared Streaming Service Accounts & Profiles** (e.g., Netflix, Spotify, Disney+):
   - Multi-profile accounts with slot capacity limits.
   - Individual profile PINs and customer assignment.
   - Password decryption and credentials delivery.
2. **Software License Keys & Activation Codes** (e.g., Windows, Office, Steam, Antivirus):
   - Pool of pre-loaded unallocated serial keys assigned one-by-one upon order completion.
3. **Digital Downloadable Files & Credentials** (e.g., PDFs, software packages, cloud storage accounts).
4. **Print-On-Demand / Merch Mockups** (custom placement, design files, safe zones).

### Core Business Rules:
- **Authoritative Source of Truth:** Remote PostgreSQL 16+ REST API backend.
- **7-Day Expiring Subscription Window:** Subscriptions where `CURRENT_DATE <= end_date <= CURRENT_DATE + 7 DAYS` are classified as `expiring`.
- **Expired Subscriptions:** Subscriptions where `end_date < CURRENT_DATE` are classified as `expired`.
- **Atomic Profile / Key Allocation:** Backend allocates profiles using row-level locking (`FOR UPDATE SKIP LOCKED`).
- **WhatsApp Phone Format:** Phone numbers must contain only digits `0-9` and an optional leading `+` (e.g., `+1234567890`). All alphabetic characters and spaces must be stripped.
- **5-Tier Role-Based Access Control (RBAC):** `owner` > `admin` > `manager` > `agent` > `viewer`.

---

## 2. Recommended Android Architecture & Tech Stack

- **Language:** Kotlin 2.0+ (100% idiomatic, coroutines, sealed interfaces).
- **UI Framework:** Jetpack Compose with Material 3 (`androidx.compose.material3`).
- **Architecture Pattern:** Clean Architecture + MVI / MVVM:
  - `data`: Retrofit 2 / OkHttp 4, Kotlinx Serialization or Moshi, EncryptedSharedPreferences / Jetpack DataStore, Room (offline cache).
  - `domain`: Repository interfaces, domain models, business use-cases.
  - `presentation`: ViewModel with `StateFlow<UiState>` and `SharedFlow<UiEvent>`, Composable screens.
- **Navigation:** Jetpack Navigation Compose with type-safe routing.
- **Dependency Injection:** Hilt / Dagger or Koin.
- **Asynchronous Flow:** Kotlin Coroutines & Reactive `Flow`.
- **Image Loading:** Coil (`io.coil-kt:coil-compose`).
- **External Intents:** Android Native WhatsApp deep linking (`https://wa.me/<sanitized_phone>?text=<encoded_msg>`).

---

## 3. Authentication & Security Specification

### Session Management:
- **Protocol:** HTTP Bearer Token (HMAC-SHA256 JWT).
- **Header:** `Authorization: Bearer <jwt_token>` injected via OkHttp `Interceptor`.
- **Local Storage:** `EncryptedSharedPreferences` or Jetpack `DataStore` (AES-256-GCM backed by Android Keystore).
- **Auto-Logout:** Intercept HTTP `401 Unauthorized` responses to clear local tokens and navigate back to `LoginScreen`.
- **Biometric Authentication:** Optional `BiometricPrompt` support for fast app resume.

### User Roles & Permissions:
| Role | Display Label | Permissions |
|---|---|---|
| `owner` | Admin | Full unrestricted system access, billing, user management, audit logs |
| `admin` | Admin | Product, customer, order, inventory management, settings |
| `manager` | Manager | Orders, customers, alerts, catalog viewing |
| `agent` | Agent | Create orders, view customers, view receipts |
| `viewer` | Viewer | Read-only analytics & catalog views |

---

## 4. Complete REST API Specifications

### Base URL:
- Production: `https://your-vectis-domain.com/api`
- Android Emulator: `http://10.0.2.2:3000/api`

---

### 4.1 Authentication (`/api/auth`)

#### `POST /api/auth/login`
- **Request Body:**
  ```json
  {
    "username": "admin",
    "password": "SecretPassword123"
  }
  ```
- **Response (HTTP 200):**
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "usr_9918231",
      "username": "admin",
      "email": "admin@vectis.io",
      "name": "Super Admin",
      "role": "owner",
      "preferred_currency": "USD",
      "status": "active"
    }
  }
  ```

#### `GET /api/auth/me`
- **Headers:** `Authorization: Bearer <token>`
- **Response (HTTP 200):** Returns current `User` profile object.

---

### 4.2 Dashboard & KPI Analytics (`/api/dashboard`)

#### `GET /api/dashboard/stats`
- **Response (HTTP 200):**
  ```json
  {
    "financial": {
      "totalRevenue": 15420.50,
      "totalCost": 6210.00,
      "grossProfit": 9210.50,
      "profitMargin": 59.7,
      "revenueToday": 450.00,
      "revenueThisMonth": 4820.00,
      "revenuePrevMonth": 3950.00,
      "revenueGrowth": 22.0
    },
    "customers": {
      "total": 342,
      "active": 310,
      "blocked": 4,
      "newThisMonth": 28,
      "growthRate": 8.9
    },
    "orders": {
      "total": 520,
      "active": 410,
      "expiring": 18,
      "expired": 82,
      "cancelled": 10,
      "activePercent": 78.8,
      "expiringPercent": 3.5,
      "expiredPercent": 15.8
    },
    "inventory": {
      "stockStatus": 84,
      "turnoverRate": 72,
      "productsOrdered": 91,
      "serviceAccountsCount": 45,
      "totalProfiles": 180,
      "assignedProfiles": 142,
      "availableProfiles": 38,
      "totalLicenses": 64,
      "availableLicenses": 21,
      "assignedLicenses": 43
    },
    "recentOrders": [
      {
        "id": "ord_88219",
        "order_number": "ORD-1049",
        "customer_name": "Sarah Connor",
        "product_name": "Netflix 4K UHD",
        "plan_name": "1 Month Private Profile",
        "status": "active",
        "start_date": "2026-09-20",
        "end_date": "2026-10-20",
        "price": 4.50,
        "currency": "USD"
      }
    ],
    "topProducts": [
      {
        "id": "prod_1",
        "name": "Netflix Premium",
        "brand": "Netflix",
        "orderCount": 184,
        "totalRevenue": 2450.00
      }
    ]
  }
  ```

---

### 4.3 Orders & Subscriptions (`/api/orders`)

#### `GET /api/orders`
- **Query Parameters:**
  - `status`: `all` | `active` | `expiring` | `expired` | `cancelled`
  - `search`: Search query (order number, customer name, product name)
  - `limit`: Integer (default 50)
  - `offset`: Integer (default 0)
- **Response (HTTP 200):** `Order[]` array.

#### `POST /api/orders` (Create Order & Auto-Fulfill)
- **Request Body:**
  ```json
  {
    "customer_id": "cust_1234",
    "product_id": "prod_9981",
    "plan_id": "plan_4412",
    "start_date": "2026-09-21",
    "end_date": "2026-10-21",
    "price": 12.00,
    "cost": 5.00,
    "currency": "USD",
    "payment_method": "cash",
    "payment_status": "paid",
    "notes": "Paid via PayPal"
  }
  ```
- **Response (HTTP 201):** Newly created `Order` object with assigned profile / license key details.

#### `PUT /api/orders/:id` (Edit Order & Dates)
- **Request Body:**
  ```json
  {
    "customer_id": "cust_1234",
    "product_id": "prod_9981",
    "plan_id": "plan_4412",
    "start_date": "2026-09-21",
    "end_date": "2026-10-21",
    "price": 12.00,
    "cost": 5.00,
    "currency": "USD",
    "status": "active",
    "notes": "Updated note"
  }
  ```

#### `POST /api/orders/:id/renew` (Subscription Extension)
- **Request Body:**
  ```json
  {
    "plan_id": "plan_4412",
    "extend_mode": "auto",
    "price": 12.00,
    "cost": 5.00,
    "currency": "USD",
    "notes": "Renewed for 1 month"
  }
  ```
- **Behavior:**
  - If subscription is `active` or `expiring`, extends from existing `end_date`.
  - If subscription is `expired`, extends starting from `CURRENT_DATE`.

#### `DELETE /api/orders/:id`
- **Behavior:** Automatically frees and releases assigned service profiles or software license keys back to available inventory inside an atomic transaction.

---

### 4.4 Customers (`/api/customers`)

#### `GET /api/customers`
- **Query Parameters:** `search`, `limit`, `offset`
- **Response (HTTP 200):** `Customer[]` array with aggregate stats (`total_orders`, `total_spent`, `active_orders`, `expired_orders`).

#### `POST /api/customers`
- **Request Body:**
  ```json
  {
    "name": "John Doe",
    "email": "john@example.com",
    "whatsapp": "+1234567890",
    "notes": "VIP customer",
    "status": "active"
  }
  ```

#### `GET /api/customers/:id`
- **Response (HTTP 200):** Customer details + complete order history.

---

### 4.5 Inventory Management (`/api/inventory`)

#### `GET /api/inventory/accounts`
- **Response (HTTP 200):** Service accounts list with decrypted credentials (if requested) and profiles.
  ```json
  [
    {
      "id": "acc_1",
      "product_id": "prod_netflix",
      "provider": "Netflix",
      "login": "netflix_host_1@gmail.com",
      "capacity": 5,
      "status": "active",
      "expiry_date": "2027-01-01",
      "profiles": [
        {
          "id": "prof_101",
          "profile_name": "Profile 1 (VIP)",
          "pin": "1234",
          "status": "assigned",
          "assigned_customer_name": "Sarah Connor"
        },
        {
          "id": "prof_102",
          "profile_name": "Profile 2",
          "pin": "5678",
          "status": "available"
        }
      ]
    }
  ]
  ```

#### `POST /api/inventory/accounts`
- Creates new parent service account and auto-creates profiles up to `capacity`.

#### `GET /api/inventory/licenses`
- **Response (HTTP 200):** Preloaded software license keys with status (`available`, `assigned`, `expired`, `blocked`).

#### `POST /api/inventory/licenses`
- Upload batch of license keys (comma or newline delimited).

---

### 4.6 Alerts & Notifications (`/api/alerts` & `/api/whatsapp`)

#### `GET /api/alerts`
- Returns dynamic subscription triggers:
  - `expiring`: Orders ending in ≤ 7 days.
  - `expired`: Orders whose end date has passed.
  - `stock`: Products with 0 available profiles or keys.

#### `POST /api/whatsapp/compose`
- **Request Body:**
  ```json
  {
    "order_id": "ord_88219",
    "event_type": "order_expiring",
    "language": "en"
  }
  ```
- **Response (HTTP 200):**
  ```json
  {
    "phone": "+1234567890",
    "message": "Hello Sarah Connor, your Netflix 4K UHD subscription is expiring in 3 days on 2026-10-20. Contact us to renew!"
  }
  ```
- **Supported Languages:** `en`, `fr`, `ar`, `ru`.

---

### 4.7 Security Audit Log (`/api/audit`)

#### `GET /api/audit?page=1&limit=30`
- **Response (HTTP 200):**
  ```json
  {
    "logs": [
      {
        "id": "log_1",
        "username": "admin",
        "action": "ORDER_CREATED",
        "entity": "orders",
        "entity_id": "ord_88219",
        "details": { "product": "Netflix", "price": 4.50 },
        "created_at": "2026-09-21T18:30:00Z"
      }
    ],
    "total": 128,
    "page": 1,
    "limit": 30,
    "totalPages": 5
  }
  ```

---

### 4.8 Universal Search (`/api/search`)

#### `GET /api/search?q=query`
- Searches across Orders, Customers, Products, Service Accounts, and License Keys simultaneously.

---

## 5. UI/UX Specifications for Jetpack Compose

### Theme & Design Tokens:
- **Brand Palette:**
  - Primary: `#2563EB` (Tailwind Blue 600)
  - Primary Dark: `#1D4ED8` (Tailwind Blue 700)
  - Surface Light: `#FFFFFF`
  - Background Light: `#F8FAFC` (Slate 50)
  - Text Primary: `#0F172A` (Slate 900)
  - Text Secondary: `#64748B` (Slate 500)
  - Success: `#10B981` (Emerald 500)
  - Warning: `#F59E0B` (Amber 500)
  - Danger: `#EF4444` (Red 500)
- **Typography:** Inter or Roboto, Clean sans-serif hierarchy.
- **Card Corners:** Rounded 16dp - 24dp for modern elevated look.

---

### Screen Hierarchy & Navigation Graph:

```
Navigation Root (Scaffold + Bottom Navigation Bar)
├── 1. DashboardScreen
│   ├── KPI Metric Cards Carousel (Revenue, Active Orders, Stock, Customers)
│   ├── Purchase Analytics Mini-Chart
│   ├── Recent Orders Section (Max 5 items, "View Orders" navigation action)
│   ├── Top Selling Products Cards
│   └── Inventory Quick Overview
├── 2. OrdersScreen
│   ├── Filter Chips: [All, Active, Expiring Soon, Expired, Cancelled]
│   ├── Search & Sort Bar
│   ├── OrderCard (Product Name, Plan, Dates, Customer, Price, Status Badge)
│   ├── OrderDetailsBottomSheet (Credentials display, Edit dates, Renew, Delete)
│   └── DeliveryReceiptDialog (Plain text credentials, Direct WhatsApp Button)
├── 3. CreateOrderScreen (Wizard / BottomSheet)
│   ├── Step 1: Select / Quick-Create Customer (with WhatsApp sanitizer)
│   ├── Step 2: Select Product & Plan Tier
│   ├── Step 3: Dates Picker (Auto-computes end date from plan duration)
│   └── Step 4: Confirm & Auto-allocate Inventory
├── 4. CustomersScreen
│   ├── Search & Alphabetical Filter
│   ├── CustomerCard (Name, WhatsApp button, Spent total, Active order count)
│   ├── CustomerDetailsScreen (Contact info, Active orders list, Order history)
│   └── Add/Edit Customer Dialog
├── 5. InventoryBankScreen
│   ├── Tabs: [Service Accounts, License Keys]
│   ├── AccountItem (Provider, Master Login, Masked Password, Profiles Grid)
│   ├── ProfileItem (Profile Name, PIN, Assignment Status, Assigned Customer)
│   └── LicenseKeyItem (Mono-spaced key, Status tag, Assignee)
├── 6. AlertsScreen
│   ├── Language Selector: [EN, FR, AR, RU]
│   ├── Expiring Soon Subscriptions List
│   ├── Expired Subscriptions List
│   └── Action: "Notify via WhatsApp" (Calls compose API + launches WhatsApp Intent)
├── 7. SettingsScreen
│   ├── User Profile & Role Badge ("Admin")
│   ├── Security Audit Log Viewer (Paginated 30 events per page)
│   ├── Currency & Exchange Rates
│   └── Logout Button
└── 8. UniversalSearchModal
    └── Instant search results with deep links to Order, Customer, or Inventory item
```

---

## 6. Key Implementation Code Snippets for Android

### 6.1 WhatsApp Phone Sanitizer (Kotlin)
```kotlin
object PhoneUtils {
    /**
     * Accepts only digits (0-9) and an optional leading '+'.
     * Rejects all spaces, hyphens, and alphabetic characters.
     */
    fun sanitizeWhatsAppPhone(input: String): String {
        if (input.isBlank()) return ""
        val hasLeadingPlus = input.trim().startsWith("+")
        val digitsOnly = input.filter { it.isDigit() }
        return if (hasLeadingPlus) "+$digitsOnly" else digitsOnly
    }
}
```

### 6.2 WhatsApp Native Launch Intent (Kotlin)
```kotlin
fun launchWhatsApp(context: Context, phone: String, message: String) {
    val sanitizedPhone = PhoneUtils.sanitizeWhatsAppPhone(phone).removePrefix("+")
    val encodedText = URLEncoder.encode(message, StandardCharsets.UTF_8.toString())
    val url = "https://wa.me/$sanitizedPhone?text=$encodedText"
    
    val intent = Intent(Intent.ACTION_VIEW).apply {
        data = Uri.parse(url)
        setPackage("com.whatsapp")
    }
    
    try {
        context.startActivity(intent)
    } catch (e: ActivityNotFoundException) {
        // Fallback to browser if WhatsApp app is not installed
        context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
    }
}
```

### 6.3 Retrofit Auth Interceptor (Kotlin)
```kotlin
class AuthInterceptor(private val tokenProvider: () -> String?) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val original = chain.request()
        val builder = original.newBuilder()
        tokenProvider()?.let { token ->
            builder.header("Authorization", "Bearer $token")
        }
        return chain.proceed(builder.build())
    }
}
```

### 6.4 Sealed UI State Pattern for Compose (Kotlin)
```kotlin
sealed interface OrdersUiState {
    data object Loading : OrdersUiState
    data class Success(
        val orders: List<Order>,
        val activeFilter: OrderFilter,
        val searchQuery: String
    ) : OrdersUiState
    data class Error(val message: String) : OrdersUiState
}
```

---

## 7. Instructions for AI Studio Prompting

When prompting Google AI Studio to generate this Android application:

1. **Upload or Reference this Specification:**
   > "I need you to build a native Android app in Kotlin and Jetpack Compose based on the attached `ANDROID_APP_SPEC.md`. Follow Clean Architecture, Material 3, and Kotlin Coroutines/Flow."

2. **Phase 1 Prompt (Networking & Domain Models):**
   > "Generate the complete data and domain layer including Retrofit API interfaces, DTOs, OkHttp client with Bearer Token interceptor, and Repository implementations matching Section 4 of `ANDROID_APP_SPEC.md`."

3. **Phase 2 Prompt (Navigation & UI Theme):**
   > "Generate the Jetpack Compose Material 3 theme (colors, typography, shapes) and the Navigation Graph with Bottom Navigation Bar matching Section 5 of `ANDROID_APP_SPEC.md`."

4. **Phase 3 Prompt (Dashboard & Orders Screens):**
   > "Implement the DashboardScreen and OrdersScreen with viewmodels, filter chips, order card components, and the WhatsApp launch intent matching Section 6 of `ANDROID_APP_SPEC.md`."

5. **Phase 4 Prompt (Inventory Bank & Alerts):**
   > "Implement the InventoryBankScreen (service accounts, profiles, license keys) and AlertsScreen (multilingual WhatsApp composition) matching the specifications."
