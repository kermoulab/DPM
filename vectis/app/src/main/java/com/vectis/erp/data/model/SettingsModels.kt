package com.vectis.erp.data.model

import com.google.gson.Gson
import com.google.gson.annotations.SerializedName

data class UpdateCurrencyRequest(
    @SerializedName("currency") val currency: String
)

data class SystemSettingsResponse(
    @SerializedName("settings") val settings: Map<String, Any>? = null
)

data class HealthResponse(
    @SerializedName("status") val status: String? = null,
    @SerializedName("database") val database: String? = null,
    @SerializedName("uptimeSeconds") val uptimeSeconds: Long? = null
)

data class ChangePasswordRequest(
    @SerializedName("currentPassword") val currentPassword: String,
    @SerializedName("newPassword") val newPassword: String
)

data class UpdateProfileRequest(
    @SerializedName("name") val name: String,
    @SerializedName("username") val username: String,
    @SerializedName("email") val email: String,
    @SerializedName("preferred_currency") val preferredCurrency: String? = null,
    @SerializedName("currentPassword") val currentPassword: String? = null,
    @SerializedName("newPassword") val newPassword: String? = null,
    @SerializedName("confirmPassword") val confirmPassword: String? = null
)

data class UpdateProfileResponse(
    @SerializedName("success") val success: Boolean = true,
    @SerializedName("user") val user: UserDto? = null,
    @SerializedName("token") val token: String? = null,
    @SerializedName("message") val message: String? = null,
    @SerializedName("error") val error: String? = null
)

data class UsersResponse(
    @SerializedName("users") val users: List<UserDto> = emptyList()
)

data class CreateUserRequest(
    @SerializedName("username") val username: String,
    @SerializedName("email") val email: String,
    @SerializedName("name") val name: String,
    @SerializedName("password") val password: String,
    @SerializedName("role") val role: String = "agent",
    @SerializedName("preferred_currency") val preferredCurrency: String = "USD"
)

data class AuditLogDto(
    @SerializedName("id") val id: String,
    @SerializedName("user_id") val userId: String? = null,
    @SerializedName("username", alternate = ["user_name"]) val userName: String? = null,
    @SerializedName("action") val action: String,
    @SerializedName("entity") val entity: String? = null,
    @SerializedName("entity_id") val entityId: String? = null,
    @SerializedName("details") val details: Any? = null,
    @SerializedName("ip", alternate = ["ip_address"]) val ipAddress: String? = null,
    @SerializedName("created_at") val createdAt: String
)

fun extractAuditTargetName(log: AuditLogDto): String? {
    val action = log.action.uppercase()
    val entity = log.entity?.lowercase().orEmpty()

    // 1. Events where nothing should be shown below the username:
    // create user / login / logout / update profile / device paired / mobile / revoke device / pairing code / password
    if (action.contains("LOGIN") ||
        action.contains("LOGOUT") ||
        action.contains("AUTH") ||
        action.contains("PROFILE") ||
        action.contains("PASSWORD") ||
        action.contains("PAIRING") ||
        action.contains("DEVICE") ||
        action.contains("USER") ||
        action.contains("SYSTEM") ||
        entity == "device" ||
        entity == "user" ||
        entity == "system"
    ) {
        return null
    }

    // 2. Extract target name from details for order / product / plan / service account / customer / category
    val detailsMap: Map<*, *>? = when (val d = log.details) {
        is Map<*, *> -> d
        is String -> runCatching {
            Gson().fromJson(d, Map::class.java)
        }.getOrNull()
        else -> null
    }

    if (detailsMap != null) {
        // Order number
        val orderNum = (detailsMap["order_number"] ?: detailsMap["orderNumber"])?.toString()?.takeIf { it.isNotBlank() }
        if (orderNum != null) return orderNum

        // Direct name (product, plan, customer, category, etc.)
        val name = detailsMap["name"]?.toString()?.takeIf { it.isNotBlank() }
        if (name != null) return name

        // Service account provider / login
        val provider = detailsMap["provider"]?.toString()?.takeIf { it.isNotBlank() }
        val login = (detailsMap["login"] ?: detailsMap["email"])?.toString()?.takeIf { it.isNotBlank() }
        if (provider != null && login != null) {
            return "$provider ($login)"
        } else if (provider != null) {
            return provider
        } else if (login != null) {
            return login
        }

        val customerName = detailsMap["customer_name"]?.toString()?.takeIf { it.isNotBlank() }
        if (customerName != null) return customerName

        val productName = detailsMap["product_name"]?.toString()?.takeIf { it.isNotBlank() }
        if (productName != null) return productName
    }

    // Fallback: If entity ID is present, show snippet e.g. "#a1b2c3d4"
    return log.entityId?.takeIf { it.isNotBlank() }?.let { "#${it.take(8)}" }
}

data class AuditLogsResponse(
    @SerializedName("logs") val logs: List<AuditLogDto> = emptyList(),
    @SerializedName("total") val total: Int = 0,
    @SerializedName("page") val page: Int = 1,
    @SerializedName("limit") val limit: Int = 30,
    @SerializedName("totalPages") val totalPages: Int = 1
)
