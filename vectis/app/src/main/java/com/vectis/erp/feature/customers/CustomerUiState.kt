package com.vectis.erp.feature.customers

import com.vectis.erp.data.model.CustomerDto
import com.vectis.erp.data.model.CustomerOrderDto

sealed interface CustomerListUiState {
    data object Loading : CustomerListUiState
    data class Success(
        val customers: List<CustomerDto>,
        val searchQuery: String = "",
        val selectedStatus: String? = null,
        val isRefreshing: Boolean = false
    ) : CustomerListUiState
    data class Error(val message: String) : CustomerListUiState
}

sealed interface CustomerDetailUiState {
    data object Loading : CustomerDetailUiState
    data class Success(
        val customer: CustomerDto,
        val orders: List<CustomerOrderDto>,
        val isActionLoading: Boolean = false
    ) : CustomerDetailUiState
    data class Error(val message: String) : CustomerDetailUiState
}
