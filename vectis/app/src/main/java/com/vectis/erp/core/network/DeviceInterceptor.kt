package com.vectis.erp.core.network

import com.vectis.erp.core.security.SecureStorage
import okhttp3.Interceptor
import okhttp3.Response

/**
 * DeviceInterceptor - Injects hardware identity headers on every request:
 * X-Device-Id: dev-xxxxxxxx
 * X-Device-Token: dev_tok_xxxxxxxx
 * Intercepts revocation responses to wipe pairing credentials.
 */
class DeviceInterceptor(
    private val secureStorage: SecureStorage,
    private val onDeviceRevoked: () -> Unit
) : Interceptor {

    override fun intercept(chain: Interceptor.Chain): Response {
        val original = chain.request()
        val builder = original.newBuilder()

        val deviceId = secureStorage.getDeviceId()
        val deviceToken = secureStorage.getDeviceToken()

        if (!deviceId.isNullOrBlank()) {
            builder.header("X-Device-Id", deviceId)
        }
        if (!deviceToken.isNullOrBlank()) {
            builder.header("X-Device-Token", deviceToken)
        }

        val response = chain.proceed(builder.build())

        if (response.code == 401 && response.header("X-Device-Revoked") == "true") {
            secureStorage.clearDevicePairing()
            secureStorage.clearSession()
            onDeviceRevoked()
        }

        return response
    }
}
