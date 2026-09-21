package com.vectis.erp.feature.pairing

sealed interface PairingUiState {
    data object Idle : PairingUiState
    data object Loading : PairingUiState
    data class Success(val deviceId: String, val deviceName: String) : PairingUiState
    data class Error(val message: String) : PairingUiState
}
