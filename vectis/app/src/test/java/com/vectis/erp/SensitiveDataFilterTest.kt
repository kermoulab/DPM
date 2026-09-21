package com.vectis.erp

import com.vectis.erp.core.network.SensitiveDataFilterLoggingInterceptor
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * SensitiveDataFilterTest - Verifies that logging never leaks sensitive credentials.
 */
class SensitiveDataFilterTest {

    @Test
    fun testSensitivePasswordRedacted() {
        val json = """{"username": "admin", "password": "superSecretPassword123"}"""
        val sanitized = SensitiveDataFilterLoggingInterceptor.filterSensitiveJsonKeys(json)

        assertFalse("Password must not be present in sanitized output", sanitized.contains("superSecretPassword123"))
        assertTrue("Password must be replaced with [REDACTED]", sanitized.contains(""""password": "[REDACTED]""""))
    }

    @Test
    fun testSensitivePinAndTokensRedacted() {
        val json = """{"device_token": "dev_tok_abc123", "pin": "9988", "name": "Profile 1"}"""
        val sanitized = SensitiveDataFilterLoggingInterceptor.filterSensitiveJsonKeys(json)

        assertFalse(sanitized.contains("dev_tok_abc123"))
        assertFalse(sanitized.contains("9988"))
        assertTrue(sanitized.contains("Profile 1"))
    }
}
