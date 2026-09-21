package com.vectis.erp.data.api

import com.vectis.erp.data.model.*
import retrofit2.Response
import retrofit2.http.*

interface AlertWhatsAppApiService {

    @GET("api/alerts")
    suspend fun getAlerts(): Response<AlertsResponse>

    @POST("api/whatsapp/compose")
    suspend fun composeWhatsApp(
        @Body request: ComposeWhatsAppRequest
    ): Response<ComposeWhatsAppResponse>
}
