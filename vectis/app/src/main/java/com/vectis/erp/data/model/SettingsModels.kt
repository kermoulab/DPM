package com.vectis.erp.data.model

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
    @SerializedName("user_name") val userName: String? = null,
    @SerializedName("action") val action: String,
    @SerializedName("entity") val entity: String? = null,
    @SerializedName("entity_id") val entityId: String? = null,
    @SerializedName("details") val details: Any? = null,
    @SerializedName("ip_address") val ipAddress: String? = null,
    @SerializedName("created_at") val createdAt: String
)

data class AuditLogsResponse(
    @SerializedName("logs") val logs: List<AuditLogDto> = emptyList(),
    @SerializedName("total") val total: Int = 0,
    @SerializedName("page") val page: Int = 1,
    @SerializedName("limit") val limit: Int = 30,
    @SerializedName("totalPages") val totalPages: Int = 1
)
