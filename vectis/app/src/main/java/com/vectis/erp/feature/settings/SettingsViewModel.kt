package com.vectis.erp.feature.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.vectis.erp.core.network.ApiResult
import com.vectis.erp.core.security.SecureStorage
import com.vectis.erp.data.model.UserDto
import com.vectis.erp.domain.repository.SettingsRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class SettingsViewModel(
    private val repository: SettingsRepository,
    private val secureStorage: SecureStorage
) : ViewModel() {

    private val _uiState = MutableStateFlow<SettingsUiState>(SettingsUiState.Loading)
    val uiState: StateFlow<SettingsUiState> = _uiState.asStateFlow()

    init {
        loadSettings()
    }

    fun loadSettings() {
        viewModelScope.launch {
            _uiState.value = SettingsUiState.Loading
            val meResult = repository.getMe()
            val healthResult = repository.getHealth()
            val sysResult = repository.getSettings()

            val user = when (meResult) {
                is ApiResult.Success -> meResult.data
                else -> UserDto(
                    id = secureStorage.getUserId() ?: "",
                    username = secureStorage.getUserName() ?: "User",
                    role = secureStorage.getUserRole() ?: "agent",
                    preferredCurrency = secureStorage.getPreferredCurrency()
                )
            }

            val isOnline = healthResult is ApiResult.Success
            val uptime = (healthResult as? ApiResult.Success)?.data?.uptimeSeconds ?: 0L
            val companyName = ((sysResult as? ApiResult.Success)?.data?.get("company_name") as? String) ?: "Vectis ERP"

            _uiState.value = SettingsUiState.Success(
                user = user,
                preferredCurrency = secureStorage.getPreferredCurrency(),
                serverUrl = secureStorage.getServerUrl(),
                deviceId = secureStorage.getDeviceId() ?: "Not paired",
                isServerOnline = isOnline,
                serverUptime = uptime,
                companyName = companyName
            )
        }
    }

    fun updatePreferredCurrency(currency: String) {
        val curr = currency.uppercase()
        secureStorage.setPreferredCurrency(curr)
        viewModelScope.launch {
            repository.updateCurrency(curr)
            loadSettings()
        }
    }

    fun updateServerUrl(newUrl: String) {
        val cleanUrl = newUrl.trimEnd('/')
        secureStorage.setServerUrl(cleanUrl)
        loadSettings()
    }

    fun logout(onSuccess: () -> Unit) {
        viewModelScope.launch {
            repository.logout()
            secureStorage.clearSession()
            onSuccess()
        }
    }

    fun unpairDevice(onSuccess: () -> Unit) {
        viewModelScope.launch {
            val deviceId = secureStorage.getDeviceId()
            if (!deviceId.isNullOrBlank()) {
                repository.unpairDevice(deviceId)
            }
            secureStorage.clearDevicePairing()
            secureStorage.clearSession()
            onSuccess()
        }
    }

    class Factory(
        private val repository: SettingsRepository,
        private val secureStorage: SecureStorage
    ) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            return SettingsViewModel(repository, secureStorage) as T
        }
    }
}
