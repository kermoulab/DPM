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
    fun testAuditLogsWithBackendColumnNamesAndTargetExtraction() {
        val json = """
            {
                "logs": [
                    {
                        "id": "log-order",
                        "user_id": "usr-1",
                        "username": "admin",
                        "action": "CREATE_ORDER",
                        "entity": "order",
                        "entity_id": "ord-1111",
                        "details": {"order_number": "ORD-2026-009"},
                        "ip": "10.0.0.5",
                        "created_at": "2026-09-26T10:00:00.000Z"
                    },
                    {
                        "id": "log-product",
                        "username": "admin",
                        "action": "CREATE_PRODUCT",
                        "entity": "product",
                        "entity_id": "prod-2222",
                        "details": {"name": "Netflix 4K UHD"},
                        "created_at": "2026-09-26T10:01:00.000Z"
                    },
                    {
                        "id": "log-plan",
                        "username": "admin",
                        "action": "CREATE_PLAN",
                        "entity": "plan",
                        "entity_id": "plan-3333",
                        "details": {"name": "1 Month UHD"},
                        "created_at": "2026-09-26T10:02:00.000Z"
                    },
                    {
                        "id": "log-customer",
                        "username": "admin",
                        "action": "CREATE_CUSTOMER",
                        "entity": "customer",
                        "entity_id": "cust-4444",
                        "details": {"name": "Acme Corp"},
                        "created_at": "2026-09-26T10:03:00.000Z"
                    },
                    {
                        "id": "log-service-acc",
                        "username": "admin",
                        "action": "CREATE_SERVICE_ACCOUNT",
                        "entity": "service_account",
                        "entity_id": "sa-5555",
                        "details": {"provider": "Netflix", "login": "netflix@corp.com"},
                        "created_at": "2026-09-26T10:04:00.000Z"
                    },
                    {
                        "id": "log-login",
                        "username": "admin",
                        "action": "LOGIN_SUCCESS",
                        "entity": "user",
                        "entity_id": "usr-1",
                        "details": {},
                        "created_at": "2026-09-26T10:05:00.000Z"
                    },
                    {
                        "id": "log-logout",
                        "username": "admin",
                        "action": "LOGOUT",
                        "entity": "user",
                        "entity_id": "usr-1",
                        "details": {},
                        "created_at": "2026-09-26T10:06:00.000Z"
                    },
                    {
                        "id": "log-device",
                        "username": "System",
                        "action": "DEVICE_PAIRED_MOBILE",
                        "entity": "device",
                        "entity_id": "dev-7777",
                        "details": {"device_name": "Pixel 7"},
                        "created_at": "2026-09-26T10:07:00.000Z"
                    },
                    {
                        "id": "log-revoke",
                        "username": "admin",
                        "action": "REVOKE_DEVICE",
                        "entity": "device",
                        "entity_id": "dev-7777",
                        "details": {},
                        "created_at": "2026-09-26T10:08:00.000Z"
                    },
                    {
                        "id": "log-user",
                        "username": "admin",
                        "action": "CREATE_USER",
                        "entity": "user",
                        "entity_id": "usr-9",
                        "details": {"username": "agent1"},
                        "created_at": "2026-09-26T10:09:00.000Z"
                    },
                    {
                        "id": "log-profile",
                        "username": "admin",
                        "action": "UPDATE_PROFILE",
                        "entity": "user",
                        "entity_id": "usr-1",
                        "details": {},
                        "created_at": "2026-09-26T10:10:00.000Z"
                    }
                ],
                "page": 1,
                "limit": 30,
                "total": 11,
                "totalPages": 1
            }
        """.trimIndent()

        val res = gson.fromJson(json, AuditLogsResponse::class.java)
        assertNotNull(res)
        assertEquals(11, res.logs.size)

        // Verify username and ip deserialization
        val orderLog = res.logs[0]
        assertEquals("admin", orderLog.userName)
        assertEquals("10.0.0.5", orderLog.ipAddress)
        assertEquals("ORD-2026-009", extractAuditTargetName(orderLog))

        assertEquals("Netflix 4K UHD", extractAuditTargetName(res.logs[1]))
        assertEquals("1 Month UHD", extractAuditTargetName(res.logs[2]))
        assertEquals("Acme Corp", extractAuditTargetName(res.logs[3]))
        assertEquals("Netflix (netflix@corp.com)", extractAuditTargetName(res.logs[4]))

        // User / Auth / Device events must return null (show nothing below username)
        assertNull(extractAuditTargetName(res.logs[5])) // LOGIN_SUCCESS
        assertNull(extractAuditTargetName(res.logs[6])) // LOGOUT
        assertNull(extractAuditTargetName(res.logs[7])) // DEVICE_PAIRED_MOBILE
        assertNull(extractAuditTargetName(res.logs[8])) // REVOKE_DEVICE
        assertNull(extractAuditTargetName(res.logs[9])) // CREATE_USER
        assertNull(extractAuditTargetName(res.logs[10])) // UPDATE_PROFILE
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
