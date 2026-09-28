# Vectis ERP — Android Project Audit (READ-ONLY)

**Target:** `C:\Users\kermou\Documents\vectis`
**Date:** 2026-09-27
**Mode:** Read-only. No project file was created, modified, moved, or deleted.

---

## 1. Executive Summary

| Property | Value |
| --- | --- |
| Project type | Android ERP client (staff operations) |
| Language | Kotlin 2.2.10, 100% Jetpack Compose (no XML layouts) |
| Architecture | MVVM + Repository, feature-based packages, single module |
| Modules | 1 (`:app`) |
| Package | `com.vectis.erp` (no old/conflicting package names found) |
| Build system | Gradle 9.3.1 wrapper, AGP 9.1.1, version catalog `libs.versions.toml` |
| SDK | compileSdk/targetSdk 35, minSdk 26, JDK 17 |
| DI | None (manual `remember {}` + `viewModel(factory=...)`) |
| Networking | Retrofit 2.12 + OkHttp 4.12 + Gson, single `NetworkClient` |
| Local persistence | `EncryptedSharedPreferences` only — no local business DB |
| Files scanned | 108 source files (89 main Kotlin, 3 XML resources, 16 unit tests) + 5 build files |
| Build status | `assembleDebug` SUCCEEDS; `testDebugUnitTest` SUCCEEDS (16 test classes) |

**Structural observation.** The codebase is internally consistent and unusually disciplined for an
agent-generated project. There is exactly one HTTP client, one auth session owner, one navigation
graph, and no local business database. Layer discipline holds: no Compose screen performs network
or storage I/O directly. The findings below are therefore mostly *additive cruft* (dead
abstractions, unused resources) and *hardening gaps*, not structural rot.

**Counts:** 4 unused/duplicate files, 1 duplicate concern, 3 architecture findings,
4 dependency findings, 5 security findings, 4 resource findings.

---

## 2. Project Structure

```
vectis/
├── app/
│   ├── build.gradle.kts
│   ├── proguard-rules.pro
│   └── src/
│       ├── main/
│       │   ├── AndroidManifest.xml
│       │   ├── java/com/vectis/erp/
│       │   │   ├── VectisApplication.kt
│       │   │   ├── MainActivity.kt
│       │   │   ├── core/
│       │   │   │   ├── authorization/   PermissionManager, UserRole
│       │   │   │   ├── currency/        CurrencyFormatter
│       │   │   │   ├── design/           Color, Type, Theme, VectisButtons,
│       │   │   │   │                     VectisTopAppBar, VectisSnackbarHost,
│       │   │   │   │                     PullToRefresh, CurrencyPickerModal
│       │   │   │   ├── network/          NetworkClient, ApiResult,
│       │   │   │   │                     AuthInterceptor, DeviceInterceptor,
│       │   │   │   │                     SensitiveDataFilterLoggingInterceptor
│       │   │   │   ├── notification/     NotificationHelper        [UNUSED]
│       │   │   │   └── security/         SecureStorage, PasswordValidator
│       │   │   ├── data/
│       │   │   │   ├── api/              10 Retrofit service interfaces
│       │   │   │   ├── model/            10 DTO/model files
│       │   │   │   └── repository/       11 *RepositoryImpl       [1 UNUSED]
│       │   │   ├── domain/repository/    10 interfaces (1 impl unused)
│       │   │   ├── feature/              alerts, auth, customers, dashboard,
│       │   │   │                         inventory, orders, pairing, products,
│       │   │   │                         search, settings
│       │   │   └── navigation/           Screen, VectisNavGraph
│       │   └── res/values/               colors.xml, strings.xml, themes.xml
│       └── test/java/com/vectis/erp/      16 unit test classes
├── build.gradle.kts
├── settings.gradle.kts
├── gradle.properties
├── gradle/libs.versions.toml
├── local.properties
├── gradlew / gradlew.bat
├── app-debug.apk
├── PROJECT_AUDIT.md
└── reports/
```

---

## 3. Architecture Diagram

