package com.vectis.erp.feature.dashboard

import com.vectis.erp.data.model.DashboardStatsDto

sealed interface DashboardUiState {
    data object Loading : DashboardUiState
    data class Success(val stats: DashboardStatsDto) : DashboardUiState
    data class Error(val message: String) : DashboardUiState
}
