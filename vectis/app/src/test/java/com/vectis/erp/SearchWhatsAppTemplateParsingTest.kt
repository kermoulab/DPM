package com.vectis.erp

import com.google.gson.Gson
import com.vectis.erp.data.model.*
import org.junit.Assert.*
import org.junit.Test

class SearchWhatsAppTemplateParsingTest {

    private val gson = Gson()

    @Test
    fun testSearchResponseParsing() {
        val json = """
            {
                "results": [
                    {
                        "id": "cust-1",
                        "title": "Netflix Fan Club",
                        "subtitle": "+212612345678 - 3 orders",
                        "type": "customer",
                        "route": "/customers/cust-1"
                    },
                    {
                        "id": "ord-101",
                        "title": "ORD-2026-001 - Netflix Premium 4K",
                        "subtitle": "Customer: Alice - Status: active",
                        "type": "order",
                        "route": "/orders/ord-101"
                    },
                    {
                        "id": "prod-1",
                        "title": "Netflix Premium 4K",
                        "subtitle": "Streaming - 120 MAD",
                        "type": "product",
                        "route": "/products/prod-1"
                    },
                    {
                        "id": "acc-1",
                        "title": "netflix-pool-1@vectis.ma",
                        "subtitle": "Service Account - 4/5 in use",
                        "type": "account",
                        "route": "/inventory/accounts/acc-1"
                    },
                    {
                        "id": "lic-1",
                        "title": "NF-PRO-KEY-999",
                        "subtitle": "License Key - Unassigned",
                        "type": "license",
                        "route": "/inventory/licenses/lic-1"
                    }
                ]
            }
        """.trimIndent()

        val response = gson.fromJson(json, SearchResponse::class.java)
        assertEquals(5, response.results.size)

        val customer = response.results[0]
        assertEquals("cust-1", customer.id)
        assertEquals("Netflix Fan Club", customer.title)
        assertEquals("+212612345678 - 3 orders", customer.subtitle)
        assertEquals("customer", customer.type)
        assertEquals("/customers/cust-1", customer.route)

        val order = response.results[1]
        assertEquals("ord-101", order.id)
        assertEquals("order", order.type)

        val product = response.results[2]
        assertEquals("prod-1", product.id)
        assertEquals("product", product.type)

        val account = response.results[3]
        assertEquals("acc-1", account.id)
        assertEquals("account", account.type)

        val license = response.results[4]
        assertEquals("lic-1", license.id)
        assertEquals("license", license.type)
    }

    @Test
    fun testEmptySearchResponseParsing() {
        val json = """
            {
                "results": []
            }
        """.trimIndent()

        val response = gson.fromJson(json, SearchResponse::class.java)
        assertTrue(response.results.isEmpty())
    }

    @Test
    fun testWhatsAppTemplatesResponseParsing() {
        val json = """
            {
                "templates": [
                    {
                        "id": "tpl-exp-1",
                        "name": "Standard Expiry Reminder",
                        "event_type": "expiring_soon",
                        "language": "fr",
                        "content": "Bonjour {customer_name}, votre abonnement {product_name} expire dans {days_remaining} jours.",
                        "created_at": "2026-01-10T12:00:00Z"
                    },
                    {
                        "id": "tpl-over-1",
                        "name": "Service Expired Alert",
                        "event_type": "expired",
                        "language": "ar",
                        "content": "مرحبا {customer_name}، انتهى اشتراكك في {product_name}. يرجى التجديد للاستمرار بالخدمة.",
                        "created_at": "2026-01-15T10:00:00Z"
                    }
                ]
            }
        """.trimIndent()

        val response = gson.fromJson(json, WhatsAppTemplatesResponse::class.java)
        assertNotNull(response.templates)
        assertEquals(2, response.templates.size)

        val t1 = response.templates[0]
        assertEquals("tpl-exp-1", t1.id)
        assertEquals("Standard Expiry Reminder", t1.name)
        assertEquals("expiring_soon", t1.eventType)
        assertEquals("fr", t1.language)
        assertTrue(t1.content.contains("{customer_name}"))
        assertTrue(t1.content.contains("{days_remaining}"))

        val t2 = response.templates[1]
        assertEquals("tpl-over-1", t2.id)
        assertEquals("expired", t2.eventType)
        assertEquals("ar", t2.language)
    }

    @Test
    fun testUpsertTemplateRequestSerialization() {
        val request = UpsertTemplateRequest(
            id = "custom-id-123",
            name = "Welcome New Order",
            eventType = "order_created",
            language = "en",
            content = "Hello {customer_name}, thanks for ordering {product_name}! Your total is {price} MAD."
        )

        val json = gson.toJson(request)
        assertTrue(json.contains("\"custom-id-123\""))
        assertTrue(json.contains("\"Welcome New Order\""))
        assertTrue(json.contains("\"order_created\""))
        assertTrue(json.contains("\"en\""))

        val deserialized = gson.fromJson(json, UpsertTemplateRequest::class.java)
        assertEquals("custom-id-123", deserialized.id)
        assertEquals("Welcome New Order", deserialized.name)
        assertEquals("order_created", deserialized.eventType)
        assertEquals("en", deserialized.language)
        assertEquals("Hello {customer_name}, thanks for ordering {product_name}! Your total is {price} MAD.", deserialized.content)
    }

    @Test
    fun testTemplateVariableInterpolation() {
        val template = "Dear {customer_name}, your {product_name} subscription expires in {days_remaining} days. Please pay {price} MAD."
        val rendered = template
            .replace("{customer_name}", "Karim")
            .replace("{product_name}", "Vectis ERP Pro")
            .replace("{days_remaining}", "3")
            .replace("{price}", "150.00")

        assertEquals("Dear Karim, your Vectis ERP Pro subscription expires in 3 days. Please pay 150.00 MAD.", rendered)
    }
}
