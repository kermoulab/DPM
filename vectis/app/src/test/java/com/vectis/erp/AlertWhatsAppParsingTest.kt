package com.vectis.erp

import com.google.gson.Gson
import com.vectis.erp.data.model.*
import org.junit.Assert.*
import org.junit.Test

class AlertWhatsAppParsingTest {

    private val gson = Gson()

    @Test
    fun testAlertsResponseParsing() {
        val json = """
            {
                "badgeCount": 3,
                "expiringOrders": [
                    {
                        "id": "ord-exp-1",
                        "order_number": "ORD-111222",
                        "customer_id": "cust-1",
                        "customer_name": "Alice Wonder",
                        "customer_whatsapp": "+212612345678",
                        "product_id": "prod-1",
                        "product_name": "Netflix Premium",
                        "plan_name": "3 Months",
                        "price": 250.00,
                        "status": "expiring",
                        "start_date": "2025-12-25",
                        "end_date": "2026-03-25",
                        "days_remaining": 3
                    }
                ],
                "expiredOrders": [
                    {
                        "id": "ord-exp-2",
                        "order_number": "ORD-333444",
                        "customer_id": "cust-2",
                        "customer_name": "Bob Dylan",
                        "customer_whatsapp": "+212687654321",
                        "product_id": "prod-2",
                        "product_name": "Spotify Family",
                        "plan_name": "1 Year",
                        "price": 300.00,
                        "status": "expired",
                        "start_date": "2025-03-20",
                        "end_date": "2026-03-20",
                        "days_expired": 2
                    }
                ],
                "lowStockAccounts": [
                    {
                        "id": "sa-1",
                        "product_id": "prod-1",
                        "product_name": "Netflix Premium",
                        "provider": "Netflix",
                        "total_profiles": 5,
                        "available_profiles": 1
                    }
                ],
                "lowInventory": [
                    {
                        "id": "prod-win",
                        "name": "Windows 11 Pro",
                        "fulfillment_type": "license_key",
                        "available_count": 2
                    }
                ]
            }
        """.trimIndent()

        val response = gson.fromJson(json, AlertsResponse::class.java)

        assertNotNull(response)
        assertEquals(3, response.badgeCount)
        assertEquals(1, response.expiringOrders.size)
        assertEquals(1, response.expiredOrders.size)
        assertEquals(1, response.lowStockAccounts.size)
        assertEquals(1, response.lowInventory.size)

        val expiring = response.expiringOrders[0]
        assertEquals("ORD-111222", expiring.orderNumber)
        assertEquals(3, expiring.daysRemaining)

        val expired = response.expiredOrders[0]
        assertEquals("ORD-333444", expired.orderNumber)
        assertEquals(2, expired.daysExpired)

        val lowAcc = response.lowStockAccounts[0]
        assertEquals(1, lowAcc.availableProfiles)

        val lowLic = response.lowInventory[0]
        assertEquals(2, lowLic.availableCount)
    }

    @Test
    fun testComposeWhatsAppResponseParsing() {
        val json = """
            {
                "text": "Hello Alice, your subscription for Netflix Premium expires in 3 days.",
                "phone": "+212612345678",
                "formatted_phone": "+212612345678",
                "whatsapp_url": "https://wa.me/212612345678?text=Hello%20Alice",
                "event_type": "order_expiring",
                "language": "en"
            }
        """.trimIndent()

        val response = gson.fromJson(json, ComposeWhatsAppResponse::class.java)

        assertNotNull(response)
        assertEquals("order_expiring", response.eventType)
        assertEquals("en", response.language)
        assertEquals("https://wa.me/212612345678?text=Hello%20Alice", response.whatsappUrl)
    }

    @Test
    fun testComposeWhatsAppRequestSerialization() {
        val req = ComposeWhatsAppRequest(
            orderId = "ord-1",
            language = "fr",
            eventType = "order_expired",
            phone = "+212600000000"
        )
        val json = gson.toJson(req)

        assertTrue(json.contains("\"order_id\":\"ord-1\""))
        assertTrue(json.contains("\"language\":\"fr\""))
        assertTrue(json.contains("\"event_type\":\"order_expired\""))
    }
}
