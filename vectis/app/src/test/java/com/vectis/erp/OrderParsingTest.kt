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

    @Test
    fun testUpdateOrderRequestSerialization() {
        val req = UpdateOrderRequest(
            customerId = "cust-42",
            productId = "prod-99",
            planId = "plan-3",
            status = "active",
            paymentStatus = "paid",
            paymentMethod = "bank_transfer",
            price = 300.0,
            cost = null,
            startDate = "2026-03-01",
            endDate = "2026-06-01",
            notes = "Updated via Android companion"
        )
        val json = gson.toJson(req)

        assertTrue(json.contains("\"customer_id\":\"cust-42\""))
        assertTrue(json.contains("\"product_id\":\"prod-99\""))
        assertTrue(json.contains("\"plan_id\":\"plan-3\""))
        assertTrue(json.contains("\"status\":\"active\""))
        assertTrue(json.contains("\"payment_status\":\"paid\""))
        assertTrue(json.contains("\"price\":300.0"))
        assertFalse(json.contains("\"cost\""))
        assertTrue(json.contains("\"notes\":\"Updated via Android companion\""))
    }

    @Test
    fun testOrderPasswordParsing() {
        val jsonStandard = """
            {
                "id": "ord-1",
                "capabilities": ["service_account"],
                "fulfillment_data": {
                    "login": "user@example.com",
                    "password": "SecretPassword123!",
                    "profile_name": "Profile 1",
                    "pin": "1234"
                }
            }
        """.trimIndent()
        val order1 = gson.fromJson(jsonStandard, OrderDto::class.java)
        assertEquals("user@example.com", order1.accountLogin)
        assertEquals("SecretPassword123!", order1.accountPassword)
        assertEquals("Profile 1", order1.profileName)
        assertEquals("1234", order1.profilePin)

        val jsonLegacyAccountPassword = """
            {
                "id": "ord-2",
                "capabilities": ["service_account"],
                "fulfillment_data": {
                    "account_login": "user2@example.com",
                    "account_password": "LegacyPassword456",
                    "profile_name": "Profile 2"
                }
            }
        """.trimIndent()
        val order2 = gson.fromJson(jsonLegacyAccountPassword, OrderDto::class.java)
        assertEquals("user2@example.com", order2.accountLogin)
        assertEquals("LegacyPassword456", order2.accountPassword)
        assertEquals("Profile 2", order2.profileName)
    }

    @Test
    fun testOrderEffectiveStatusWithPastEndDate() {
        val oldOrder = OrderDto(
            id = "ord-past",
            status = "active",
            startDate = "2023-01-01",
            endDate = "2023-02-01"
        )
        assertEquals("expired", oldOrder.effectiveStatus)

        val cancelledOrder = OrderDto(
            id = "ord-cancelled",
            status = "cancelled",
            startDate = "2023-01-01",
            endDate = "2023-02-01"
        )
        assertEquals("cancelled", cancelledOrder.effectiveStatus)

        val futureOrder = OrderDto(
            id = "ord-future",
            status = "active",
            startDate = "2028-01-01",
            endDate = "2028-02-01"
        )
        assertEquals("active", futureOrder.effectiveStatus)
    }
}
