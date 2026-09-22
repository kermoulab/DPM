package com.vectis.erp.data.api

import com.vectis.erp.data.model.*
import retrofit2.Response
import retrofit2.http.*

interface SettingsApiService {

    @GET("api/auth/me")
    suspend fun getMe(): Response<MeResponse>

    @PUT("api/auth/currency")
    suspend fun updateCurrency(
        @Body request: UpdateCurrencyRequest
    ): Response<Unit>

    @POST("api/auth/logout")
    suspend fun logout(): Response<Unit>

    @GET("api/settings")
    suspend fun getSettings(): Response<SystemSettingsResponse>

    @GET("api/health")
    suspend fun getHealth(): Response<HealthResponse>

    @DELETE("api/devices/{id}")
    suspend fun unpairDevice(
        @Path("id") deviceId: String
    ): Response<Unit>
}
