package com.vectis.erp.core.authorization

import androidx.compose.runtime.Composable
import com.vectis.erp.core.security.SecureStorage

/**
 * PermissionManager - Evaluates permissions on Android UI.
 * Note: Per Rule 2, UI permission hiding is purely for user experience.
 * Authoritative security is independently enforced by the PostgreSQL backend.
 */
class PermissionManager(private val secureStorage: SecureStorage) {

    val currentUserRole: UserRole
        get() = UserRole.fromString(secureStorage.getUserRole())

    fun hasPermission(permission: AppPermission): Boolean {
        return permission.isAuthorized(currentUserRole)
    }

    // Convenience helpers
    fun canCreateOrder(): Boolean = hasPermission(AppPermission.ORDERS_CREATE)
    fun canRenewOrder(): Boolean = hasPermission(AppPermission.ORDERS_RENEW)
    fun canEditOrder(): Boolean = hasPermission(AppPermission.ORDERS_EDIT)
    fun canDeleteOrder(): Boolean = hasPermission(AppPermission.ORDERS_DELETE)

    fun canCreateCustomer(): Boolean = hasPermission(AppPermission.CUSTOMERS_CREATE)
    fun canEditCustomer(): Boolean = hasPermission(AppPermission.CUSTOMERS_EDIT)
    fun canDeleteCustomer(): Boolean = hasPermission(AppPermission.CUSTOMERS_DELETE)

    fun canViewInventory(): Boolean = hasPermission(AppPermission.INVENTORY_VIEW)
    fun canViewCredentials(): Boolean = hasPermission(AppPermission.INVENTORY_CREDENTIALS_VIEW)
    fun canManageInventory(): Boolean = hasPermission(AppPermission.INVENTORY_MANAGE)

    fun canManageProducts(): Boolean = hasPermission(AppPermission.PRODUCTS_MANAGE)
    fun canManageDevices(): Boolean = hasPermission(AppPermission.DEVICES_MANAGE)
    fun canViewAuditLogs(): Boolean = hasPermission(AppPermission.AUDIT_LOGS_VIEW)
}

/**
 * Composable helper that conditionally renders content only if the user role satisfies the required permission.
 */
@Composable
fun AuthorizedContent(
    permission: AppPermission,
    userRole: UserRole,
    fallback: @Composable () -> Unit = {},
    content: @Composable () -> Unit
) {
    if (permission.isAuthorized(userRole)) {
        content()
    } else {
        fallback()
    }
}
