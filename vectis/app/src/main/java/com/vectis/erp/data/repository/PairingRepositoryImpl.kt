package com.vectis.erp.data.repository

import android.os.Build
import com.google.gson.Gson
import com.vectis.erp.core.network.ApiResult
import com.vectis.erp.core.network.NetworkClient
import com.vectis.erp.core.security.SecureStorage
import com.vectis.erp.data.api.PairingApiService
import com.vectis.erp.data.model.PairingRequest
import com.vectis.erp.data.model.PairingResponse
import com.vectis.erp.data.model.QrPairingPayload
import com.vectis.erp.domain.repository.PairingRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class PairingRepositoryImpl(
    private val networkClient: NetworkClient,
    private val secureStorage: SecureStorage,
    private val gson: Gson = networkClient.gson
) : PairingRepository {

    override suspend fun pairWithCode(
        code: String,
        deviceName: String,
        serverUrl: String
    ): ApiResult<PairingResponse> = withContext(Dispatchers.IO) {
        try {
            if (serverUrl.isNotBlank()) {
                secureStorage.setServerUrl(serverUrl)
            }

            val apiService = networkClient.createService<PairingApiService>()
            val request = PairingRequest(
                code = code.trim(),
                deviceName = deviceName.ifBlank { "Android Device (${Build.MODEL})" },
                deviceModel = Build.MODEL
            )

            val response = apiService.pairDevice(request)
            if (response.isSuccessful) {
                val body = response.body()
                if (body != null && body.success && !body.deviceId.isNullOrBlank() && !body.deviceToken.isNullOrBlank()) {
                    // Persist hardware identity credentials securely in Keystore
                    secureStorage.setDeviceId(body.deviceId)
                    secureStorage.setDeviceToken(body.deviceToken)
                    ApiResult.Success(body)
                } else {
                    ApiResult.Error(response.code(), body?.error ?: "Invalid pairing response from server.")
                }
            } else {
                val errorBody = response.errorBody()?.string()
                val errorMsg = try {
                    val parsed = gson.fromJson(errorBody, PairingResponse::class.java)
                    parsed.error ?: "Pairing failed (${response.code()})"
                } catch (e: Exception) {
                    "Pairing failed with status ${response.code()}"
                }
                ApiResult.Error(response.code(), errorMsg)
            }
        } catch (e: Exception) {
            ApiResult.NetworkError(e)
        }
    }

    override suspend fun pairWithQrPayload(
        qrJson: String,
        deviceName: String,
        serverUrl: String
    ): ApiResult<PairingResponse> = withContext(Dispatchers.IO) {
        try {
            val payload = gson.fromJson(qrJson.trim(), QrPairingPayload::class.java)
            if (payload == null || payload.code.isBlank()) {
                return@withContext ApiResult.Error(400, "Invalid QR code format. Missing pairing code.")
            }
            pairWithCode(payload.code, deviceName, serverUrl)
        } catch (e: Exception) {
            ApiResult.Error(400, "Malformed QR code payload: ${e.message}")
        }
    }
}
