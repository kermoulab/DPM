package com.vectis.erp.data.model

import com.google.gson.annotations.SerializedName

data class RegisterPushTokenRequest(
    @SerializedName("token") val token: String,
    @SerializedName("device_id") val deviceId: String? = null,
    @SerializedName("platform") val platform: String = "android",
    @SerializedName("app_version") val appVersion: String? = "1.0.0"
)

data class UnregisterPushTokenRequest(
    @SerializedName("token") val token: String
)

data class NotificationItemDto(
    @SerializedName("id") val id: String,
    @SerializedName("user_id") val userId: String,
    @SerializedName("type") val type: String,
    @SerializedName("title") val title: String,
    @SerializedName("message") val message: String,
    @SerializedName("entity_type") val entityType: String?,
    @SerializedName("entity_id") val entityId: String?,
    @SerializedName("dedup_key") val dedupKey: String?,
    @SerializedName("is_read") val isRead: Boolean,
    @SerializedName("created_at") val createdAt: String,
    @SerializedName("sent_at") val sentAt: String?
)

data class NotificationsListResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("notifications") val notifications: List<NotificationItemDto>,
    @SerializedName("unreadCount") val unreadCount: Int
)

data class NotificationActionResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("message") val message: String?
)
