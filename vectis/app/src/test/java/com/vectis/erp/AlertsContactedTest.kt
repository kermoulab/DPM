package com.vectis.erp

import com.vectis.erp.data.model.AlertOrderDto
import com.vectis.erp.feature.alerts.isAlertContactedFromServer
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AlertsContactedTest {

    private fun createOrder(
        contactedAt: String?,
        startDate: String = "2026-08-01",
        endDate: String = "2026-09-01"
    ): AlertOrderDto {
        return AlertOrderDto(
            id = "order-1",
            orderNumber = "ORD-001",
            customerId = "cust-1",
            productId = "prod-1",
            status = "expiring",
            startDate = startDate,
            endDate = endDate,
            whatsappContactedAt = contactedAt
        )
    }

    @Test
    fun `orders without whatsapp contacted at are not considered contacted`() {
        assertFalse(isAlertContactedFromServer(createOrder(null)))
        assertFalse(isAlertContactedFromServer(createOrder("")))
        assertFalse(isAlertContactedFromServer(createOrder("null")))
        assertFalse(isAlertContactedFromServer(createOrder("None")))
    }

    @Test
    fun `orders contacted at initial creation are hidden from contacted status in alerts view`() {
        // Order created on 2026-08-01, ends on 2026-09-01. Contacted only at creation time.
        val order = createOrder(contactedAt = "2026-08-01T14:00:00.000Z")
        assertFalse("Old contact at order creation must not mark alert as contacted", isAlertContactedFromServer(order))
    }

    @Test
    fun `orders contacted within alert window are marked as contacted`() {
        // Alert window is within 7-8 days of expiry or after expiry
        val orderDuringAlert = createOrder(contactedAt = "2026-08-28T10:00:00.000Z")
        assertTrue("Contact during expiring window must be marked contacted", isAlertContactedFromServer(orderDuringAlert))

        val orderAfterExpired = createOrder(contactedAt = "2026-09-02T11:00:00.000Z")
        assertTrue("Contact after expiration must be marked contacted", isAlertContactedFromServer(orderAfterExpired))
    }
}
