package com.vectis.erp.domain.repository

import com.vectis.erp.core.network.ApiResult
import com.vectis.erp.data.model.*

interface SettingsRepository {
    suspend fun getMe(): ApiResult<UserDto>
    suspend fun getCurrencies(): ApiResult<List<CurrencyDto>>
    suspend fun updateCurrency(currency: String): ApiResult<Unit>
    suspend fun logout(): ApiResult<Unit>
    suspend fun getSettings(): ApiResult<Map<String, Any>>
    suspend fun getHealth(): ApiResult<HealthResponse>
    suspend fun unpairDevice(deviceId: String): ApiResult<Unit>

    suspend fun changePassword(currentPassword: String, newPassword: String): ApiResult<SimpleActionResponse>
    suspend fun getUsers(): ApiResult<UsersResponse>
    suspend fun createUser(req: CreateUserRequest): ApiResult<SimpleActionResponse>
    suspend fun deleteUser(id: String): ApiResult<SimpleActionResponse>
    suspend fun getAuditLogs(page: Int = 1, limit: Int = 30): ApiResult<AuditLogsResponse>
}
