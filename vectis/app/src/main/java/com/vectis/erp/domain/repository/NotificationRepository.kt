package com.vectis.erp.domain.repository

import com.vectis.erp.core.network.ApiResult
import com.vectis.erp.data.model.NotificationItemDto
import com.vectis.erp.data.model.NotificationsListResponse

interface NotificationRepository {
    suspend fun registerPushToken(token: String, deviceId: String?): ApiResult<Unit>
    suspend fun unregisterPushToken(token: String): ApiResult<Unit>
    suspend fun getNotifications(limit: Int = 50): ApiResult<NotificationsListResponse>
    suspend fun markAsRead(id: String): ApiResult<Unit>
    suspend fun markAllAsRead(): ApiResult<Unit>
}
