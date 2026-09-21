package com.vectis.erp.domain.repository

import com.vectis.erp.core.network.ApiResult
import com.vectis.erp.data.model.DashboardStatsDto

interface DashboardRepository {
    suspend fun getStats(): ApiResult<DashboardStatsDto>
}
