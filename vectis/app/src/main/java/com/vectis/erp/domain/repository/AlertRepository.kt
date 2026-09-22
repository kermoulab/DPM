package com.vectis.erp.domain.repository

import com.vectis.erp.core.network.ApiResult
import com.vectis.erp.data.model.*

interface AlertRepository {
    suspend fun getAlerts(): ApiResult<AlertsResponse>
    suspend fun composeWhatsApp(request: ComposeWhatsAppRequest): ApiResult<ComposeWhatsAppResponse>
    suspend fun getTemplates(): ApiResult<WhatsAppTemplatesResponse>
    suspend fun upsertTemplate(request: UpsertTemplateRequest): ApiResult<Unit>
    suspend fun deleteTemplate(id: String): ApiResult<Unit>
}
