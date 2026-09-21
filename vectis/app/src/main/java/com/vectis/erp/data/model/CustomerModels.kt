package com.vectis.erp.data.model

import com.google.gson.annotations.SerializedName

data class CustomerDto(
    @SerializedName("id") val id: String,
    @SerializedName("name") val name: String,
    @SerializedName("email") val email: String? = null,
    @SerializedName("whatsapp") val whatsapp: String? = null,
    @SerializedName("notes") val notes: String? = null,
    @SerializedName("status") val status: String = "active",
    @SerializedName("created_at") val createdAt: String? = null,
    @SerializedName("total_orders") val totalOrders: Int = 0,
    @SerializedName("total_spent") val totalSpent: Double = 0.0
)

data class CustomersResponse(
    @SerializedName("customers") val customers: List<CustomerDto> = emptyList()
)

data class CustomerOrderDto(
    @SerializedName("id") val id: String,
    @SerializedName("order_number") val orderNumber: String? = null,
    @SerializedName("product_name") val productName: String? = null,
    @SerializedName("plan_name") val planName: String? = null,
    @SerializedName("price") val price: Double = 0.0,
    @SerializedName("status") val status: String = "pending",
    @SerializedName("start_date") val startDate: String? = null,
    @SerializedName("end_date") val endDate: String? = null,
    @SerializedName("created_at") val createdAt: String? = null
)

data class CustomerDetailResponse(
    @SerializedName("customer") val customer: CustomerDto,
    @SerializedName("orders") val orders: List<CustomerOrderDto> = emptyList()
)

data class CreateCustomerRequest(
    @SerializedName("name") val name: String,
    @SerializedName("email") val email: String? = null,
    @SerializedName("whatsapp") val whatsapp: String? = null,
    @SerializedName("notes") val notes: String? = null
)

data class UpdateCustomerRequest(
    @SerializedName("name") val name: String? = null,
    @SerializedName("email") val email: String? = null,
    @SerializedName("whatsapp") val whatsapp: String? = null,
    @SerializedName("notes") val notes: String? = null,
    @SerializedName("status") val status: String? = null
)

data class CustomerMutationResponse(
    @SerializedName("success") val success: Boolean = false,
    @SerializedName("id") val id: String? = null,
    @SerializedName("message") val message: String? = null,
    @SerializedName("customer") val customer: CustomerDto? = null,
    @SerializedName("error") val error: String? = null
)

/**
 * Strips non-digit formatting characters while preserving international + prefix.
 * Compliant with WhatsApp Click-to-Chat deep links.
 */
fun sanitizeWhatsAppPhone(phone: String?): String? {
    if (phone.isNullOrBlank()) return null
    var cleaned = phone.filter { it.isDigit() || it == '+' }
    if (cleaned.startsWith("+")) {
        cleaned = "+" + cleaned.drop(1).filter { it.isDigit() }
    } else {
        cleaned = cleaned.filter { it.isDigit() }
    }
    return if (cleaned.isBlank()) null else cleaned
}