```
Compose Screen / Dialog            feature/*/…Screen.kt, *Dialogs.kt
        │  (UiState, callbacks)
        ▼
ViewModel (StateFlow<UiState>)    feature/*/…ViewModel.kt  + Factory
        │  (domain repository interface)
        ▼
Repository interface               domain/repository/*.kt
        │
        ▼
Repository implementation          data/repository/*RepositoryImpl.kt
        │  (networkClient.createService<T>())
        ▼
Retrofit service interface          data/api/*ApiService.kt
        │
        ▼
NetworkClient (OkHttp)            core/network/NetworkClient.kt
        │  AuthInterceptor  → Bearer token, 401 handling, X-New-Token
        │  DeviceInterceptor→ X-Device-Id / X-Device-Token, revocation
        │  SensitiveDataFilterLoggingInterceptor
        ▼
REST backend  (default http://10.0.2.2:3000, user-configurable)

SecureStorage (EncryptedSharedPreferences) ← injected into interceptors,
                                              repositories, ViewModels
```

---

## 4. File Findings

| File | Category | Status | Evidence | Risk | Recommendation |
| --- | --- | --- | --- | --- | --- |
| `core/notification/NotificationHelper.kt` | Dead code | **Probably unused** | Only reference is its own declaration (`NotificationHelper.kt:12`). No caller anywhere in main or test. | Low | Remove or wire to a real alert-notification trigger |
| `core/design/VectisButtons.kt` (`VectisPillButton`) | Dead code | **Definitely unused** | Zero call sites for `VectisPillButton` / `VectisButton` / `PrimaryButton` across all `.kt` | Low | Remove, or adopt as the standard button |
| `domain/repository/CurrencyRepository.kt` + `data/repository/CurrencyRepositoryImpl.kt` | Duplicate path | **Probably unused** | Currency data is fetched directly via `CurrencyApiService` from `SettingsRepositoryImpl.kt:48` and `CurrencyPickerModal.kt:53` instead | Medium | Collapse the repository pair, or route both callers through it |
| `navigation/VectisNavGraph.kt:543` `PlaceholderScreen` | Dead code | **Probably unused** | Single reference is its own definition | Low | Remove |
| `SecureStorage.clearAll()` | Dead code | **Probably unused** | Declared `SecureStorage.kt:126`; no caller | Low | Remove or wire to a "reset app" action |
| `SecureStorage.memoryLastSessionError` | Inconsistent | Active but volatile | Set in `AuthInterceptor.kt:68` / `DeviceInterceptor.kt:39`, read once in `LoginViewModel.kt:23`; never persisted | Low | Intentional design; note it is lost on process death |
| `app-debug.apk` (repo root) | Generated artifact | **Suspicious** | Committed binary APK at project root | Medium | Remove from VCS; add to `.gitignore` |
| `core/design/CurrencyPickerModal.kt` | Boundary violation | Active | Performs `createService<CurrencyApiService>()` **inside a composable** (line 53) — UI doing networking | Medium | Move fetch into `SettingsViewModel` |
| `data/repository/*RepositoryImpl.kt` (11 files) | Active | Active | All instantiated in `VectisNavGraph.kt` except `CurrencyRepositoryImpl` | — | — |
| `feature/*/…ViewModel.kt` (8 files) | Active | Active | All wired via `viewModel(factory = …)` in the nav graph | — | — |
| `data/api/*ApiService.kt` (10 files) | Active | Active | All reached through repository impls | — | — |
| `res/values/strings.xml` | Partly unused | Active (partial) | 14 strings; UI uses hardcoded literals instead (see §9) | Low | Adopt `stringResource()` or delete the unused ones |
| `res/values/colors.xml` | Partly unused | Active (partial) | 4 colors; Compose uses `core/design/Color.kt` (`PrimaryBlue`, `Slate500`) | Low | Single source of truth for colors |
| `16 unit test classes` | Active | Active | Parsing, auth-session, password, permission, logging-filter tests | — | Good coverage of pure logic |

---

## 5. Duplicate Implementations

