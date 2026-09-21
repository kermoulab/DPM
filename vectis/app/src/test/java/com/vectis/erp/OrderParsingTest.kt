package com.vectis.erp

import com.google.gson.Gson
import com.vectis.erp.data.model.*
import org.junit.Assert.*
import org.junit.Test

class OrderParsingTest {

    private val gson = Gson()

    @Test
    fun testOrdersResponseParsing() {
        val json = """
            {
                "orders": [
                    {
                        "id": "ord-1",
                        "order_number": "ORD-123456",
                        "customer_id": "cust-1",
                        "customer_name": "Alice Wonder",
                        "customer_whatsapp": "+212612345678",
                        "product_id": "prod-1",
                        "product_name": "Netflix Premium",
                        "capabilities": ["subscription", "service_account", "profiles"],
                        "plan_id": "plan-1",
                        "plan_name": "3 Months",
                        "duration": 3,
                        "duration_unit": "months",
                        "price": 250.00,
                        "cost": 150.00,
                        "currency": "MAD",
                        "status": "active",
                        "start_date": "2026-01-01",
                        "end_date": "2026-04-01",
                        "fulfillment_data": {
                            "login": "master_nf@vectis.ma",
                            "profile_name": "Profile 3",
                            "pin": "9999"
                        }
                    },
                    {
                        "id": "ord-2",
                        "order_number": "ORD-654321",
                        "customer_id": "cust-2",
                        "customer_name": "Bob Marley",
                        "product_id": "prod-2",
                        "product_name": "Windows 11 Pro",
                        "capabilities": ["license_key"],
                        "plan_id": "plan-2",
                        "plan_name": "Lifetime",
                        "price": 120.00,
                        "status": "completed",
                        "fulfillment_data": {
                            "license_key": "XXXX-YYYY-ZZZZ-WWWW"
                        }
                    }
                ],
                "counts": {
                    "all": 2,
                    "active": 1,
                    "expiring": 0,
                    "expired": 0,
                    "completed": 1
                }
            }
        """.trimIndent()

        val response = gson.fromJson(json, OrdersResponse::class.java)

        assertNotNull(response)
        assertEquals(2, response.orders.size)
        assertEquals(2, response.counts?.get("all"))
        assertEquals(1, response.counts?.get("active"))

        val netflixOrder = response.orders[0]
        assertEquals("ORD-123456", netflixOrder.orderNumber)
        assertEquals("Alice Wonder", netflixOrder.customerName)
        assertTrue(netflixOrder.isSubscription)
        assertTrue(netflixOrder.isServiceAccount)
        assertFalse(netflixOrder.isLicenseKey)
        assertEquals("master_nf@vectis.ma", netflixOrder.accountLogin)
        assertEquals("Profile 3", netflixOrder.profileName)
        assertEquals("9999", netflixOrder.profilePin)

        val winOrder = response.orders[1]
        assertEquals("ORD-654321", winOrder.orderNumber)
        assertTrue(winOrder.isLicenseKey)
        assertFalse(winOrder.isServiceAccount)
        assertEquals("XXXX-YYYY-ZZZZ-WWWW", winOrder.licenseKeyString)
    }

    @Test
    fun testOrderDetailResponseParsing() {
        val json = """
            {
                "order": {
                    "id": "ord-1",
                    "order_number": "ORD-123456",
                    "customer_id": "cust-1",
                    "customer_name": "Alice Wonder",
                    "product_id": "prod-1",
                    "product_name": "Netflix Premium",
                    "capabilities": ["subscription"],
                    "plan_id": "plan-1",
                    "plan_name": "3 Months",
                    "price": 250.00,
                    "status": "expiring",
                    "start_date": "2025-12-25",
                    "end_date": "2026-03-25"
                },
                "renewals": [
                    {
                        "id": "ren-1",
                        "order_id": "ord-1",
                        "previous_end_date": "2025-12-25",
                        "new_end_date": "2026-03-25",
                        "price": 250.00,
                        "cost": 150.00,
                        "created_at": "2025-12-24T12:00:00Z"
                    }
                ]
            }
        """.trimIndent()

        val response = gson.fromJson(json, OrderDetailResponse::class.java)

        assertNotNull(response)
        assertEquals("ord-1", response.order.id)
        assertEquals("expiring", response.order.status)
        assertEquals(1, response.renewals.size)
        assertEquals("2026-03-25", response.renewals[0].newEndDate)
    }

    @Test
    fun testCreateOrderRequestSerialization() {
        val req = CreateOrderRequest(
            customerId = "cust-1",
            productId = "prod-1",
            planId = "plan-1",
            startDate = "2026-03-22",
            customPrice = 220.00,
            paymentMethod = "Cash",
            paymentStatus = "paid",
            notes = "Test order allocation"
        )
        val json = gson.toJson(req)

        assertTrue(json.contains("\"customer_id\":\"cust-1\""))
        assertTrue(json.contains("\"product_id\":\"prod-1\""))
        assertTrue(json.contains("\"custom_price\":220.0"))
    }
}
