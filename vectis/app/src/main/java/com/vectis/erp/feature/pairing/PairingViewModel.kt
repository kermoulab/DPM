package com.vectis.erp.feature.pairing

import android.os.Build
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.vectis.erp.core.network.ApiResult
import com.vectis.erp.core.security.SecureStorage
import com.vectis.erp.domain.repository.PairingRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class PairingViewModel(
    private val pairingRepository: PairingRepository,
    private val secureStorage: SecureStorage
) : ViewModel() {

    private val _uiState = MutableStateFlow<PairingUiState>(PairingUiState.Idle)
    val uiState: StateFlow<PairingUiState> = _uiState.asStateFlow()

    var serverUrl: String = secureStorage.getServerUrl()
        private set

    var pairingCode: String = ""
        private set

    var deviceName: String = "Android Terminal (${Build.MODEL})"
        private set

    fun updateServerUrl(url: String) {
        serverUrl = url.trimEnd('/')
        secureStorage.setServerUrl(serverUrl)
    }

    fun updatePairingCode(code: String) {
        pairingCode = code.filter { it.isDigit() }.take(8)
    }

    fun updateDeviceName(name: String) {
        deviceName = name
    }

    fun submitPairingCode(onSuccess: () -> Unit) {
        val code = pairingCode.trim()
        if (code.length < 6) {
            _uiState.value = PairingUiState.Error("Please enter a valid 6 to 8-digit pairing code.")
            return
        }

        viewModelScope.launch {
            _uiState.value = PairingUiState.Loading
            when (val result = pairingRepository.pairWithCode(code, deviceName, serverUrl)) {
                is ApiResult.Success -> {
                    val resp = result.data
                    _uiState.value = PairingUiState.Success(
                        deviceId = resp.deviceId.orEmpty(),
                        deviceName = resp.deviceName.orEmpty()
                    )
                    onSuccess()
                }
                is ApiResult.Error -> {
                    _uiState.value = PairingUiState.Error(result.message)
                }
                is ApiResult.NetworkError -> {
                    _uiState.value = PairingUiState.Error(
                        "Network error: Unable to connect to $serverUrl. Check server status and network."
                    )
                }
            }
        }
    }

    fun submitQrPayload(qrJson: String, onSuccess: () -> Unit) {
        viewModelScope.launch {
            _uiState.value = PairingUiState.Loading
            when (val result = pairingRepository.pairWithQrPayload(qrJson, deviceName, serverUrl)) {
                is ApiResult.Success -> {
                    val resp = result.data
                    _uiState.value = PairingUiState.Success(
                        deviceId = resp.deviceId.orEmpty(),
                        deviceName = resp.deviceName.orEmpty()
                    )
                    onSuccess()
                }
                is ApiResult.Error -> {
                    _uiState.value = PairingUiState.Error(result.message)
                }
                is ApiResult.NetworkError -> {
                    _uiState.value = PairingUiState.Error(
                        "Network error connecting to $serverUrl."
                    )
                }
            }
        }
    }

    fun clearError() {
        if (_uiState.value is PairingUiState.Error) {
            _uiState.value = PairingUiState.Idle
        }
    }

    class Factory(
        private val pairingRepository: PairingRepository,
        private val secureStorage: SecureStorage
    ) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            return PairingViewModel(pairingRepository, secureStorage) as T
        }
    }
}