| Area | Implementation A | Implementation B | Evidence | Recommendation |
| --- | --- | --- | --- | --- |
| Currency fetching | `CurrencyRepository` / `CurrencyRepositoryImpl` (repository layer) | Direct `createService<CurrencyApiService>()` inside `SettingsRepositoryImpl.kt:48` and `CurrencyPickerModal.kt:53` | The repository pair has no consumers; both live paths bypass it | Pick one pattern. The repository is the architecturally correct one |
| Header injection | `AuthInterceptor.kt:20-23` + `DeviceInterceptor.kt:26-31` (application interceptors) | `NetworkClient.kt:49-66` (a `addNetworkInterceptor` that re-injects the **same** `Authorization`, `X-Device-Id`, `X-Device-Token` headers) | The network interceptor checks `req.header(...) == null`, so it is a defensive second pass — functionally redundant | Remove the network interceptor; the two application interceptors already cover it |
| Color definitions | `res/values/colors.xml` | `core/design/Color.kt` | Manifest theme uses `colors.xml` values; Compose uses `Color.kt` constants | Keep one; drift risk is low but real |
| Button styling | `VectisPillButton` (`VectisButtons.kt`) | Inline `Button(...)` calls throughout screens | `VectisPillButton` has zero call sites | Adopt or delete |

---

## 6. Architecture Findings

### Finding 1 — Repositories and ViewModels are constructed inside the navigation composable

**Evidence.** `VectisNavGraph.kt:66-115` builds every repository implementation and ViewModel with
`remember { …Impl(app.networkClient, secureStorage) }` and `viewModel(factory = …)`. There is no DI
container; `VectisApplication` holds only `secureStorage` and `networkClient`.

**Affected files.** `navigation/VectisNavGraph.kt`, `VectisApplication.kt`.

**Why it matters.** Object graphs are assembled in UI code. This makes ViewModels effectively
scoped to the composition rather than to the Activity, so state is destroyed when the NavHost
leaves composition. It is workable, but it is the single largest deviation from the project's own
otherwise-clean layering, and it is the main obstacle to unit-testing ViewModels with fakes.

**Suggested action (not applied).** Introduce a minimal `AppContainer` (or Hilt) and construct
ViewModels against interfaces. Deferred — the current approach is functional.

### Finding 2 — A composable performs network I/O

**Evidence.** `CurrencyPickerModal.kt:53` calls `app.networkClient.createService<CurrencyApiService>()`
and fetches inside the composable scope.

**Affected files.** `core/design/CurrencyPickerModal.kt`.

**Why it matters.** Breaks the UI→ViewModel→Repository boundary that the other 9 features respect.
Also untestable without a live network.

**Suggested action (not applied).** Hoist the fetch into `SettingsViewModel` and pass state in.

### Finding 3 — Two interceptors do the same job

**Evidence.** `NetworkClient.kt:49-66` re-injects headers that `AuthInterceptor.kt:20-31` and
`DeviceInterceptor.kt:26-31` already inject.

**Affected files.** `core/network/NetworkClient.kt`, `AuthInterceptor.kt`, `DeviceInterceptor.kt`.

**Why it matters.** Dead-by-construction code that a future maintainer must still reason about. It
also makes the request-header logic exist in two places, which is a drift risk.

**Suggested action (not applied).** Delete the `addNetworkInterceptor` block; the two application
interceptors plus the `authenticator` already cover the cases.

---

## 7. Gradle & Dependencies

| Finding | Detail | Risk |
| --- | --- | --- |
| `androidx.security:security-crypto:1.1.0-alpha06` | **Alpha** dependency used in a production path (`SecureStorage.create`) | Medium |
| Camera/ML Kit declared as hardcoded strings | `build.gradle.kts:71-74` uses inline coordinates (`camera-*:1.4.1`, `barcode-scanning:17.3.0`) instead of the version catalog — inconsistent with the rest of the file | Low |
| `okhttp:logging-interceptor` | The `SensitiveDataFilterLoggingInterceptor` is **hand-written**; the library interceptor is declared but the audit found no `HttpLoggingInterceptor` usage | Low (unused dep) |
| `isMinifyEnabled = false` for release | No R8 minification or shrinking in release builds; `proguard-rules.pro` is configured but effectively inert | Medium |
| Compose BOM `2024.09.00` | Materially older than the `material3 = "1.3.1"` and `navigationCompose = "2.8.9"` entries it coexists with | Low |
| `unitTests.isReturnDefaultValues = true` | Makes unmocked Android framework calls silently return defaults instead of throwing — can mask test gaps | Informational |

