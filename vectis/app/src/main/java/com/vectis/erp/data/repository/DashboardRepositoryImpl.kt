package com.vectis.erp.data.repository

import com.vectis.erp.core.network.ApiResult
import com.vectis.erp.core.network.NetworkClient
import com.vectis.erp.data.api.DashboardApiService
import com.vectis.erp.data.model.DashboardStatsDto
import com.vectis.erp.domain.repository.DashboardRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class DashboardRepositoryImpl(
    private val networkClient: NetworkClient
) : DashboardRepository {

    override suspend fun getStats(): ApiResult<DashboardStatsDto> = withContext(Dispatchers.IO) {
        try {
            val api = networkClient.createService<DashboardApiService>()
            val response = api.getStats()

            if (response.isSuccessful && response.body() != null) {
                ApiResult.Success(response.body()!!)
            } else {
                ApiResult.Error(response.code(), "Failed to fetch dashboard metrics (${response.code()})")
            }
        } catch (e: Exception) {
            ApiResult.NetworkError(e)
        }
    }
}
