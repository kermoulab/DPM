package com.vectis.erp.core.authorization

/**
 * Domain representation of user roles matching Vectis 5-tier RBAC hierarchy:
 * owner (5) > admin (4) > manager (3) > agent (2) > viewer (1)
 */
enum class UserRole(val level: Int, val roleName: String) {
    OWNER(5, "owner"),
    ADMIN(4, "admin"),
    MANAGER(3, "manager"),
    AGENT(2, "agent"),
    VIEWER(1, "viewer"),
    NONE(0, "none");

    companion object {
        fun fromString(role: String?): UserRole {
            return when (role?.lowercase()?.trim()) {
                "owner" -> OWNER
                "admin" -> ADMIN
                "manager" -> MANAGER
                "agent" -> AGENT
                "viewer" -> VIEWER
                else -> NONE
            }
        }
    }
}

/**
 * Granular permissions mapped to minimum required user role
 */
enum class AppPermission(val minRole: UserRole) {
    // Customers
    CUSTOMERS_VIEW(UserRole.VIEWER),
    CUSTOMERS_CREATE(UserRole.AGENT),
    CUSTOMERS_EDIT(UserRole.AGENT),
    CUSTOMERS_DELETE(UserRole.ADMIN),

    // Orders
    ORDERS_VIEW(UserRole.VIEWER),
    ORDERS_CREATE(UserRole.AGENT),
    ORDERS_RENEW(UserRole.AGENT),
    ORDERS_EDIT(UserRole.MANAGER),
    ORDERS_DELETE(UserRole.ADMIN),

    // Products & Plans Catalog
    PRODUCTS_VIEW(UserRole.VIEWER),
    PRODUCTS_MANAGE(UserRole.ADMIN),

    // Inventory & Service Credentials
    INVENTORY_VIEW(UserRole.MANAGER),
    INVENTORY_MANAGE(UserRole.ADMIN),
    INVENTORY_CREDENTIALS_VIEW(UserRole.ADMIN),

    // Alerts & Messaging
    ALERTS_VIEW(UserRole.AGENT),
    WHATSAPP_SEND(UserRole.AGENT),

    // Settings & Connected Devices
    SETTINGS_VIEW(UserRole.VIEWER),
    SETTINGS_MANAGE(UserRole.ADMIN),
    DEVICES_MANAGE(UserRole.MANAGER),
    AUDIT_LOGS_VIEW(UserRole.ADMIN);

    fun isAuthorized(userRole: UserRole): Boolean {
        return userRole.level >= this.minRole.level
    }
}
