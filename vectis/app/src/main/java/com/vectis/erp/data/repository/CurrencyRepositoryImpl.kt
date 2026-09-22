package com.vectis.erp.data.repository

import com.vectis.erp.core.network.ApiResult
import com.vectis.erp.core.network.NetworkClient
import com.vectis.erp.data.api.CurrencyApiService
import com.vectis.erp.data.model.CurrencyDto
import com.vectis.erp.data.model.UpdateCurrencyRateRequest
import com.vectis.erp.domain.repository.CurrencyRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class CurrencyRepositoryImpl(
    private val networkClient: NetworkClient
) : CurrencyRepository {

    override suspend fun getCurrencies(): ApiResult<List<CurrencyDto>> = withContext(Dispatchers.IO) {
        try {
            val api = networkClient.createService<CurrencyApiService>()
            val response = api.getCurrencies()
            if (response.isSuccessful && response.body() != null) {
                ApiResult.Success(response.body()!!.currencies)
            } else {
                ApiResult.Error(response.code(), "Failed to fetch currencies (${response.code()})")
            }
        } catch (e: Exception) {
            ApiResult.NetworkError(e)
        }
    }

    override suspend fun updateCurrencyRate(code: String, rate: Double): ApiResult<Unit> = withContext(Dispatchers.IO) {
        try {
            val api = networkClient.createService<CurrencyApiService>()
            val response = api.updateCurrencyRate(code, UpdateCurrencyRateRequest(exchangeRate = rate))
            if (response.isSuccessful) {
                ApiResult.Success(Unit)
            } else {
                ApiResult.Error(response.code(), "Failed to update currency rate (${response.code()})")
            }
        } catch (e: Exception) {
            ApiResult.NetworkError(e)
        }
    }
}
