package com.vectis.erp.data.model

import com.google.gson.annotations.SerializedName

data class CurrencyDto(
    @SerializedName("code") val code: String,
    @SerializedName("symbol") val symbol: String,
    @SerializedName("name") val name: String,
    @SerializedName("exchange_rate") val exchangeRate: Double = 1.0,
    @SerializedName("decimal_precision") val decimalPrecision: Int = 2,
    @SerializedName("is_base") val isBase: Boolean = false,
    @SerializedName("updated_at") val updatedAt: String? = null
)

data class CurrenciesResponse(
    @SerializedName("currencies") val currencies: List<CurrencyDto> = emptyList()
)

data class UpdateCurrencyRateRequest(
    @SerializedName("exchange_rate") val exchangeRate: Double,
    @SerializedName("symbol") val symbol: String? = null,
    @SerializedName("name") val name: String? = null
)
