package com.vectis.erp.feature.auth

import com.vectis.erp.data.model.UserDto

sealed interface AuthUiState {
    data object Idle : AuthUiState
    data object Loading : AuthUiState
    data class Success(val user: UserDto) : AuthUiState
    data class Error(val message: String) : AuthUiState
}
