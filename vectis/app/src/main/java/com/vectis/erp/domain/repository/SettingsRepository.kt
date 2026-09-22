package com.vectis.erp.domain.repository

import com.vectis.erp.core.network.ApiResult
import com.vectis.erp.data.model.HealthResponse
import com.vectis.erp.data.model.UserDto

interface SettingsRepository {
    suspend fun getMe(): ApiResult<UserDto>
    suspend fun updateCurrency(currency: String): ApiResult<Unit>
    suspend fun logout(): ApiResult<Unit>
    suspend fun getSettings(): ApiResult<Map<String, Any>>
    suspend fun getHealth(): ApiResult<HealthResponse>
    suspend fun unpairDevice(deviceId: String): ApiResult<Unit>
}
