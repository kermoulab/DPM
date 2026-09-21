package com.vectis.erp.core.network

import android.util.Log
import okhttp3.Interceptor
import okhttp3.Response
import okio.Buffer
import java.nio.charset.StandardCharsets

/**
 * SensitiveDataFilterLoggingInterceptor - Logs HTTP requests and responses while
 * strictly filtering and redacting sensitive credentials (passwords, PINs, auth tokens, device tokens).
 */
class SensitiveDataFilterLoggingInterceptor : Interceptor {

    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request()
        val url = request.url.toString()
        val method = request.method

        // Redact authorization headers from logs
        val sanitizedHeaders = request.headers.names().joinToString(", ") { name ->
            if (name.equals("Authorization", ignoreCase = true) ||
                name.equals("X-Device-Token", ignoreCase = true)
            ) {
                "$name: [REDACTED]"
            } else {
                "$name: ${request.header(name)}"
            }
        }

        Log.d(TAG, "--> $method $url | Headers: [$sanitizedHeaders]")

        // Read and redact request body if present
        request.body?.let { body ->
            val buffer = Buffer()
            body.writeTo(buffer)
            val rawBody = buffer.readString(StandardCharsets.UTF_8)
            val sanitizedBody = filterSensitiveJsonKeys(rawBody)
            Log.d(TAG, "--> Body: $sanitizedBody")
        }

        val startTime = System.currentTimeMillis()
        val response: Response
        try {
            response = chain.proceed(request)
        } catch (e: Exception) {
            Log.e(TAG, "<-- HTTP FAILED: $method $url", e)
            throw e
        }

        val duration = System.currentTimeMillis() - startTime
        Log.d(TAG, "<-- ${response.code} ${response.message} $url (${duration}ms)")

        return response
    }

    companion object {
        private const val TAG = "VectisNetwork"

        private val SENSITIVE_KEYS = listOf(
            "password", "currentPassword", "newPassword", "pin",
            "token", "device_token", "pairing_code", "encrypted_credential"
        )

        /**
         * Redacts sensitive JSON field values with "[REDACTED]".
         */
        fun filterSensitiveJsonKeys(json: String): String {
            var filtered = json
            for (key in SENSITIVE_KEYS) {
                // Matches "key": "value"
                val regex = Regex(""""($key)"\s*:\s*"[^"]*"""", RegexOption.IGNORE_CASE)
                filtered = regex.replace(filtered, """"$1": "[REDACTED]"""")
            }
            return filtered
        }
    }
}
