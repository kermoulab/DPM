package com.vectis.erp.feature.dashboard

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.vectis.erp.core.network.ApiResult
import com.vectis.erp.domain.repository.DashboardRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.util.Locale

class DashboardViewModel(
    private val dashboardRepository: DashboardRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<DashboardUiState>(DashboardUiState.Loading)
    val uiState: StateFlow<DashboardUiState> = _uiState.asStateFlow()

    init {
        loadStats()
    }

    fun loadStats() {
        viewModelScope.launch {
            _uiState.value = DashboardUiState.Loading
            when (val result = dashboardRepository.getStats()) {
                is ApiResult.Success -> {
                    _uiState.value = DashboardUiState.Success(result.data)
                }
                is ApiResult.Error -> {
                    _uiState.value = DashboardUiState.Error(result.message)
                }
                is ApiResult.NetworkError -> {
                    _uiState.value = DashboardUiState.Error(
                        "Unable to connect to ERP server. Check your network connection."
                    )
                }
            }
        }
    }

    fun formatCurrency(amount: Double, currency: String = "USD"): String {
        return try {
            val symbol = when (currency.uppercase()) {
                "USD" -> "$"
                "EUR" -> "€"
                "GBP" -> "£"
                "MAD" -> "DH "
                else -> "$currency "
            }
            "$symbol${String.format(Locale.US, "%.2f", amount)}"
        } catch (_: Exception) {
            "$amount $currency"
        }
    }

    class Factory(
        private val dashboardRepository: DashboardRepository
    ) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            return DashboardViewModel(dashboardRepository) as T
        }
    }
}