No version conflicts, no duplicate dependencies, no incorrect scopes were found. `kotlin` and `agp`
versions are consistent across the catalog and the build files. Nothing was upgraded or changed.

---

## 8. Manifest & Permissions

**Declared components**

| Component | Exported | Notes |
| --- | --- | --- |
| `.MainActivity` | `true` (required for LAUNCHER) | Only activity; carries the MAIN/LAUNCHER filter |
| `.VectisApplication` | n/a | Initializes SecureStorage + NetworkClient |

No services, receivers, or providers are declared. `NotificationHelper` would need no manifest entry
(alerts are built in-app), so its absence here is not a cause of its being unused.

**Permissions**

| Permission | Used? | Assessment |
| --- | --- | --- |
| `INTERNET` | Yes | Required for all API calls |
| `ACCESS_NETWORK_STATE` | Indirectly | Not referenced in code; standard for network-aware clients |
| `CAMERA` | Yes | `feature/pairing/ScanQrScreen.kt` (QR pairing), with `required="false"` feature guard |
| `POST_NOTIFICATIONS` | **No** | `NotificationHelper` is never called, so no notification is ever posted. The permission is currently unnecessary — but it becomes required if `NotificationHelper` is wired up |

**Other manifest observations**

- `android:usesCleartextTraffic="true"` — see §13 (High).
- `android:allowBackup="false"`, `dataExtractionRules="@null"`, `fullBackupContent="false"` — good;
  the Keystore-backed token store is correctly excluded from backup/restore.
- `android:icon` / `roundIcon` point at `@android:drawable/sym_def_app_icon` — the system default.
  No launcher icon assets exist in the project (`res/` has no `mipmap/`). Informational.

---

## 9. Resources

| Finding | Evidence | Risk | Recommendation |
| --- | --- | --- | --- |
| No launcher icon assets | `res/` contains only `values/`; manifest uses the system icon | Low | Add a `mipmap` icon set before release |
| `strings.xml` largely bypassed | Only `app_name` and `Theme.VectisERP` are referenced (manifest/theme). UI strings are hardcoded literals, e.g. `DashboardScreen`, `VectisNavGraph.kt:484` `contentDescription = "Dashboard"` | Low | Either adopt `stringResource()` or drop the unused entries |
| `colors.xml` duplicates Compose colors | `primary_blue` (`#2563EB`) vs `Color.kt` `PrimaryBlue` | Low | Pick one source of truth |
| No drawable/navigation/raw/font/menu resources | Resource surface is minimal — no legacy drawable piles to clean | — | — |

No duplicate drawables, obsolete layouts, or XML navigation graphs exist, because there are no
layout XML files at all.

---

## 10. Navigation Map

```
[App start]  isDevicePaired? ──no──► Pairing
              isAuthenticated? ─no──► Login
                                ─yes─► Dashboard
                                      │
   ┌──────────┬──────────┬───────────┼───────────┬──────────┐
Dashboard   Orders    Products   Inventory   Customers    (bottom bar, 5 items)
   │           │          │            │            │
   │           ├─► OrderDetail/{orderId} ◄──────────────┤ (from Dashboard, Customers, Alerts, Search)
   │           └─► CreateOrder ──► OrderDetail
   │           │
   │           └─► Products / Inventory / Customers (cross-links)
   │
   ├─► Products, Inventory, Customers, Alerts, Settings (dashboard shortcuts)
   └─► GlobalSearch (dialog overlay, not a route)
                 └─► CustomerDetail/{customerId} | OrderDetail/{orderId} | Products | Inventory

Pairing ──► ScanQr ──┐
        └─► EnterCode ┴─► Login

Alerts, Settings  (reachable from most top bars, not in bottom bar)
Alerts ──► OrderDetail

Unauthorized (401) ──► Login (or Pairing if unpaired), popUpTo(0) inclusive
Device revoked ─────► Pairing, popUpTo(0) inclusive
Logout ─────────────► Login, popUpTo(0) inclusive
```

