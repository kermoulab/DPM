package com.vectis.erp.data.api

import com.vectis.erp.data.model.CurrenciesResponse
import com.vectis.erp.data.model.CurrencyDto
import com.vectis.erp.data.model.UpdateCurrencyRateRequest
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.PUT
import retrofit2.http.Path

interface CurrencyApiService {

    @GET("api/currencies")
    suspend fun getCurrencies(): Response<CurrenciesResponse>

    @PUT("api/currencies/{code}")
    suspend fun updateCurrencyRate(
        @Path("code") code: String,
        @Body request: UpdateCurrencyRateRequest
    ): Response<Map<String, Any>>
}
