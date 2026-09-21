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

    // Server Configuration
    fun getServerUrl(): String = prefs.getString(KEY_SERVER_URL, DEFAULT_SERVER_URL) ?: DEFAULT_SERVER_URL
    fun setServerUrl(url: String) = prefs.edit().putString(KEY_SERVER_URL, url.trimEnd('/')).apply()

    // Device Pairing Credentials
    fun getDeviceId(): String? = prefs.getString(KEY_DEVICE_ID, null)
    fun setDeviceId(deviceId: String) = prefs.edit().putString(KEY_DEVICE_ID, deviceId).apply()

    fun getDeviceToken(): String? = prefs.getString(KEY_DEVICE_TOKEN, null)
    fun setDeviceToken(token: String) = prefs.edit().putString(KEY_DEVICE_TOKEN, token).apply()

    fun isDevicePaired(): Boolean = !getDeviceId().isNullOrBlank() && !getDeviceToken().isNullOrBlank()

    fun clearDevicePairing() {
        prefs.edit()
            .remove(KEY_DEVICE_ID)
            .remove(KEY_DEVICE_TOKEN)
            .apply()
    }

    // User Session Token (JWT)
    fun getAuthToken(): String? = prefs.getString(KEY_AUTH_TOKEN, null)
    fun setAuthToken(token: String) = prefs.edit().putString(KEY_AUTH_TOKEN, token).apply()

    fun getUserId(): String? = prefs.getString(KEY_USER_ID, null)
    fun setUserId(userId: String) = prefs.edit().putString(KEY_USER_ID, userId).apply()

    fun getUserRole(): String? = prefs.getString(KEY_USER_ROLE, null)
    fun setUserRole(role: String) = prefs.edit().putString(KEY_USER_ROLE, role).apply()

    fun getUserName(): String? = prefs.getString(KEY_USER_NAME, null)
    fun setUserName(name: String) = prefs.edit().putString(KEY_USER_NAME, name).apply()

    fun isAuthenticated(): Boolean = !getAuthToken().isNullOrBlank()

    fun clearSession() {
        prefs.edit()
            .remove(KEY_AUTH_TOKEN)
            .remove(KEY_USER_ID)
            .remove(KEY_USER_ROLE)
            .remove(KEY_USER_NAME)
            .apply()
    }

    fun clearAll() {
        prefs.edit().clear().apply()
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
                SecureStorage(encryptedPrefs)
            } catch (e: Exception) {
                // Fallback to standard private preferences if Keystore encounters device-specific OEM bugs
                val fallbackPrefs = context.getSharedPreferences(PREFS_FILENAME + "_fallback", Context.MODE_PRIVATE)
                SecureStorage(fallbackPrefs)
            }
        }
    }
}
