package com.vectis.erp.data.api

import com.vectis.erp.data.model.DashboardStatsDto
import retrofit2.Response
import retrofit2.http.GET

/**
 * DashboardApiService - Fetches live aggregated dashboard statistics
 */
interface DashboardApiService {

    @GET("api/dashboard/stats")
    suspend fun getStats(): Response<DashboardStatsDto>
}
