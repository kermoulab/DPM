package com.vectis.erp.feature.settings

import com.vectis.erp.data.model.UserDto

sealed interface SettingsUiState {
    data object Loading : SettingsUiState
    data class Success(
        val user: UserDto?,
        val preferredCurrency: String,
        val serverUrl: String,
        val deviceId: String,
        val isServerOnline: Boolean,
        val serverUptime: Long = 0,
        val companyName: String = "Vectis ERP"
    ) : SettingsUiState
    data class Error(val message: String) : SettingsUiState
}
