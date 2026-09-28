package com.vectis.erp

import com.google.gson.Gson
import com.vectis.erp.data.model.LoginResponse
import com.vectis.erp.data.model.UserDto
import org.junit.Assert.*
import org.junit.Test

/**
 * AuthSessionTest - Verifies auth models parsing and session contracts
 */
class AuthSessionTest {

    private val gson = Gson()

    @Test
    fun testLoginResponseParsing() {
        val json = """
            {
              "success": true,
              "token": "header.payload.signature",
              "user": {
                "id": "usr_101",
                "username": "admin",
                "email": "admin@vectis.io",
                "name": "Super Admin",
                "role": "owner",
                "status": "active",
                "preferred_currency": "USD"
              }
            }
        """.trimIndent()

        val resp = gson.fromJson(json, LoginResponse::class.java)
        assertNotNull(resp)
        assertTrue(resp.success)
        assertEquals("header.payload.signature", resp.token)
        assertEquals("owner", resp.user?.role)
        assertEquals("Super Admin", resp.user?.name)
        assertEquals("USD", resp.user?.preferredCurrency)
    }

    @Test
    fun testPreferredCurrencyParity() {
        listOf("USD", "EUR", "MAD", "GBP").forEach { curr ->
            val json = """{"success":true,"token":"t","user":{"id":"1","username":"u","email":"e","name":"n","role":"admin","preferred_currency":"$curr"}}"""
            val resp = gson.fromJson(json, LoginResponse::class.java)
            assertEquals(curr, resp.user?.preferredCurrency)
        }
    }

    @Test
    fun testUserRoleHierarchyContract() {
        val roles = listOf("owner", "admin", "manager", "agent", "viewer")
        val sampleUser = UserDto(
            id = "usr_1",
            username = "agent_john",
            email = "john@vectis.io",
            name = "John",
            role = "agent"
        )
        assertTrue(roles.contains(sampleUser.role))
        assertEquals("agent", sampleUser.role)
    }

    @Test
    fun testSecureStorageMemoryCacheAndSessionState() {
        val fakePrefs = FakeSharedPreferences()
        val storage = com.vectis.erp.core.security.SecureStorage(fakePrefs)

        assertFalse(storage.isAuthenticated())
        assertFalse(storage.isDevicePaired())

        // Pair device
        storage.setDeviceId("dev-1234")
        storage.setDeviceToken("tok-5678")
        assertTrue(storage.isDevicePaired())
        assertEquals("dev-1234", storage.getDeviceId())
        assertEquals("tok-5678", storage.getDeviceToken())

        // Login
        storage.setAuthToken("jwt.token.here")
        storage.setUserId("usr-1")
        storage.setUserRole("admin")
        storage.setUserName("Administrator")

        assertTrue(storage.isAuthenticated())
        assertEquals("jwt.token.here", storage.getAuthToken())
        assertEquals("usr-1", storage.getUserId())
        assertEquals("admin", storage.getUserRole())
        assertEquals("Administrator", storage.getUserName())

        // Clear session (preserves pairing)
        storage.clearSession()
        assertFalse(storage.isAuthenticated())
        assertNull(storage.getAuthToken())
        assertTrue(storage.isDevicePaired())

        // Clear pairing
        storage.clearDevicePairing()
        assertFalse(storage.isDevicePaired())
        assertNull(storage.getDeviceId())

        // Last session error lifecycle
        assertNull(storage.getLastSessionError())
        storage.setLastSessionError("Session expired. Please log in again.")
        assertEquals("Session expired. Please log in again.", storage.getLastSessionError())
        storage.clearLastSessionError()
        assertNull(storage.getLastSessionError())

        // Token & Credential Sanitization
        storage.setAuthToken("  \"jwt.token.with.quotes\"  ")
        assertEquals("jwt.token.with.quotes", storage.getAuthToken())

        storage.setDeviceId("  dev-999  ")
        assertEquals("dev-999", storage.getDeviceId())

        storage.setDeviceToken("  'tok-secret'  ")
        assertEquals("tok-secret", storage.getDeviceToken())

        storage.setServerUrl("  http://192.168.1.50:3000/  ")
        assertEquals("http://192.168.1.50:3000", storage.getServerUrl())
    }

