package com.vectis.erp

import com.vectis.erp.core.design.Slate800
import com.vectis.erp.core.design.StatusDanger
import com.vectis.erp.core.design.StatusSuccess
import com.vectis.erp.core.design.getSnackbarContainerColor
import com.vectis.erp.core.design.isErrorMessage
import com.vectis.erp.core.design.isSuccessMessage
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class VectisSnackbarClassificationTest {

    @Test
    fun `verifies success messages classification`() {
        val successSamples = listOf(
            "Customer created successfully",
            "Product updated successfully",
            "Order cancelled and inventory released.",
            "Imported 12 keys (0 duplicates skipped)",
            "Template saved successfully",
            "Team member removed",
            "Password updated successfully",
            "WhatsApp opened for John Doe",
            "Copied to clipboard"
        )

        for (msg in successSamples) {
            assertTrue("Expected '$msg' to be classified as success", isSuccessMessage(msg))
            assertFalse("Expected '$msg' not to be classified as error", isErrorMessage(msg))
            assertEquals("Expected StatusSuccess container color for '$msg'", StatusSuccess, getSnackbarContainerColor(msg))
        }
    }

    @Test
    fun `verifies error messages classification`() {
        val errorSamples = listOf(
            "Failed: Network connection timeout",
            "Renewal failed: Invalid subscription plan",
            "Reactivation failed: Server unreachable",
            "Customer not found",
            "Invalid credentials provided",
            "Access denied: insufficient permissions",
            "Cannot delete product with active orders",
            "Failed to parse server response"
        )

        for (msg in errorSamples) {
            assertTrue("Expected '$msg' to be classified as error", isErrorMessage(msg))
            assertFalse("Expected '$msg' not to be classified as success", isSuccessMessage(msg))
            assertEquals("Expected StatusDanger container color for '$msg'", StatusDanger, getSnackbarContainerColor(msg))
        }
    }

    @Test
    fun `verifies neutral messages default to Slate800`() {
        val neutralMsg = "Background synchronization completed"
        // If it doesn't match error or explicit success keyword
        val fallbackMsg = "Connecting to companion service..."
        assertEquals(Slate800, getSnackbarContainerColor(fallbackMsg))
    }

    @Test
    fun `verifies raw JSON error and success strings are stripped of wrapper artifacts`() {
        // User requested: do not show errors or success like this "{"error ": "xxxxxx"}"
        assertEquals("xxxxxx", com.vectis.erp.core.design.cleanUserFacingMessage("""{"error ": "xxxxxx"}"""))
        assertEquals("Customer already exists", com.vectis.erp.core.design.cleanUserFacingMessage("""{"error": "Customer already exists"}"""))
        assertEquals("Plan not found", com.vectis.erp.core.design.cleanUserFacingMessage("""{"success": false, "error": "Plan not found"}"""))
        assertEquals("Order cancelled", com.vectis.erp.core.design.cleanUserFacingMessage("""{"message": "Order cancelled"}"""))
        assertEquals("Unauthorized access", com.vectis.erp.core.design.cleanUserFacingMessage("""{"detail": "Unauthorized access"}"""))
        assertEquals("Out of stock", com.vectis.erp.core.design.cleanUserFacingMessage("""Failed: {"error": "Out of stock"}"""))
        assertEquals("Invalid password format", com.vectis.erp.core.design.cleanUserFacingMessage("""Error: {"error ": "Invalid password format"}"""))
        // Normal text messages should remain untouched
        assertEquals("Customer created successfully", com.vectis.erp.core.design.cleanUserFacingMessage("Customer created successfully"))
    }
}
