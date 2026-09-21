package com.vectis.erp.data.api

import com.vectis.erp.data.model.PairingRequest
import com.vectis.erp.data.model.PairingResponse
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.POST

/**
 * PairingApiService - Unauthenticated device registration endpoint
 */
interface PairingApiService {

    @POST("api/devices/pair")
    suspend fun pairDevice(
        @Body request: PairingRequest
    ): Response<PairingResponse>
}