    @Test
    fun testAuthInterceptorHandles401OnAnyEndpoint() {
        val fakePrefs = FakeSharedPreferences()
        val storage = com.vectis.erp.core.security.SecureStorage(fakePrefs)
        storage.setAuthToken("expired.jwt.token")
        assertTrue(storage.isAuthenticated())

        var unauthorizedCalled = false
        val interceptor = com.vectis.erp.core.network.AuthInterceptor(storage) {
            unauthorizedCalled = true
        }

        val request = okhttp3.Request.Builder()
            .url("http://localhost:3000/api/orders")
            .build()

        val mediaType = okhttp3.MediaType.Companion.run { "application/json".toMediaType() }
        val body = okhttp3.ResponseBody.Companion.run { """{"error":"Invalid or expired session token."}""".toResponseBody(mediaType) }
        val response = okhttp3.Response.Builder()
            .request(request)
            .protocol(okhttp3.Protocol.HTTP_1_1)
            .code(401)
            .message("Unauthorized")
            .body(body)
            .build()

        val fakeChain = object : okhttp3.Interceptor.Chain {
            private var currentRequest: okhttp3.Request = request
            override fun request(): okhttp3.Request = currentRequest
            override fun proceed(req: okhttp3.Request): okhttp3.Response {
                currentRequest = req
                return response.newBuilder().request(req).build()
            }
            override fun call(): okhttp3.Call = throw NotImplementedError()
            override fun connectTimeoutMillis(): Int = 0
            override fun connection(): okhttp3.Connection? = null
            override fun readTimeoutMillis(): Int = 0
            override fun withConnectTimeout(timeout: Int, unit: java.util.concurrent.TimeUnit): okhttp3.Interceptor.Chain = this
            override fun withReadTimeout(timeout: Int, unit: java.util.concurrent.TimeUnit): okhttp3.Interceptor.Chain = this
            override fun withWriteTimeout(timeout: Int, unit: java.util.concurrent.TimeUnit): okhttp3.Interceptor.Chain = this
            override fun writeTimeoutMillis(): Int = 0
        }

        interceptor.intercept(fakeChain)

        assertTrue("onUnauthorized must be invoked on 401", unauthorizedCalled)
        assertFalse("Session token must be cleared", storage.isAuthenticated())
        assertEquals("Session expired. Please log in again.", storage.getLastSessionError())
    }
}

private class FakeSharedPreferences : android.content.SharedPreferences {
    private val data = mutableMapOf<String, Any?>()

    override fun getAll(): MutableMap<String, *> = data
    override fun getString(key: String?, defValue: String?): String? = data[key] as? String ?: defValue
    override fun getStringSet(key: String?, defValues: MutableSet<String>?): MutableSet<String>? = null
    override fun getInt(key: String?, defValue: Int): Int = data[key] as? Int ?: defValue
    override fun getLong(key: String?, defValue: Long): Long = data[key] as? Long ?: defValue
    override fun getFloat(key: String?, defValue: Float): Float = data[key] as? Float ?: defValue
    override fun getBoolean(key: String?, defValue: Boolean): Boolean = data[key] as? Boolean ?: defValue
    override fun contains(key: String?): Boolean = data.containsKey(key)
    override fun edit(): android.content.SharedPreferences.Editor = Editor(data)
    override fun registerOnSharedPreferenceChangeListener(listener: android.content.SharedPreferences.OnSharedPreferenceChangeListener?) {}
    override fun unregisterOnSharedPreferenceChangeListener(listener: android.content.SharedPreferences.OnSharedPreferenceChangeListener?) {}

    class Editor(private val map: MutableMap<String, Any?>) : android.content.SharedPreferences.Editor {
        private val temp = mutableMapOf<String, Any?>()
        private val removed = mutableSetOf<String>()
        private var clear = false

        override fun putString(key: String?, value: String?): android.content.SharedPreferences.Editor {
            if (key != null) temp[key] = value
            return this
        }
        override fun putStringSet(key: String?, values: MutableSet<String>?): android.content.SharedPreferences.Editor = this
        override fun putInt(key: String?, value: Int): android.content.SharedPreferences.Editor { if (key != null) temp[key] = value; return this }
        override fun putLong(key: String?, value: Long): android.content.SharedPreferences.Editor { if (key != null) temp[key] = value; return this }
        override fun putFloat(key: String?, value: Float): android.content.SharedPreferences.Editor { if (key != null) temp[key] = value; return this }
        override fun putBoolean(key: String?, value: Boolean): android.content.SharedPreferences.Editor { if (key != null) temp[key] = value; return this }
        override fun remove(key: String?): android.content.SharedPreferences.Editor { if (key != null) removed.add(key); return this }
        override fun clear(): android.content.SharedPreferences.Editor { clear = true; return this }
        override fun commit(): Boolean {
            if (clear) map.clear()
            removed.forEach { map.remove(it) }
            map.putAll(temp)
            return true
        }
        override fun apply() { commit() }
    }
}
