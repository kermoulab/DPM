package com.vectis.erp.data.repository

import com.vectis.erp.core.network.ApiResult
import com.vectis.erp.core.network.NetworkClient
import com.vectis.erp.data.api.SettingsApiService
import com.vectis.erp.data.model.*
import com.vectis.erp.domain.repository.SettingsRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class SettingsRepositoryImpl(
    private val networkClient: NetworkClient
) : SettingsRepository {

    override suspend fun getMe(): ApiResult<UserDto> = withContext(Dispatchers.IO) {
        try {
            val api = networkClient.createService<SettingsApiService>()
            val response = api.getMe()
            val user = response.body()?.user
            if (response.isSuccessful && user != null) {
                ApiResult.Success(user)
            } else {
                ApiResult.Error(response.code(), "Failed to fetch user profile (${response.code()})")
            }
        } catch (e: Exception) {
            ApiResult.NetworkError(e)
        }
    }

    override suspend fun getCurrencies(): ApiResult<List<CurrencyDto>> = withContext(Dispatchers.IO) {
        try {
            val api = networkClient.createService<com.vectis.erp.data.api.CurrencyApiService>()
            val response = api.getCurrencies()
            if (response.isSuccessful && response.body() != null) {
                ApiResult.Success(response.body()!!.currencies)
            } else {
                ApiResult.Error(response.code(), "Failed to fetch currencies")
            }
        } catch (e: Exception) {
            ApiResult.NetworkError(e)
        }
    }

    override suspend fun updateCurrency(currency: String): ApiResult<Unit> = withContext(Dispatchers.IO) {
        try {
            val api = networkClient.createService<SettingsApiService>()
            val response = api.updateCurrency(UpdateCurrencyRequest(currency))
            if (response.isSuccessful) {
                ApiResult.Success(Unit)
            } else {
                ApiResult.Error(response.code(), "Failed to update currency on server")
            }
        } catch (e: Exception) {
            ApiResult.NetworkError(e)
        }
    }

    override suspend fun logout(): ApiResult<Unit> = withContext(Dispatchers.IO) {
        try {
            val api = networkClient.createService<SettingsApiService>()
            val response = api.logout()
            if (response.isSuccessful) {
                ApiResult.Success(Unit)
            } else {
                ApiResult.Error(response.code(), "Logout returned status ${response.code()}")
            }
        } catch (e: Exception) {
            ApiResult.NetworkError(e)
        }
    }

    override suspend fun getSettings(): ApiResult<Map<String, Any>> = withContext(Dispatchers.IO) {
        try {
            val api = networkClient.createService<SettingsApiService>()
            val response = api.getSettings()
            if (response.isSuccessful && response.body() != null) {
                ApiResult.Success(response.body()!!.settings ?: emptyMap())
            } else {
                ApiResult.Error(response.code(), "Failed to fetch settings")
            }
        } catch (e: Exception) {
            ApiResult.NetworkError(e)
        }
    }

    override suspend fun getHealth(): ApiResult<HealthResponse> = withContext(Dispatchers.IO) {
        try {
            val api = networkClient.createService<SettingsApiService>()
            val response = api.getHealth()
            if (response.isSuccessful && response.body() != null) {
                ApiResult.Success(response.body()!!)
            } else {
                ApiResult.Error(response.code(), "Health check failed")
            }
        } catch (e: Exception) {
            ApiResult.NetworkError(e)
        }
    }

    override suspend fun unpairDevice(deviceId: String): ApiResult<Unit> = withContext(Dispatchers.IO) {
        try {
            val api = networkClient.createService<SettingsApiService>()
            val response = api.unpairDevice(deviceId)
            if (response.isSuccessful) {
                ApiResult.Success(Unit)
            } else {
                ApiResult.Error(response.code(), "Failed to unpair device")
            }
        } catch (e: Exception) {
            ApiResult.NetworkError(e)
        }
    }

    override suspend fun changePassword(currentPassword: String, newPassword: String): ApiResult<SimpleActionResponse> = withContext(Dispatchers.IO) {
        try {
            val api = networkClient.createService<SettingsApiService>()
            val response = api.changePassword(ChangePasswordRequest(currentPassword, newPassword))
            if (response.isSuccessful && response.body() != null) {
                ApiResult.Success(response.body()!!)
            } else {
                ApiResult.Error(response.code(), "Failed to change password (${response.code()})")
            }
        } catch (e: Exception) {
            ApiResult.NetworkError(e)
        }
    }

    override suspend fun getUsers(): ApiResult<UsersResponse> = withContext(Dispatchers.IO) {
        try {
            val api = networkClient.createService<SettingsApiService>()
            val response = api.getUsers()
            if (response.isSuccessful && response.body() != null) {
                ApiResult.Success(response.body()!!)
            } else {
                ApiResult.Error(response.code(), "Failed to fetch users (${response.code()})")
            }
        } catch (e: Exception) {
            ApiResult.NetworkError(e)
        }
    }

    override suspend fun createUser(req: CreateUserRequest): ApiResult<SimpleActionResponse> = withContext(Dispatchers.IO) {
        try {
            val api = networkClient.createService<SettingsApiService>()
            val response = api.createUser(req)
            if (response.isSuccessful && response.body() != null) {
                ApiResult.Success(response.body()!!)
            } else {
                ApiResult.Error(response.code(), "Failed to create user (${response.code()})")
            }
        } catch (e: Exception) {
            ApiResult.NetworkError(e)
        }
    }

    override suspend fun deleteUser(id: String): ApiResult<SimpleActionResponse> = withContext(Dispatchers.IO) {
        try {
            val api = networkClient.createService<SettingsApiService>()
            val response = api.deleteUser(id)
            if (response.isSuccessful && response.body() != null) {
                ApiResult.Success(response.body()!!)
            } else {
                ApiResult.Error(response.code(), "Failed to delete user (${response.code()})")
            }
        } catch (e: Exception) {
            ApiResult.NetworkError(e)
        }
    }

    override suspend fun getAuditLogs(page: Int, limit: Int): ApiResult<AuditLogsResponse> = withContext(Dispatchers.IO) {
        try {
            val api = networkClient.createService<SettingsApiService>()
            val response = api.getAuditLogs(page, limit)
            if (response.isSuccessful && response.body() != null) {
                ApiResult.Success(response.body()!!)
            } else {
                ApiResult.Error(response.code(), "Failed to fetch audit logs (${response.code()})")
            }
        } catch (e: Exception) {
            ApiResult.NetworkError(e)
        }
    }
}
