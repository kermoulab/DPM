package com.vectis.erp.data.api

import com.vectis.erp.data.model.LoginRequest
import com.vectis.erp.data.model.LoginResponse
import com.vectis.erp.data.model.LogoutResponse
import com.vectis.erp.data.model.MeResponse
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST

/**
 * AuthApiService - Authentication endpoints on Vectis ERP backend
 */
interface AuthApiService {

    @POST("api/auth/login")
    suspend fun login(
        @Body request: LoginRequest
    ): Response<LoginResponse>

    @GET("api/auth/me")
    suspend fun getMe(): Response<MeResponse>

    @POST("api/auth/logout")
    suspend fun logout(): Response<LogoutResponse>
}
