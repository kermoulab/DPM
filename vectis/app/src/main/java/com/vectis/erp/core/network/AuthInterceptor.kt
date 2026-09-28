package com.vectis.erp.core.network

import android.util.Log
import com.vectis.erp.core.security.SecureStorage
import okhttp3.Interceptor
import okhttp3.Response

/**
 * AuthInterceptor - Injects Bearer token and intercepts 401 unauthorized responses.
 */
class AuthInterceptor(
    private val secureStorage: SecureStorage,
    private val onUnauthorized: () -> Unit
) : Interceptor {

    override fun intercept(chain: Interceptor.Chain): Response {
        val original = chain.request()
        val requestBuilder = original.newBuilder()

        val token = secureStorage.getAuthToken()
        if (!token.isNullOrBlank()) {
            requestBuilder.header("Authorization", "Bearer ${token.trim().trim('"', '\'')}")
        }

        val request = requestBuilder.build()
        val response = chain.proceed(request)

        // Capture sliding session refreshed token if provided by server
        val refreshedToken = response.header("X-New-Token")
        if (!refreshedToken.isNullOrBlank()) {
            secureStorage.setAuthToken(refreshedToken)
        }

        // If OkHttp followed a redirect, synchronize the canonical base URL
        if (response.priorResponse != null) {
            val redirectedUrl = response.request.url
            val canonicalBase = "${redirectedUrl.scheme}://${redirectedUrl.host}${if (redirectedUrl.port != 80 && redirectedUrl.port != 443) ":${redirectedUrl.port}" else ""}"
            val currentServerUrl = secureStorage.getServerUrl().trimEnd('/')
            if (canonicalBase != currentServerUrl) {
                Log.i("VECTIS_AUTH", "Auto-updating canonical server URL to $canonicalBase")
                secureStorage.setServerUrl(canonicalBase)
            }
        }

        if (response.code == 401) {
            val isDeviceRevoked = response.header("X-Device-Revoked").equals("true", ignoreCase = true)
            val path = request.url.encodedPath

            val errorBody = try {
                response.peekBody(2048).string()
            } catch (_: Exception) {
                ""
            }

            try {
                Log.e("VECTIS_AUTH", "HTTP 401 intercepted on ${request.method} ${request.url} (deviceRevoked=$isDeviceRevoked): $errorBody")
            } catch (_: Exception) {}

            if (!isDeviceRevoked) {
                val sentAuthHeader = request.header("Authorization")
                if (!sentAuthHeader.isNullOrBlank()) {
                    val userReason = when {
                        errorBody.contains("Session has been revoked", ignoreCase = true) -> "Session has been revoked. Please log in again."
                        errorBody.contains("User account is inactive or revoked", ignoreCase = true) -> "User account is inactive or revoked."
                        errorBody.contains("Invalid or expired session token", ignoreCase = true) -> "Session expired. Please log in again."
                        else -> "Session expired. Please log in again."
                    }
                    secureStorage.setLastSessionError(userReason)
                    secureStorage.clearSession()
                    onUnauthorized()
                }
            }
        }

        return response
    }
}
