package com.vectis.erp

import com.vectis.erp.core.authorization.AppPermission
import com.vectis.erp.core.authorization.UserRole
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * PermissionManagerTest - Verifies RBAC hierarchy rules on client side
 */
class PermissionManagerTest {

    @Test
    fun testAgentPermissions() {
        val agentRole = UserRole.AGENT

        // Agent CAN create orders, renew orders, and create customers
        assertTrue(AppPermission.ORDERS_CREATE.isAuthorized(agentRole))
        assertTrue(AppPermission.ORDERS_RENEW.isAuthorized(agentRole))
        assertTrue(AppPermission.CUSTOMERS_CREATE.isAuthorized(agentRole))

        // Agent CANNOT delete orders, edit orders, or view credentials
        assertFalse(AppPermission.ORDERS_DELETE.isAuthorized(agentRole))
        assertFalse(AppPermission.ORDERS_EDIT.isAuthorized(agentRole))
        assertFalse(AppPermission.INVENTORY_CREDENTIALS_VIEW.isAuthorized(agentRole))
        assertFalse(AppPermission.CUSTOMERS_DELETE.isAuthorized(agentRole))
    }

    @Test
    fun testManagerPermissions() {
        val managerRole = UserRole.MANAGER

        // Manager CAN edit orders, view inventory, manage devices
        assertTrue(AppPermission.ORDERS_EDIT.isAuthorized(managerRole))
        assertTrue(AppPermission.INVENTORY_VIEW.isAuthorized(managerRole))
        assertTrue(AppPermission.DEVICES_MANAGE.isAuthorized(managerRole))

        // Manager CANNOT delete orders or view raw credentials
        assertFalse(AppPermission.ORDERS_DELETE.isAuthorized(managerRole))
        assertFalse(AppPermission.INVENTORY_CREDENTIALS_VIEW.isAuthorized(managerRole))
    }

    @Test
    fun testAdminAndOwnerPermissions() {
        val adminRole = UserRole.ADMIN
        val ownerRole = UserRole.OWNER

        // Admin & Owner CAN delete orders, manage products, view credentials
        assertTrue(AppPermission.ORDERS_DELETE.isAuthorized(adminRole))
        assertTrue(AppPermission.INVENTORY_CREDENTIALS_VIEW.isAuthorized(adminRole))
        assertTrue(AppPermission.CUSTOMERS_DELETE.isAuthorized(adminRole))

        assertTrue(AppPermission.ORDERS_DELETE.isAuthorized(ownerRole))
        assertTrue(AppPermission.AUDIT_LOGS_VIEW.isAuthorized(ownerRole))
    }

    @Test
    fun testViewerPermissions() {
        val viewerRole = UserRole.VIEWER

        assertTrue(AppPermission.ORDERS_VIEW.isAuthorized(viewerRole))
        assertTrue(AppPermission.CUSTOMERS_VIEW.isAuthorized(viewerRole))

        // Viewer CANNOT create anything
        assertFalse(AppPermission.ORDERS_CREATE.isAuthorized(viewerRole))
        assertFalse(AppPermission.CUSTOMERS_CREATE.isAuthorized(viewerRole))
    }
}
