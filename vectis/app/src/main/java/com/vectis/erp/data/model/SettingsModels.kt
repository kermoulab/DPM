package com.vectis.erp.data.model

import com.google.gson.annotations.SerializedName



data class UpdateCurrencyRequest(
    @SerializedName("currency") val currency: String
)

data class SystemSettingsResponse(
    @SerializedName("settings") val settings: Map<String, Any>? = null
)

data class HealthResponse(
    @SerializedName("status") val status: String? = null,
    @SerializedName("database") val database: String? = null,
    @SerializedName("uptimeSeconds") val uptimeSeconds: Long? = null
)