**Findings**

- `Screen.UniversalSearch` (`Screen.kt:32`, route `"search"`) has **no `composable` destination** in
  the nav graph. Search is implemented as a dialog (`GlobalSearchDialog`) toggled by a boolean. The
  route constant is dead — **probably unused**.
- All 14 declared `Screen` objects except `UniversalSearch` have a matching `composable`. No
  unreachable screens.
- No duplicate screens. `CustomerDetailScreen` / `OrderDetailScreen` reuse the list ViewModels
  (passed in as parameters) rather than owning separate ones — intentional and consistent.
- `Settings` and `Alerts` are reachable via top-bar actions but are not bottom-bar items; this is a
  design choice, not a defect.

---

## 11. Authentication

**Actual flow, traced through the code:**

1. **Device pairing gate.** `VectisNavGraph.kt:56-62` picks the start destination:
   not paired → `Pairing`; paired but no session → `Login`; else `Dashboard`.
2. **Pairing.** `PairingRepositoryImpl` → `PairingApiService`; on success `SecureStorage.setDeviceId/setDeviceToken`.
   Two entry paths: `ScanQrScreen` (CameraX + ML Kit barcode) and `EnterCodeScreen` (manual code + server URL).
3. **Login.** `LoginViewModel` → `AuthRepositoryImpl.login()` → `AuthApiService.login()`.
   On `200` with `body.success && body.token != null && body.user != null`
   (`AuthRepositoryImpl.kt:28`), the session is persisted: `setAuthToken`, `setUserId`, `setUserRole`,
   `setUserName`, and `setPreferredCurrency` (uppercased).
4. **Token storage.** `SecureStorage` writes to `EncryptedSharedPreferences`
   (keys `AES256_SIV` / values `AES256_GCM`) backed by an `AES256_GCM` `MasterKey` in the Android
   Keystore. An in-memory `@Volatile` cache mirrors each value for read speed.
   **Fallback:** if Keystore construction or a write/read probe throws, it silently degrades to
   plain `getSharedPreferences` (`SecureStorage.kt:170-174`).
5. **Request injection.** `AuthInterceptor` adds `Authorization: Bearer <token>`; `DeviceInterceptor`
   adds `X-Device-Id` and `X-Device-Token`; `NetworkClient`'s `authenticator` retries once with the
   token if a 401 came back unauthenticated.
6. **Sliding refresh.** If the server returns `X-New-Token`, `AuthInterceptor.kt:29-32` replaces the
   stored token. `VectisNavGraph.kt:137-145` calls `authRepo.getMe()` every 15 minutes to keep the
   session and profile in sync.
7. **401 handling.** `AuthInterceptor.kt:45-73` peeks 2 KB of the error body, maps known server
   messages to a user-facing reason, stores it via `setLastSessionError`, calls `clearSession()`, and
   emits `unauthorizedEvents` → navigation resets to `Login`.
8. **Device revocation.** `DeviceInterceptor.kt:36-43` — a 401 carrying `X-Device-Revoked: true`
   clears both pairing and session, then emits `deviceRevokedEvents` → navigation to `Pairing`.
9. **Logout.** `AuthRepositoryImpl.logout()` calls the server (best effort) and **always** wipes local
   credentials in a `finally` block (`AuthRepositoryImpl.kt:84-94`). Network failure cannot leave a
   stale local session.

**Observations**

- Single auth system. No duplicate token manager, no mock/local auth, no debug bypass found.
- No hardcoded credentials in the app. `PasswordValidator` is used for password *change* forms
  (`SettingsDialogs.kt:127,272`, `SettingsScreen.kt:619`).
