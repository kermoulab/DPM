package com.vectis.erp.data.model

import com.google.gson.annotations.SerializedName

data class OrderDto(
    @SerializedName("id") val id: String = "",
    @SerializedName("order_number") val orderNumber: String = "",
    @SerializedName("customer_id") val customerId: String = "",
    @SerializedName("customer_name") val customerName: String? = null,
    @SerializedName("customer_email") val customerEmail: String? = null,
    @SerializedName("customer_whatsapp") val customerWhatsapp: String? = null,
    @SerializedName("product_id") val productId: String = "",
    @SerializedName("product_name") val productName: String? = null,
    @SerializedName("category_id") val categoryId: String? = null,
    @SerializedName("capabilities") val capabilities: List<String>? = emptyList(),
    @SerializedName("plan_id") val planId: String = "",
    @SerializedName("plan_name") val planName: String? = null,
    @SerializedName("duration") val duration: Int? = null,
    @SerializedName("duration_unit") val durationUnit: String? = null,
    @SerializedName("price") val price: Double = 0.0,
    @SerializedName("cost") val cost: Double = 0.0,
    @SerializedName("currency") val currency: String = "MAD",
    @SerializedName("status") val status: String = "pending",
    @SerializedName("start_date") val startDate: String? = null,
    @SerializedName("end_date") val endDate: String? = null,
    @SerializedName("payment_status") val paymentStatus: String? = "paid",
    @SerializedName("payment_method") val paymentMethod: String? = null,
    @SerializedName("assigned_service_account_id") val assignedServiceAccountId: String? = null,
    @SerializedName("assigned_profile_id") val assignedProfileId: String? = null,
    @SerializedName("assigned_license_key_id") val assignedLicenseKeyId: String? = null,
    @SerializedName("fulfillment_type") val fulfillmentType: String? = null,
    @SerializedName("fulfillment_data") val fulfillmentData: Map<String, Any>? = null,
    @SerializedName("notes") val notes: String? = null,
    @SerializedName("created_at") val createdAt: String? = null
) {
    val effectiveStatus: String
        get() {
            val st = status.lowercase().trim()
            if (st in listOf("cancelled", "canceled", "completed", "refunded", "pending")) return st
            val end = endDate?.take(10) ?: return st
            val today = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US).apply {
                timeZone = java.util.TimeZone.getTimeZone("UTC")
            }.format(java.util.Date())
            return if (end < today) "expired" else st
        }

    val isSubscription: Boolean
        get() = capabilities?.contains("subscription") == true || fulfillmentType?.contains("subscription") == true

    val isServiceAccount: Boolean
        get() = capabilities?.contains("service_account") == true || capabilities?.contains("profiles") == true || fulfillmentType == "service_account"

    val isLicenseKey: Boolean
        get() = capabilities?.contains("license_key") == true || fulfillmentType == "license_key"

    val isDigitalFile: Boolean
        get() = capabilities?.contains("digital_file") == true || capabilities?.contains("file_download") == true || fulfillmentType == "digital_file"

    // Fulfillment accessors
    val accountLogin: String?
        get() = fulfillmentData?.get("login") as? String ?: fulfillmentData?.get("account_login") as? String

    val accountPassword: String?
        get() = (fulfillmentData?.get("password") as? String)?.ifBlank { null }
            ?: (fulfillmentData?.get("account_password") as? String)?.ifBlank { null }
            ?: (fulfillmentData?.get("pass") as? String)?.ifBlank { null }

    val profileName: String?
        get() = fulfillmentData?.get("profile_name") as? String

    val profilePin: String?
        get() = fulfillmentData?.get("pin") as? String

    val licenseKeyString: String?
        get() = fulfillmentData?.get("license_key") as? String ?: fulfillmentData?.get("key") as? String
}

data class OrdersResponse(
    @SerializedName("orders") val orders: List<OrderDto> = emptyList(),
    @SerializedName("counts") val counts: Map<String, Int>? = null
)

data class OrderRenewalDto(
    @SerializedName("id") val id: String,
    @SerializedName("order_id") val orderId: String,
    @SerializedName("previous_end_date") val previousEndDate: String,
    @SerializedName("new_end_date") val newEndDate: String,
    @SerializedName("price") val price: Double = 0.0,
    @SerializedName("cost") val cost: Double = 0.0,
    @SerializedName("created_at") val createdAt: String? = null
)

data class OrderDetailResponse(
    @SerializedName("order") val order: OrderDto = OrderDto(),
    @SerializedName("renewals") val renewals: List<OrderRenewalDto> = emptyList()
)

data class CreateOrderRequest(
    @SerializedName("customer_id") val customerId: String,
    @SerializedName("product_id") val productId: String,
    @SerializedName("plan_id") val planId: String,
    @SerializedName("start_date") val startDate: String? = null,
    @SerializedName("custom_price") val customPrice: Double? = null,
    @SerializedName("custom_cost") val customCost: Double? = null,
    @SerializedName("payment_method") val paymentMethod: String? = null,
    @SerializedName("payment_status") val paymentStatus: String? = "paid",
    @SerializedName("notes") val notes: String? = null,
    @SerializedName("assigned_service_account_id") val assignedServiceAccountId: String? = null,
    @SerializedName("assigned_profile_id") val assignedProfileId: String? = null,
    @SerializedName("assigned_license_key_id") val assignedLicenseKeyId: String? = null
)

data class RenewOrderRequest(
    @SerializedName("extend_from") val extendFrom: String = "end_date",
    @SerializedName("custom_price") val customPrice: Double? = null
)

data class CancelOrderRequest(
    @SerializedName("reason") val reason: String? = null
)

data class OrderMutationResponse(
    @SerializedName("success") val success: Boolean = false,
    @SerializedName("order") val order: OrderDto? = null,
    @SerializedName("message") val message: String? = null,
    @SerializedName("error") val error: String? = null
)

data class UpdateOrderRequest(
    @SerializedName("customer_id") val customerId: String? = null,
    @SerializedName("product_id") val productId: String? = null,
    @SerializedName("plan_id") val planId: String? = null,
    @SerializedName("status") val status: String? = null,
    @SerializedName("payment_status") val paymentStatus: String? = null,
    @SerializedName("payment_method") val paymentMethod: String? = null,
    @SerializedName("price") val price: Double? = null,
    @SerializedName("cost") val cost: Double? = null,
    @SerializedName("start_date") val startDate: String? = null,
    @SerializedName("end_date") val endDate: String? = null,
    @SerializedName("notes") val notes: String? = null
)
