package com.vectis.erp.domain.repository

import com.vectis.erp.core.network.ApiResult
import com.vectis.erp.data.model.CurrencyDto

interface CurrencyRepository {
    suspend fun getCurrencies(): ApiResult<List<CurrencyDto>>
    suspend fun updateCurrencyRate(code: String, rate: Double): ApiResult<Unit>
}
