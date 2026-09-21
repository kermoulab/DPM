package com.vectis.erp

import com.google.gson.Gson
import com.vectis.erp.data.model.*
import org.junit.Assert.*
import org.junit.Test

class CustomerParsingTest {

    private val gson = Gson()

    @Test
    fun testCustomerListResponseParsing() {
        val json = """
            {
                "customers": [
                    {
                        "id": "cust-001",
                        "name": "Jane Doe",
                        "email": "jane@example.com",
                        "whatsapp": "+212612345678",
                        "notes": "VIP client",
                        "status": "active",
                        "created_at": "2026-03-01T10:00:00Z",
                        "total_orders": 5,
                        "total_spent": 1250.50
                    },
                    {
                        "id": "cust-002",
                        "name": "John Smith",
                        "email": null,
                        "whatsapp": "+33612345678",
                        "notes": null,
                        "status": "inactive",
                        "created_at": "2026-03-10T12:00:00Z",
                        "total_orders": 1,
                        "total_spent": 150.00
                    }
                ]
            }
        """.trimIndent()

        val response = gson.fromJson(json, CustomersResponse::class.java)

        assertNotNull(response)
        assertEquals(2, response.customers.size)

        val first = response.customers[0]
        assertEquals("cust-001", first.id)
        assertEquals("Jane Doe", first.name)
        assertEquals("jane@example.com", first.email)
        assertEquals("+212612345678", first.whatsapp)
        assertEquals("active", first.status)
        assertEquals(5, first.totalOrders)
        assertEquals(1250.50, first.totalSpent, 0.01)

        val second = response.customers[1]
        assertEquals("cust-002", second.id)
        assertEquals("inactive", second.status)
        assertNull(second.email)
        assertNull(second.notes)
    }

    @Test
    fun testCustomerDetailResponseParsing() {
        val json = """
            {
                "customer": {
                    "id": "cust-100",
                    "name": "Alice Wonderland",
                    "email": "alice@vectis.ma",
                    "whatsapp": "+212699999999",
                    "notes": "Prefers monthly renewals",
                    "status": "active",
                    "created_at": "2026-01-15T08:00:00Z",
                    "total_orders": 2,
                    "total_spent": 500.00
                },
                "orders": [
                    {
                        "id": "ord-1",
                        "order_number": "ORD-2026-0001",
                        "product_name": "Netflix Premium",
                        "plan_name": "3 Months",
                        "price": 250.00,
                        "status": "active",
                        "start_date": "2026-01-15",
                        "end_date": "2026-04-15"
                    },
                    {
                        "id": "ord-2",
                        "order_number": "ORD-2026-0002",
                        "product_name": "Spotify Family",
                        "plan_name": "1 Year",
                        "price": 250.00,
                        "status": "expiring",
                        "start_date": "2025-03-25",
                        "end_date": "2026-03-25"
                    }
                ]
            }
        """.trimIndent()

        val response = gson.fromJson(json, CustomerDetailResponse::class.java)

        assertNotNull(response)
        assertEquals("cust-100", response.customer.id)
        assertEquals(2, response.orders.size)
        assertEquals("Netflix Premium", response.orders[0].productName)
        assertEquals("active", response.orders[0].status)
        assertEquals(250.00, response.orders[0].price, 0.01)
        assertEquals("Spotify Family", response.orders[1].productName)
        assertEquals("expiring", response.orders[1].status)
    }

    @Test
    fun testSanitizeWhatsAppPhone() {
        // Valid international phone
        assertEquals("+212612345678", sanitizeWhatsAppPhone("+212612345678"))

        // Phone with spaces, brackets, dashes
        assertEquals("+14155552671", sanitizeWhatsAppPhone("+1 (415) 555-2671"))

        // Phone with embedded letters
        assertEquals("+14155559999", sanitizeWhatsAppPhone("+1 (415) 555-TEST-9999"))

        // Phone without plus sign
        assertEquals("0612345678", sanitizeWhatsAppPhone("06 12 34 56 78"))

        // Multiple plus signs
        assertEquals("+123456", sanitizeWhatsAppPhone("+123+456"))

        // Null and blank strings
        assertNull(sanitizeWhatsAppPhone(null))
        assertNull(sanitizeWhatsAppPhone(""))
        assertNull(sanitizeWhatsAppPhone("   "))
        assertNull(sanitizeWhatsAppPhone("---() "))
    }

    @Test
    fun testCustomerRequestSerialization() {
        val req = CreateCustomerRequest(
            name = "Bob Marley",
            email = "bob@reggae.com",
            whatsapp = "+1234567890",
            notes = "Annual subscriber"
        )
        val json = gson.toJson(req)

        assertTrue(json.contains("\"name\":\"Bob Marley\""))
        assertTrue(json.contains("\"email\":\"bob@reggae.com\""))
        assertTrue(json.contains("\"whatsapp\":\"+1234567890\""))
    }
}
