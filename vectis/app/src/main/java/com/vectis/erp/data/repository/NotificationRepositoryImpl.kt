package com.vectis.erp.data.repository

import com.vectis.erp.core.network.ApiResult
import com.vectis.erp.core.network.NetworkClient
import com.vectis.erp.data.api.NotificationApiService
import com.vectis.erp.data.model.*
import com.vectis.erp.domain.repository.NotificationRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class NotificationRepositoryImpl(
    private val networkClient: NetworkClient
) : NotificationRepository {

    private val api: NotificationApiService
        get() = networkClient.createService()

    override suspend fun registerPushToken(token: String, deviceId: String?): ApiResult<Unit> =
        withContext(Dispatchers.IO) {
            try {
                val response = api.registerToken(
                    RegisterPushTokenRequest(
                        token = token,
                        deviceId = deviceId
                    )
                )
                if (response.isSuccessful && response.body()?.success == true) {
                    ApiResult.Success(Unit)
                } else {
                    ApiResult.Error(response.code(), response.errorBody()?.string() ?: "Failed to register push token")
                }
            } catch (e: Exception) {
                ApiResult.NetworkError(e)
            }
        }

    override suspend fun unregisterPushToken(token: String): ApiResult<Unit> =
        withContext(Dispatchers.IO) {
            try {
                val response = api.unregisterToken(UnregisterPushTokenRequest(token = token))
                if (response.isSuccessful) {
                    ApiResult.Success(Unit)
                } else {
                    ApiResult.Error(response.code(), response.errorBody()?.string() ?: "Failed to unregister push token")
                }
            } catch (e: Exception) {
                ApiResult.NetworkError(e)
            }
        }

    override suspend fun getNotifications(limit: Int): ApiResult<NotificationsListResponse> =
        withContext(Dispatchers.IO) {
            try {
                val response = api.getNotifications(limit)
                val body = response.body()
                if (response.isSuccessful && body != null) {
                    ApiResult.Success(body)
                } else {
                    ApiResult.Error(response.code(), response.errorBody()?.string() ?: "Failed to load notifications")
                }
            } catch (e: Exception) {
                ApiResult.NetworkError(e)
            }
        }

    override suspend fun markAsRead(id: String): ApiResult<Unit> =
        withContext(Dispatchers.IO) {
            try {
                val response = api.markAsRead(id)
                if (response.isSuccessful) {
                    ApiResult.Success(Unit)
                } else {
                    ApiResult.Error(response.code(), response.errorBody()?.string() ?: "Failed to mark as read")
                }
            } catch (e: Exception) {
                ApiResult.NetworkError(e)
            }
        }

    override suspend fun markAllAsRead(): ApiResult<Unit> =
        withContext(Dispatchers.IO) {
            try {
                val response = api.markAllAsRead()
                if (response.isSuccessful) {
                    ApiResult.Success(Unit)
                } else {
                    ApiResult.Error(response.code(), response.errorBody()?.string() ?: "Failed to mark all as read")
                }
            } catch (e: Exception) {
                ApiResult.NetworkError(e)
            }
        }

    override suspend fun getClientConfig(): ApiResult<com.vectis.erp.data.model.FirebaseClientConfigDto?> =
        withContext(Dispatchers.IO) {
            try {
                val response = api.getClientConfig()
                if (response.isSuccessful && response.body()?.success == true) {
                    ApiResult.Success(response.body()?.config)
                } else {
                    ApiResult.Error(response.code(), response.errorBody()?.string() ?: "Failed to fetch client config")
                }
            } catch (e: Exception) {
                ApiResult.NetworkError(e)
            }
        }
}
