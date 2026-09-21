package com.vectis.erp.domain.repository

import com.vectis.erp.core.network.ApiResult
import com.vectis.erp.data.model.PairingResponse

interface PairingRepository {
    suspend fun pairWithCode(
        code: String,
        deviceName: String,
        serverUrl: String
    ): ApiResult<PairingResponse>

    suspend fun pairWithQrPayload(
        qrJson: String,
        deviceName: String,
        serverUrl: String
    ): ApiResult<PairingResponse>
}
