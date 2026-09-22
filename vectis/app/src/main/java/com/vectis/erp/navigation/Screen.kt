package com.vectis.erp.navigation

/**
 * Screen routes for Compose Navigation.
 */
sealed class Screen(val route: String) {
    // Pairing flow
    data object Pairing : Screen("pairing")
    data object ScanQr : Screen("scan_qr")
    data object EnterCode : Screen("enter_code")

    // Authentication
    data object Login : Screen("login")

    // Main App Shell Navigation
    data object Dashboard : Screen("dashboard")
    data object Orders : Screen("orders")
    data object Products : Screen("products")
    data object Inventory : Screen("inventory")
    data object Customers : Screen("customers")
    data object Alerts : Screen("alerts")
    data object Settings : Screen("settings")

    // Deep navigation
    data object CreateOrder : Screen("create_order")
    data object OrderDetail : Screen("order_detail/{orderId}") {
        fun createRoute(orderId: String) = "order_detail/$orderId"
    }
    data object CustomerDetail : Screen("customer_detail/{customerId}") {
        fun createRoute(customerId: String) = "customer_detail/$customerId"
    }
    data object UniversalSearch : Screen("search")
}
