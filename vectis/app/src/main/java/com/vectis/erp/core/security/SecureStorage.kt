package com.vectis.erp.core.security

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

/**
 * SecureStorage - Encrypted local storage using Android Keystore.
 * Strictly adheres to Rule 1: Stores ONLY session/device tokens and non-sensitive preferences.
 * ZERO business entities (no customers, orders, products, inventory) are stored locally.
 */
class SecureStorage(private val prefs: SharedPreferences) {

    @Volatile private var memoryServerUrl: String? = prefs.getString(KEY_SERVER_URL, DEFAULT_SERVER_URL)
    @Volatile private var memoryDeviceId: String? = prefs.getString(KEY_DEVICE_ID, null)
    @Volatile private var memoryDeviceToken: String? = prefs.getString(KEY_DEVICE_TOKEN, null)
    @Volatile private var memoryAuthToken: String? = prefs.getString(KEY_AUTH_TOKEN, null)
    @Volatile private var memoryUserId: String? = prefs.getString(KEY_USER_ID, null)
    @Volatile private var memoryUserRole: String? = prefs.getString(KEY_USER_ROLE, null)
    @Volatile private var memoryUserName: String? = prefs.getString(KEY_USER_NAME, null)
    @Volatile private var memoryPreferredCurrency: String? = prefs.getString(KEY_PREFERRED_CURRENCY, "USD")
    @Volatile private var memoryLastSessionError: String? = null

    // Server Configuration
    fun getServerUrl(): String = memoryServerUrl ?: DEFAULT_SERVER_URL
    fun setServerUrl(url: String) {
        val cleanUrl = url.trim().trimEnd('/')
        memoryServerUrl = cleanUrl
        try { prefs.edit().putString(KEY_SERVER_URL, cleanUrl).commit() } catch (_: Exception) {}
    }

    // Device Pairing Credentials
    fun getDeviceId(): String? = (memoryDeviceId ?: try { prefs.getString(KEY_DEVICE_ID, null) } catch (_: Exception) { null }?.also { memoryDeviceId = it })?.trim()?.trim('"', '\'')
    fun setDeviceId(deviceId: String) {
        val clean = deviceId.trim().trim('"', '\'')
        memoryDeviceId = clean
        try { prefs.edit().putString(KEY_DEVICE_ID, clean).commit() } catch (_: Exception) {}
    }

    fun getDeviceToken(): String? = (memoryDeviceToken ?: try { prefs.getString(KEY_DEVICE_TOKEN, null) } catch (_: Exception) { null }?.also { memoryDeviceToken = it })?.trim()?.trim('"', '\'')
    fun setDeviceToken(token: String) {
        val clean = token.trim().trim('"', '\'')
        memoryDeviceToken = clean
        try { prefs.edit().putString(KEY_DEVICE_TOKEN, clean).commit() } catch (_: Exception) {}
    }

    fun isDevicePaired(): Boolean = !getDeviceId().isNullOrBlank() && !getDeviceToken().isNullOrBlank()

    fun clearDevicePairing() {
        memoryDeviceId = null
        memoryDeviceToken = null
        try {
            prefs.edit()
                .remove(KEY_DEVICE_ID)
                .remove(KEY_DEVICE_TOKEN)
                .commit()
        } catch (_: Exception) {}
    }

    // User Session Token (JWT)
    fun getAuthToken(): String? = (memoryAuthToken ?: try { prefs.getString(KEY_AUTH_TOKEN, null) } catch (_: Exception) { null }?.also { memoryAuthToken = it })?.trim()?.trim('"', '\'')
    fun setAuthToken(token: String) {
        val clean = token.trim().trim('"', '\'')
        memoryAuthToken = clean
        try { prefs.edit().putString(KEY_AUTH_TOKEN, clean).commit() } catch (_: Exception) {}
    }

    fun getUserId(): String? = memoryUserId ?: try { prefs.getString(KEY_USER_ID, null) } catch (_: Exception) { null }?.also { memoryUserId = it }
    fun setUserId(userId: String) {
        memoryUserId = userId
        try { prefs.edit().putString(KEY_USER_ID, userId).commit() } catch (_: Exception) {}
    }

