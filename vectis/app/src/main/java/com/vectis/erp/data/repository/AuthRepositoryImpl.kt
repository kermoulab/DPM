package com.vectis.erp.data.repository

import com.google.gson.Gson
import com.vectis.erp.core.network.ApiResult
import com.vectis.erp.core.network.NetworkClient
import com.vectis.erp.core.security.SecureStorage
import com.vectis.erp.data.api.AuthApiService
import com.vectis.erp.data.model.LoginRequest
import com.vectis.erp.data.model.LoginResponse
import com.vectis.erp.data.model.UserDto
import com.vectis.erp.domain.repository.AuthRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class AuthRepositoryImpl(
    private val networkClient: NetworkClient,
    private val secureStorage: SecureStorage,
    private val gson: Gson = networkClient.gson
) : AuthRepository {

    override suspend fun login(username: String, password: String): ApiResult<UserDto> = withContext(Dispatchers.IO) {
        try {
            val api = networkClient.createService<AuthApiService>()
            val response = api.login(LoginRequest(username.trim(), password))

            if (response.isSuccessful) {
                val body = response.body()
                if (body != null && body.success && !body.token.isNullOrBlank() && body.user != null) {
                    // Persist session JWT and user profile in Keystore
                    secureStorage.setAuthToken(body.token)
                    secureStorage.setUserId(body.user.id)
                    secureStorage.setUserRole(body.user.role)
                    val resolvedName = if (body.user.name.isNotBlank()) body.user.name else body.user.username
                    secureStorage.setUserName(resolvedName)
                    body.user.preferredCurrency?.let { curr ->
                        if (curr.isNotBlank()) secureStorage.setPreferredCurrency(curr.uppercase())
                    }
                    ApiResult.Success(body.user)
                } else {
                    ApiResult.Error(response.code(), body?.error ?: "Invalid credentials.")
                }
            } else {
                val errorBody = response.errorBody()?.string()
                val errorMsg = try {
                    val parsed = gson.fromJson(errorBody, LoginResponse::class.java)
                    parsed.error ?: "Authentication failed (${response.code()})"
                } catch (e: Exception) {
                    "Authentication failed with status ${response.code()}"
                }
                ApiResult.Error(response.code(), errorMsg)
            }
        } catch (e: Exception) {
            ApiResult.NetworkError(e)
        }
    }

    override suspend fun getMe(): ApiResult<UserDto> = withContext(Dispatchers.IO) {
        try {
            val api = networkClient.createService<AuthApiService>()
            val response = api.getMe()
            if (response.isSuccessful && response.body()?.user != null) {
                val body = response.body()!!
                val user = body.user!!
                body.token?.let { freshToken ->
                    if (freshToken.isNotBlank()) {
                        secureStorage.setAuthToken(freshToken)
                    }
                }
                secureStorage.setUserRole(user.role)
                val resolvedName = if (user.name.isNotBlank()) user.name else user.username
                secureStorage.setUserName(resolvedName)
                user.preferredCurrency?.let { curr ->
                    if (curr.isNotBlank()) secureStorage.setPreferredCurrency(curr.uppercase())
                }
                ApiResult.Success(user)
            } else {
                ApiResult.Error(response.code(), "Unable to fetch user profile.")
            }
        } catch (e: Exception) {
            ApiResult.NetworkError(e)
        }
    }

    override suspend fun logout(): ApiResult<Unit> = withContext(Dispatchers.IO) {
        try {
            val api = networkClient.createService<AuthApiService>()
            api.logout() // Best-effort server-side token revocation
        } catch (_: Exception) {
            // Even if network fails, always wipe local session credentials
        } finally {
            secureStorage.clearSession()
        }
        ApiResult.Success(Unit)
    }

    override fun isAuthenticated(): Boolean = secureStorage.isAuthenticated()

    override fun getStoredUserRole(): String? = secureStorage.getUserRole()

    override fun getStoredUserName(): String? = secureStorage.getUserName()

    override fun clearSession() {
        secureStorage.clearSession()
    }
}
