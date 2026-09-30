package com.vectis.erp.data.api

import com.vectis.erp.data.model.*
import retrofit2.Response
import retrofit2.http.*

interface NotificationApiService {

    @POST("/api/notifications/register-token")
    suspend fun registerToken(
        @Body request: RegisterPushTokenRequest
    ): Response<NotificationActionResponse>

    @POST("/api/notifications/unregister-token")
    suspend fun unregisterToken(
        @Body request: UnregisterPushTokenRequest
    ): Response<NotificationActionResponse>

    @GET("/api/notifications")
    suspend fun getNotifications(
        @Query("limit") limit: Int = 50
    ): Response<NotificationsListResponse>

    @PATCH("/api/notifications/{id}/read")
    suspend fun markAsRead(
        @Path("id") id: String
    ): Response<NotificationActionResponse>

    @POST("/api/notifications/read-all")
    suspend fun markAllAsRead(): Response<NotificationActionResponse>

    @GET("/api/notifications/client-config")
    suspend fun getClientConfig(): Response<FirebaseClientConfigResponse>
}
