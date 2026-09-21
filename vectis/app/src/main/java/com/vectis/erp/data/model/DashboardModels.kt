package com.vectis.erp.data.model

import com.google.gson.annotations.SerializedName

data class FinancialStatsDto(
    @SerializedName("totalRevenue") val totalRevenue: Double = 0.0,
    @SerializedName("totalCost") val totalCost: Double = 0.0,
    @SerializedName("grossProfit") val grossProfit: Double = 0.0,
    @SerializedName("profitMargin") val profitMargin: Double = 0.0,
    @SerializedName("revenueToday") val revenueToday: Double = 0.0,
    @SerializedName("revenueThisMonth") val revenueThisMonth: Double = 0.0,
    @SerializedName("revenueGrowth") val revenueGrowth: Double = 0.0
)

data class CustomerStatsDto(
    @SerializedName("total") val total: Int = 0,
    @SerializedName("active") val active: Int = 0,
    @SerializedName("blocked") val blocked: Int = 0,
    @SerializedName("newThisMonth") val newThisMonth: Int = 0,
    @SerializedName("growthRate") val growthRate: Double = 0.0
)

data class OrderStatsDto(
    @SerializedName("total") val total: Int = 0,
    @SerializedName("active") val active: Int = 0,
    @SerializedName("expiring") val expiring: Int = 0,
    @SerializedName("expired") val expired: Int = 0,
    @SerializedName("cancelled") val cancelled: Int = 0,
    @SerializedName("activePercent") val activePercent: Double = 0.0,
    @SerializedName("expiringPercent") val expiringPercent: Double = 0.0,
    @SerializedName("expiredPercent") val expiredPercent: Double = 0.0
)

data class InventoryStatsDto(
    @SerializedName("stockStatus") val stockStatus: Int = 0,
    @SerializedName("turnoverRate") val turnoverRate: Int = 0,
    @SerializedName("productsOrdered") val productsOrdered: Int = 0,
    @SerializedName("serviceAccountsCount") val serviceAccountsCount: Int = 0,
    @SerializedName("totalProfiles") val totalProfiles: Int = 0,
    @SerializedName("availableProfiles") val availableProfiles: Int = 0,
    @SerializedName("assignedProfiles") val assignedProfiles: Int = 0,
    @SerializedName("totalLicenses") val totalLicenses: Int = 0,
    @SerializedName("availableLicenses") val availableLicenses: Int = 0,
    @SerializedName("assignedLicenses") val assignedLicenses: Int = 0,
    @SerializedName("assignedProfilesPercent") val assignedProfilesPercent: Double = 0.0,
    @SerializedName("unallocatedKeysPercent") val unallocatedKeysPercent: Double = 0.0
)

data class TopProductDto(
    @SerializedName("id") val id: String = "",
    @SerializedName("name") val name: String = "",
    @SerializedName("brand") val brand: String? = null,
    @SerializedName("fulfillment_type") val fulfillmentType: String? = null,
    @SerializedName("orderCount") val orderCount: Int = 0,
    @SerializedName("totalRevenue") val totalRevenue: Double = 0.0
)

data class RecentOrderDto(
    @SerializedName("id") val id: String = "",
    @SerializedName("order_number") val orderNumber: String = "",
    @SerializedName("product_name") val productName: String = "",
    @SerializedName("plan_name") val planName: String? = null,
    @SerializedName("status") val status: String = "active",
    @SerializedName("start_date") val startDate: String = "",
    @SerializedName("end_date") val endDate: String = "",
    @SerializedName("price") val price: Double = 0.0,
    @SerializedName("currency") val currency: String = "USD"
)

data class PurchaseAnalyticDto(
    @SerializedName("month") val month: String = "",
    @SerializedName("sold") val sold: Int = 0,
    @SerializedName("purchased") val purchased: Int = 0
)

data class DashboardStatsDto(
    @SerializedName("financial") val financial: FinancialStatsDto = FinancialStatsDto(),
    @SerializedName("customers") val customers: CustomerStatsDto = CustomerStatsDto(),
    @SerializedName("orders") val orders: OrderStatsDto = OrderStatsDto(),
    @SerializedName("inventory") val inventory: InventoryStatsDto = InventoryStatsDto(),
    @SerializedName("topProducts") val topProducts: List<TopProductDto> = emptyList(),
    @SerializedName("recentOrders") val recentOrders: List<RecentOrderDto> = emptyList(),
    @SerializedName("purchaseAnalytics") val purchaseAnalytics: List<PurchaseAnalyticDto> = emptyList()
)
