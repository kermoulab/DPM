package com.vectis.erp.feature.dashboard

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.vectis.erp.core.currency.CurrencyFormatter
import com.vectis.erp.core.network.ApiResult
import com.vectis.erp.core.security.SecureStorage
import com.vectis.erp.domain.repository.DashboardRepository
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class DashboardViewModel(
    private val dashboardRepository: DashboardRepository,
    private val secureStorage: SecureStorage? = null,
    private val authRepository: com.vectis.erp.domain.repository.AuthRepository? = null
) : ViewModel() {

    private val _uiState = MutableStateFlow<DashboardUiState>(DashboardUiState.Loading)
    val uiState: StateFlow<DashboardUiState> = _uiState.asStateFlow()

    val preferredCurrency: StateFlow<String> = secureStorage?.preferredCurrencyFlow
        ?: MutableStateFlow("USD")

    init {
        if (secureStorage?.isAuthenticated() == true) {
            loadStats()
        }
        viewModelScope.launch {
            secureStorage?.preferredCurrencyFlow?.collect {
                val current = _uiState.value
                if (current is DashboardUiState.Success) {
                    _uiState.value = DashboardUiState.Success(current.stats)
                }
            }
        }
    }

    fun loadStats(isRefresh: Boolean = false) {
        viewModelScope.launch {
            val current = _uiState.value
            if (!isRefresh && current !is DashboardUiState.Success) {
                _uiState.value = DashboardUiState.Loading
            } else if (isRefresh && current is DashboardUiState.Success) {
                _uiState.value = current.copy(isRefreshing = true)
            }
            var result = dashboardRepository.getStats()
            if (result is ApiResult.NetworkError || (result is ApiResult.Error && result.code == 401)) {
                // Transient resilience retry (e.g. following URL redirect / token synchronization)
                delay(600)
                result = dashboardRepository.getStats()
            }
            when (result) {
                is ApiResult.Success -> {
                    _uiState.value = DashboardUiState.Success(result.data, isRefreshing = false)
                }
                is ApiResult.Error -> {
                    if (current !is DashboardUiState.Success) {
                        _uiState.value = DashboardUiState.Error(result.message)
                    } else {
                        _uiState.value = current.copy(isRefreshing = false)
                    }
                }
                is ApiResult.NetworkError -> {
                    if (current !is DashboardUiState.Success) {
                        _uiState.value = DashboardUiState.Error(
                            "Unable to connect to ERP server. Check your network connection."
                        )
                    } else {
                        _uiState.value = current.copy(isRefreshing = false)
                    }
                }
            }
        }
    }

    fun formatCurrency(amount: Double, currency: String = "USD"): String {
        val targetCurrency = secureStorage?.getPreferredCurrency() ?: currency
        return CurrencyFormatter.formatWithConversion(amount, fromCode = "USD", toCode = targetCurrency)
    }

    class Factory(
        private val dashboardRepository: DashboardRepository,
        private val secureStorage: SecureStorage? = null,
        private val authRepository: com.vectis.erp.domain.repository.AuthRepository? = null
    ) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            return DashboardViewModel(dashboardRepository, secureStorage, authRepository) as T
        }
    }
}
