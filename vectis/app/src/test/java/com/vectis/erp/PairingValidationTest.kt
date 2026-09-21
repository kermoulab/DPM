package com.vectis.erp

import com.google.gson.Gson
import com.vectis.erp.data.model.QrPairingPayload
import org.junit.Assert.*
import org.junit.Test

/**
 * PairingValidationTest - Verifies pairing code validation and QR parsing
 */
class PairingValidationTest {

    private val gson = Gson()

    @Test
    fun testPairingCodeFilterDigits() {
        val rawInput = " 482-731 A "
        val filtered = rawInput.filter { it.isDigit() }
        assertEquals("482731", filtered)
        assertTrue(filtered.length in 6..8)
    }

    @Test
    fun testQrPayloadParsing() {
        val qrJson = """
            {
              "version": "1.0",
              "action": "pair_device",
              "deviceId": "dev-9921",
              "code": "482731",
              "expiresAt": "2026-09-21T22:00:00.000Z"
            }
        """.trimIndent()

        val payload = gson.fromJson(qrJson, QrPairingPayload::class.java)
        assertNotNull(payload)
        assertEquals("pair_device", payload.action)
        assertEquals("dev-9921", payload.deviceId)
        assertEquals("482731", payload.code)
    }

    @Test
    fun testQrPayloadRejectsMissingCode() {
        val qrJson = """{"version": "1.0", "action": "pair_device"}"""
        val payload = gson.fromJson(qrJson, QrPairingPayload::class.java)
        assertTrue(payload.code.isBlank())
    }
}
