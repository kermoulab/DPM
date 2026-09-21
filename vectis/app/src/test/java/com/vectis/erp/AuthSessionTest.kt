package com.vectis.erp

import com.google.gson.Gson
import com.vectis.erp.data.model.LoginResponse
import com.vectis.erp.data.model.UserDto
import org.junit.Assert.*
import org.junit.Test

/**
 * AuthSessionTest - Verifies auth models parsing and session contracts
 */
class AuthSessionTest {

    private val gson = Gson()

    @Test
    fun testLoginResponseParsing() {
        val json = """
            {
              "success": true,
              "token": "header.payload.signature",
              "user": {
                "id": "usr_101",
                "username": "admin",
                "email": "admin@vectis.io",
                "name": "Super Admin",
                "role": "owner",
                "status": "active",
                "preferred_currency": "USD"
              }
            }
        """.trimIndent()

        val resp = gson.fromJson(json, LoginResponse::class.java)
        assertNotNull(resp)
        assertTrue(resp.success)
        assertEquals("header.payload.signature", resp.token)
        assertEquals("owner", resp.user?.role)
        assertEquals("Super Admin", resp.user?.name)
    }

    @Test
    fun testUserRoleHierarchyContract() {
        val roles = listOf("owner", "admin", "manager", "agent", "viewer")
        val sampleUser = UserDto(
            id = "usr_1",
            username = "agent_john",
            email = "john@vectis.io",
            name = "John",
            role = "agent"
        )
        assertTrue(roles.contains(sampleUser.role))
        assertEquals("agent", sampleUser.role)
    }
}
