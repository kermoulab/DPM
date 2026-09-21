package com.vectis.erp.data.repository

import com.vectis.erp.core.network.ApiResult
import com.vectis.erp.core.network.NetworkClient
import com.vectis.erp.data.api.AlertWhatsAppApiService
import com.vectis.erp.data.model.*
import com.vectis.erp.domain.repository.AlertRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class AlertRepositoryImpl(
    private val networkClient: NetworkClient
) : AlertRepository {

    override suspend fun getAlerts(): ApiResult<AlertsResponse> = withContext(Dispatchers.IO) {
        try {
            val api = networkClient.createService<AlertWhatsAppApiService>()
            val response = api.getAlerts()
            if (response.isSuccessful && response.body() != null) {
                ApiResult.Success(response.body()!!)
            } else {
                ApiResult.Error(response.code(), "Failed to fetch alerts (${response.code()})")
            }
        } catch (e: Exception) {
            ApiResult.NetworkError(e)
        }
    }

    override suspend fun composeWhatsApp(request: ComposeWhatsAppRequest): ApiResult<ComposeWhatsAppResponse> = withContext(Dispatchers.IO) {
        try {
            val api = networkClient.createService<AlertWhatsAppApiService>()
            val response = api.composeWhatsApp(request)
            if (response.isSuccessful && response.body() != null) {
                ApiResult.Success(response.body()!!)
            } else {
                val errorBody = response.errorBody()?.string() ?: ""
                ApiResult.Error(response.code(), if (errorBody.isNotBlank()) errorBody else "Failed to compose WhatsApp notification (${response.code()})")
            }
        } catch (e: Exception) {
            ApiResult.NetworkError(e)
        }
    }
}