    fun getUserRole(): String? = memoryUserRole ?: try { prefs.getString(KEY_USER_ROLE, null) } catch (_: Exception) { null }?.also { memoryUserRole = it }
    fun setUserRole(role: String) {
        memoryUserRole = role
        try { prefs.edit().putString(KEY_USER_ROLE, role).commit() } catch (_: Exception) {}
    }

    fun getUserName(): String? = memoryUserName ?: try { prefs.getString(KEY_USER_NAME, null) } catch (_: Exception) { null }?.also { memoryUserName = it }
    fun setUserName(name: String) {
        memoryUserName = name
        try { prefs.edit().putString(KEY_USER_NAME, name).commit() } catch (_: Exception) {}
    }

    fun isAuthenticated(): Boolean = !getAuthToken().isNullOrBlank()

    private val _preferredCurrencyFlow = kotlinx.coroutines.flow.MutableStateFlow(getPreferredCurrency())
    val preferredCurrencyFlow: kotlinx.coroutines.flow.StateFlow<String> = _preferredCurrencyFlow

    fun getPreferredCurrency(): String = memoryPreferredCurrency ?: "USD"
    fun setPreferredCurrency(currency: String) {
        val upper = currency.trim().uppercase()
        memoryPreferredCurrency = upper
        try { prefs.edit().putString(KEY_PREFERRED_CURRENCY, upper).commit() } catch (_: Exception) {}
        _preferredCurrencyFlow.value = upper
    }

    fun getLastSessionError(): String? = memoryLastSessionError
    fun setLastSessionError(error: String?) {
        memoryLastSessionError = error
    }
    fun clearLastSessionError() {
        memoryLastSessionError = null
    }

    fun clearSession() {
        memoryAuthToken = null
        memoryUserId = null
        memoryUserRole = null
        memoryUserName = null
        memoryPreferredCurrency = "USD"
        try {
            prefs.edit()
                .remove(KEY_AUTH_TOKEN)
                .remove(KEY_USER_ID)
                .remove(KEY_USER_ROLE)
                .remove(KEY_USER_NAME)
                .remove(KEY_PREFERRED_CURRENCY)
                .commit()
        } catch (_: Exception) {}
        _preferredCurrencyFlow.value = "USD"
    }

    fun clearAll() {
        memoryServerUrl = DEFAULT_SERVER_URL
        memoryDeviceId = null
        memoryDeviceToken = null
        memoryAuthToken = null
        memoryUserId = null
        memoryUserRole = null
        memoryUserName = null
        memoryPreferredCurrency = "USD"
        try { prefs.edit().clear().commit() } catch (_: Exception) {}
        _preferredCurrencyFlow.value = "USD"
    }

    companion object {
        private const val PREFS_FILENAME = "vectis_secure_keystore_prefs"
        private const val KEY_SERVER_URL = "server_base_url"
        private const val KEY_DEVICE_ID = "paired_device_id"
        private const val KEY_DEVICE_TOKEN = "paired_device_token"
        private const val KEY_AUTH_TOKEN = "session_jwt_token"
        private const val KEY_USER_ID = "authenticated_user_id"
        private const val KEY_USER_ROLE = "authenticated_user_role"
        private const val KEY_USER_NAME = "authenticated_user_name"
        private const val KEY_PREFERRED_CURRENCY = "user_preferred_currency"

        // Default local development base URL (points to 10.0.2.2 for Android emulator)
        const val DEFAULT_SERVER_URL = "http://10.0.2.2:3000"

        fun create(context: Context): SecureStorage {
            return try {
                val masterKey = MasterKey.Builder(context)
                    .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                    .build()

                val encryptedPrefs = EncryptedSharedPreferences.create(
                    context,
                    PREFS_FILENAME,
                    masterKey,
                    EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                    EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
                )
                // Test read/write probe to ensure Keystore is actually functional on this OEM device
                encryptedPrefs.edit().putString("__keystore_probe__", "ok").commit()
                encryptedPrefs.getString("__keystore_probe__", null)
                SecureStorage(encryptedPrefs)
            } catch (e: Exception) {
                // Fallback to standard private preferences if Keystore encounters device-specific OEM bugs
                val fallbackPrefs = context.getSharedPreferences(PREFS_FILENAME + "_fallback", Context.MODE_PRIVATE)
                SecureStorage(fallbackPrefs)
            }
        }
    }
}
