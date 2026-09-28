package com.vectis.erp

import com.vectis.erp.core.security.PasswordValidator
import org.junit.Assert.*
import org.junit.Test

class PasswordValidatorTest {

    @Test
    fun testValidStrongPassword() {
        val validPasswords = listOf(
            "Admin123!",
            "Secure#99Pass",
            "P@ssw0rd2026",
            "Kermou@123"
        )
        for (pw in validPasswords) {
            assertNull("Password '$pw' should be valid", PasswordValidator.validate(pw))
            assertTrue(PasswordValidator.isStrong(pw))
        }
    }

    @Test
    fun testTooShortPassword() {
        val err = PasswordValidator.validate("Ab1!xyz")
        assertNotNull(err)
        assertTrue(err!!.contains("8 characters"))
    }

    @Test
    fun testMissingCapitalLetter() {
        val err = PasswordValidator.validate("admin123!@#")
        assertNotNull(err)
        assertTrue(err!!.contains("capital letter"))
    }

    @Test
    fun testMissingDigit() {
        val err = PasswordValidator.validate("AdminPassword!")
        assertNotNull(err)
        assertTrue(err!!.contains("number"))
    }

    @Test
    fun testMissingSymbol() {
        val err = PasswordValidator.validate("AdminPassword123")
        assertNotNull(err)
        assertTrue(err!!.contains("symbol"))
    }
}
