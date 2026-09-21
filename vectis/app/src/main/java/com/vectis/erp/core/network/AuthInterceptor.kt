package com.vectis.erp.core.network

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
            requestBuilder.header("Authorization", "Bearer $token")
        }

        val response = chain.proceed(requestBuilder.build())

        if (response.code == 401) {
            // Invalidate local session credentials safely
            secureStorage.clearSession()
            onUnauthorized()
        }

        return response
    }
}
