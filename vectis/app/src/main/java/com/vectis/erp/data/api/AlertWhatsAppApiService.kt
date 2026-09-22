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

    @GET("api/whatsapp/templates")
    suspend fun getTemplates(): Response<WhatsAppTemplatesResponse>

    @POST("api/whatsapp/templates")
    suspend fun upsertTemplate(
        @Body request: UpsertTemplateRequest
    ): Response<Map<String, Any>>

    @DELETE("api/whatsapp/templates/{id}")
    suspend fun deleteTemplate(
        @Path("id") id: String
    ): Response<Map<String, Any>>
}
