package com.vectis.erp.domain.repository

import com.vectis.erp.core.network.ApiResult
import com.vectis.erp.data.model.UserDto

interface AuthRepository {
    suspend fun login(username: String, password: String): ApiResult<UserDto>
    suspend fun getMe(): ApiResult<UserDto>
    suspend fun logout(): ApiResult<Unit>
    fun isAuthenticated(): Boolean
    fun getStoredUserRole(): String?
    fun getStoredUserName(): String?
    fun clearSession()
}
