package com.vectis.erp

import com.google.gson.Gson
import com.vectis.erp.data.model.*
import org.junit.Assert.*
import org.junit.Test

class SettingsParsingTest {

    private val gson = Gson()

    @Test
    fun testChangePasswordRequestSerialization() {
        val req = ChangePasswordRequest(
            currentPassword = "OldSecurePassword123!",
            newPassword = "NewSecurePassword456!"
        )
        val json = gson.toJson(req)

        assertTrue(json.contains("\"currentPassword\":\"OldSecurePassword123!\""))
        assertTrue(json.contains("\"newPassword\":\"NewSecurePassword456!\""))
    }

    @Test
    fun testUsersResponseParsing() {
        val json = """
            {
                "users": [
                    {
                        "id": "usr-1",
                        "username": "kermou",
                        "email": "admin@vectis.ma",
                        "name": "Admin Kermou",
                        "role": "admin",
                        "status": "active",
                        "preferred_currency": "MAD",
                        "created_at": "2026-01-15T09:00:00.000Z",
                        "last_login_at": "2026-09-22T12:00:00.000Z"
                    },
                    {
                        "id": "usr-2",
                        "username": "support_agent",
                        "email": "agent@vectis.ma",
                        "name": "Support Staff",
                        "role": "agent",
                        "status": "active",
                        "preferred_currency": "USD"
                    }
                ]
            }
        """.trimIndent()

        val res = gson.fromJson(json, UsersResponse::class.java)

        assertNotNull(res)
        assertEquals(2, res.users.size)

        val u1 = res.users[0]
        assertEquals("usr-1", u1.id)
        assertEquals("kermou", u1.username)
        assertEquals("admin@vectis.ma", u1.email)
        assertEquals("Admin Kermou", u1.name)
        assertEquals("admin", u1.role)
        assertEquals("MAD", u1.preferredCurrency)

        val u2 = res.users[1]
        assertEquals("usr-2", u2.id)
        assertEquals("agent", u2.role)
        assertEquals("USD", u2.preferredCurrency)
    }

    @Test
    fun testCreateUserRequestSerialization() {
        val req = CreateUserRequest(
            username = "new_manager",
            email = "manager@vectis.ma",
            name = "Store Manager",
            password = "ManagerPass88!",
            role = "manager",
            preferredCurrency = "EUR"
        )
        val json = gson.toJson(req)

        assertTrue(json.contains("\"username\":\"new_manager\""))
        assertTrue(json.contains("\"email\":\"manager@vectis.ma\""))
        assertTrue(json.contains("\"name\":\"Store Manager\""))
        assertTrue(json.contains("\"password\":\"ManagerPass88!\""))
        assertTrue(json.contains("\"role\":\"manager\""))
        assertTrue(json.contains("\"preferred_currency\":\"EUR\""))
    }

    @Test
    fun testAuditLogsResponseParsing() {
        val json = """
            {
                "logs": [
                    {
                        "id": "log-1",
                        "user_id": "usr-1",
                        "user_name": "Admin Kermou",
                        "action": "CREATE_ORDER",
                        "entity": "orders",
                        "entity_id": "ord-9988",
                        "details": {"amount": 250, "currency": "MAD"},
                        "ip_address": "192.168.1.50",
                        "created_at": "2026-09-22T14:32:00.000Z"
                    },
                    {
                        "id": "log-2",
                        "action": "AUTH_LOGIN",
                        "entity": "auth",
                        "user_name": "kermou",
                        "ip_address": "10.0.0.1",
                        "created_at": "2026-09-22T14:00:00.000Z"
                    }
                ],
                "page": 1,
                "limit": 30,
                "total": 45,
                "totalPages": 2
            }
        """.trimIndent()

        val res = gson.fromJson(json, AuditLogsResponse::class.java)

        assertNotNull(res)
        assertEquals(2, res.logs.size)
        assertEquals(1, res.page)
        assertEquals(30, res.limit)
        assertEquals(45, res.total)
        assertEquals(2, res.totalPages)

        val log1 = res.logs[0]
        assertEquals("log-1", log1.id)
        assertEquals("usr-1", log1.userId)
        assertEquals("Admin Kermou", log1.userName)
        assertEquals("CREATE_ORDER", log1.action)
        assertEquals("orders", log1.entity)
        assertEquals("ord-9988", log1.entityId)
        assertEquals("192.168.1.50", log1.ipAddress)
        assertEquals("2026-09-22T14:32:00.000Z", log1.createdAt)

        val log2 = res.logs[1]
        assertEquals("AUTH_LOGIN", log2.action)
        assertNull(log2.entityId)
    }

    @Test
    fun testHealthResponseParsing() {
        val json = """
            {
                "status": "healthy",
                "database": "connected",
                "uptimeSeconds": 86450
            }
        """.trimIndent()

        val res = gson.fromJson(json, HealthResponse::class.java)

        assertNotNull(res)
        assertEquals("healthy", res.status)
        assertEquals("connected", res.database)
        assertEquals(86450L, res.uptimeSeconds)
    }

    @Test
    fun testUpdateCurrencyRequestSerialization() {
        val req = UpdateCurrencyRequest(currency = "MAD")
        val json = gson.toJson(req)
        assertTrue(json.contains("\"currency\":\"MAD\""))
    }

    @Test
    fun testSystemSettingsResponseParsing() {
        val json = """
            {
                "settings": {
                    "company_name": "Vectis ERP Pro",
                    "timezone": "Africa/Casablanca",
                    "retention_days": 30
                }
            }
        """.trimIndent()

        val res = gson.fromJson(json, SystemSettingsResponse::class.java)

        assertNotNull(res)
        assertNotNull(res.settings)
        assertEquals("Vectis ERP Pro", res.settings?.get("company_name"))
        assertEquals("Africa/Casablanca", res.settings?.get("timezone"))
    }
}
