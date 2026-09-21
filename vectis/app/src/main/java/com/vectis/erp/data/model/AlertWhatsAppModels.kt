package com.vectis.erp.data.model

import com.google.gson.annotations.SerializedName

data class AlertOrderDto(
    @SerializedName("id") val id: String,
    @SerializedName("order_number") val orderNumber: String,
    @SerializedName("customer_id") val customerId: String,
    @SerializedName("customer_name") val customerName: String? = null,
    @SerializedName("customer_whatsapp") val customerWhatsapp: String? = null,
    @SerializedName("customer_email") val customerEmail: String? = null,
    @SerializedName("product_id") val productId: String,
    @SerializedName("product_name") val productName: String? = null,
    @SerializedName("plan_name") val planName: String? = null,
    @SerializedName("price") val price: Double = 0.0,
    @SerializedName("status") val status: String,
    @SerializedName("start_date") val startDate: String? = null,
    @SerializedName("end_date") val endDate: String? = null,
    @SerializedName("days_remaining") val daysRemaining: Int? = null,
    @SerializedName("days_expired") val daysExpired: Int? = null
)

data class LowStockAccountDto(
    @SerializedName("id") val id: String,
    @SerializedName("product_id") val productId: String,
    @SerializedName("product_name") val productName: String? = null,
    @SerializedName("provider") val provider: String,
    @SerializedName("total_profiles") val totalProfiles: Int = 0,
    @SerializedName("available_profiles") val availableProfiles: Int = 0
)

data class LowInventoryDto(
    @SerializedName("id") val id: String,
    @SerializedName("name") val name: String,
    @SerializedName("fulfillment_type") val fulfillmentType: String,
    @SerializedName("available_count") val availableCount: Int = 0
)

data class AlertsResponse(
    @SerializedName("badgeCount") val badgeCount: Int = 0,
    @SerializedName("expiringOrders") val expiringOrders: List<AlertOrderDto> = emptyList(),
    @SerializedName("expiredOrders") val expiredOrders: List<AlertOrderDto> = emptyList(),
    @SerializedName("lowStockAccounts") val lowStockAccounts: List<LowStockAccountDto> = emptyList(),
    @SerializedName("lowInventory") val lowInventory: List<LowInventoryDto> = emptyList()
)

data class ComposeWhatsAppRequest(
    @SerializedName("order_id") val orderId: String,
    @SerializedName("language") val language: String = "en",
    @SerializedName("event_type") val eventType: String = "order_expiring",
    @SerializedName("phone") val phone: String? = null
)

data class ComposeWhatsAppResponse(
    @SerializedName("text") val text: String,
    @SerializedName("phone") val phone: String,
    @SerializedName("formatted_phone") val formattedPhone: String? = null,
    @SerializedName("whatsapp_url") val whatsappUrl: String,
    @SerializedName("event_type") val eventType: String,
    @SerializedName("language") val language: String
)
