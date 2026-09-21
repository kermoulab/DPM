package com.vectis.erp.feature.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.vectis.erp.core.network.ApiResult
import com.vectis.erp.core.security.SecureStorage
import com.vectis.erp.domain.repository.AuthRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class LoginViewModel(
    private val authRepository: AuthRepository,
    private val secureStorage: SecureStorage
) : ViewModel() {

    private val _uiState = MutableStateFlow<AuthUiState>(AuthUiState.Idle)
    val uiState: StateFlow<AuthUiState> = _uiState.asStateFlow()

    var username: String = ""
        private set

    var password: String = ""
        private set

    var isPasswordVisible: Boolean = false
        private set

    fun updateUsername(input: String) {
        username = input
    }

    fun updatePassword(input: String) {
        password = input
    }

    fun togglePasswordVisibility() {
        isPasswordVisible = !isPasswordVisible
    }

    fun login(onSuccess: () -> Unit) {
        val trimmedUser = username.trim()
        val rawPass = password

        if (trimmedUser.isBlank()) {
            _uiState.value = AuthUiState.Error("Username is required.")
            return
        }
        if (rawPass.isBlank()) {
            _uiState.value = AuthUiState.Error("Password is required.")
            return
        }

        viewModelScope.launch {
            _uiState.value = AuthUiState.Loading
            when (val result = authRepository.login(trimmedUser, rawPass)) {
                is ApiResult.Success -> {
                    _uiState.value = AuthUiState.Success(result.data)
                    onSuccess()
                }
                is ApiResult.Error -> {
                    _uiState.value = AuthUiState.Error(result.message)
                }
                is ApiResult.NetworkError -> {
                    _uiState.value = AuthUiState.Error("Network error: Unable to reach server. Check connection.")
                }
            }
        }
    }

    fun unpairDevice(onUnpaired: () -> Unit) {
        secureStorage.clearDevicePairing()
        secureStorage.clearSession()
        onUnpaired()
    }

    fun clearError() {
        if (_uiState.value is AuthUiState.Error) {
            _uiState.value = AuthUiState.Idle
        }
    }

    class Factory(
        private val authRepository: AuthRepository,
        private val secureStorage: SecureStorage
    ) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            return LoginViewModel(authRepository, secureStorage) as T
        }
    }
}
