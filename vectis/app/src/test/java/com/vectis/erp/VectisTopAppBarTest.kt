package com.vectis.erp

import com.vectis.erp.core.design.getUserInitials
import org.junit.Assert.assertEquals
import org.junit.Test

class VectisTopAppBarTest {

    @Test
    fun `verifies initials extraction from full names`() {
        assertEquals("JD", getUserInitials("John Doe"))
        assertEquals("AS", getUserInitials("Alice Smith"))
        assertEquals("JK", getUserInitials("John Fitzgerald Kennedy"))
        assertEquals("AK", getUserInitials("Abderrahmane Kermou"))
    }

    @Test
    fun `verifies initials extraction with punctuation and formatting`() {
        assertEquals("JD", getUserInitials("john.doe"))
        assertEquals("JD", getUserInitials("john_doe"))
        assertEquals("JD", getUserInitials("john-doe"))
        assertEquals("JD", getUserInitials("  John   Doe  "))
    }

    @Test
    fun `verifies single word or fallback initials`() {
        assertEquals("AD", getUserInitials("Admin"))
        assertEquals("AG", getUserInitials("agent"))
        assertEquals("OW", getUserInitials("owner"))
        assertEquals("AD", getUserInitials(""))
        assertEquals("AD", getUserInitials(null))
        assertEquals("AD", getUserInitials("   "))
    }
}