- The `AuthRepository` interface exposes `isAuthenticated()` / `getStoredUserRole()` /
  `getStoredUserName()`, all thin delegations to `SecureStorage` — these read local state, not the
  server, and are used for role-gating the UI.
- The Keystore→plaintext fallback (§13, Medium) is the main weakness in this flow.

---

## 12. API / Database

- **Base URL.** `SecureStorage.DEFAULT_SERVER_URL = "http://10.0.2.2:3000"` (emulator loopback),
  user-overridable in `EnterCodeScreen` and `PairingScreen`. `NetworkClient.getRetrofit()` rebuilds
  the Retrofit instance whenever the normalized base URL changes, so a server change takes effect
  without restarting the app.
- **Redirect canonicalization.** `AuthInterceptor.kt:35-43` watches for redirects and rewrites the
  stored base URL to the redirect target's scheme/host/port.
- **Result type.** All repositories return `ApiResult<T>` (`Success` / `Error(code, message)` /
  `NetworkError`). No repository throws to the UI.
- **Caching / persistence.** None for business data. `VectisApplication` documents this explicitly
  ("Rule 1: No local business database is created or initialized"), and the code honours it — there
  is no Room, no SQLite, no DataStore, and no local mock data anywhere in `src/main`.
- **Error handling.** Errors surface through `UiState` sealed classes; the nav graph re-loads data
  when a screen's state is not `Success`.
- **Polling.** A 15-second `LaunchedEffect` loop fetches the alert badge count
  (`VectisNavGraph.kt:72-83`), and a 15-minute loop calls `getMe()`.
- **Unused endpoints.** `CurrencyApiService` is used, but through two direct callers rather than its
  own repository (see §5). No orphan API service interfaces were found.

---

## 13. Security Findings

Secrets are redacted per the audit rules.

### High

**1. Cleartext traffic is enabled application-wide.**
`AndroidManifest.xml:24` sets `android:usesCleartextTraffic="true"`, and the default server URL is
`http://10.0.2.2:3000` (`SecureStorage.kt:151`). Every request — including `Authorization: Bearer
<token>`, `X-Device-Token`, and login credentials in the POST body — is permitted over plaintext
HTTP. There is no per-domain network security config, so this applies to *any* server the user
enters, including a typo'd public hostname. Anyone on the same network can capture the session JWT
and device token and impersonate the user until the token expires.
*Recommendation:* remove the attribute, add a `network_security_config.xml` that permits cleartext
only for `10.0.2.2`/`localhost` (debug), and enforce `https://` for the settings/pairing URL field.

### Medium

**2. Token store silently degrades from Keystore to plaintext SharedPreferences.**
`SecureStorage.create()` wraps Keystore setup and a read/write probe in a `try`, and on any
exception falls back to unencrypted `getSharedPreferences` (`SecureStorage.kt:170-174`). The
failure is swallowed — no log, no user-facing warning. On affected devices the session JWT, device
token, user id, role and name are all stored in a plaintext XML file readable by anything with the
app's data directory access (rooted device, `adb backup` on old targets, or a future path
exploit). Because the fallback is invisible, the app gives no signal that security degraded.
*Recommendation:* log loudly, surface a warning in Settings, and consider refusing to persist the
auth token when the Keystore is unavailable.

**3. Error bodies are logged on 401.**
`AuthInterceptor.kt:49-56` peeks up to 2 KB of the 401 body and writes it to logcat with `Log.e`
alongside the full request URL and method. Server error bodies in this system can contain session
and account detail; logcat is readable by other apps on older targets and by anyone with `adb`.
*Recommendation:* log a status code and the mapped user reason only, never the raw body.

### Low

**4. Debug artifacts and build outputs are present in the project directory.**
`app-debug.apk` sits at the repository root, alongside `build/` and `.gradle/`/`.idea/`/`.kotlin/`.
`.gitignore` exists but the APK is a committed-style binary at the root. This raises the chance of
shipping a debug-signed, unminified build.
*Recommendation:* confirm `.gitignore` covers `*.apk`, `build/`, `.gradle/`, `.idea/`, `.kotlin/`.

**5. No certificate pinning and no release minification.**
No `network_security_config.xml` or `CertificatePinner` is configured. `isMinifyEnabled = false`
means release builds ship unstripped, unobfuscated code, making reverse engineering easier.
*Recommendation:* both are defense-in-depth; pin only if the threat model requires it.

### Informational

- `POST_NOTIFICATIONS` is declared but unused (no code posts notifications).
- The app uses the default system launcher icon.
- `LocalLog`-style debugging, hardcoded `Bearer` tokens, `BuildConfig.DEBUG` branches, and
  `TODO`/`FIXME` markers were searched for and **not found**.

---

## 14. Recommended Cleanup Plan

**None of the phases below were performed.** They are proposals for review.

### Phase 1 — Safe cleanup (strongest evidence, lowest risk)

| Item | File | Evidence |
| --- | --- | --- |
| `VectisPillButton` | `core/design/VectisButtons.kt` | Zero call sites, exact-name grep across all Kotlin |
| `PlaceholderScreen` | `navigation/VectisNavGraph.kt:542-550` | Single reference is its own definition |
| `Screen.UniversalSearch` | `navigation/Screen.kt:32` | No `composable` destination; search is a dialog |
| `SecureStorage.clearAll()` | `core/security/SecureStorage.kt:126` | Declared, never called |
| `app-debug.apk` | repository root | Generated binary; belongs in `.gitignore` |

### Phase 2 — Duplicate consolidation (requires review)

| Item | Files | Action |
| --- | --- | --- |
| Currency data path | `domain/repository/CurrencyRepository.kt`, `data/repository/CurrencyRepositoryImpl.kt` vs `SettingsRepositoryImpl.kt:48`, `CurrencyPickerModal.kt:53` | Route both live callers through the repository, then delete the direct API calls |
| Header injection | `NetworkClient.kt:49-66` vs `AuthInterceptor.kt`, `DeviceInterceptor.kt` | Remove the redundant network interceptor |
| `NotificationHelper` | `core/notification/NotificationHelper.kt` | Decide: wire it to subscription-expiry alerts (then `POST_NOTIFICATIONS` becomes justified) or delete it together with that permission |

### Phase 3 — Architecture improvements

| Item | Files | Action |
| --- | --- | --- |
| Object graph in the nav composable | `VectisNavGraph.kt:66-115` | Extract an `AppContainer`; move ViewModel construction out of UI |
| Network I/O in a composable | `CurrencyPickerModal.kt:53` | Hoist into `SettingsViewModel` |
| Color duplication | `res/values/colors.xml` vs `core/design/Color.kt` | Single source of truth |
| String resources bypassed | `res/values/strings.xml` | Adopt `stringResource()` or delete unused entries |

### Phase 4 — Optional optimization

| Item | Detail |
| --- | --- |
| `security-crypto:1.1.0-alpha06` | Plan migration off the alpha |
| Camera/ML Kit inline versions | Move into `libs.versions.toml` |
| `okhttp-logging-interceptor` | Unused if the hand-written filter stays; remove otherwise |
| `isMinifyEnabled = false` | Enable R8 for release once keep-rules are validated |
| Compose BOM age | Align `2024.09.00` with the newer `material3`/`navigation` entries |
| `unitTests.isReturnDefaultValues` | Review whether silent defaults hide test gaps |

---

## Verification Performed (read-only)

| Command | Result |
| --- | --- |
| `gradlew :app:assembleDebug --offline` | **BUILD SUCCESSFUL** |
| `gradlew :app:testDebugUnitTest --offline` | **BUILD SUCCESSFUL** (16 test classes executed) |
| `gradlew :app:dependencies` | Not run — no JDK on `PATH`; used Android Studio's bundled JBR for the two commands above |

The project built and tested successfully **as found**. No existing build error was discovered, and
no issue in this report was fixed or introduced.
