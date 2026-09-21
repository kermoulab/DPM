package com.vectis.erp.feature.orders

import com.vectis.erp.data.model.*

sealed interface OrderListUiState {
    data object Loading : OrderListUiState
    data class Success(
        val orders: List<OrderDto>,
        val counts: Map<String, Int> = emptyMap(),
        val selectedStatus: String? = null,
        val searchQuery: String = "",
        val isRefreshing: Boolean = false
    ) : OrderListUiState
    data class Error(val message: String) : OrderListUiState
}

sealed interface OrderDetailUiState {
    data object Loading : OrderDetailUiState
    data class Success(
        val order: OrderDto,
        val renewals: List<OrderRenewalDto> = emptyList(),
        val isActionLoading: Boolean = false
    ) : OrderDetailUiState
    data class Error(val message: String) : OrderDetailUiState
}

data class CreateOrderWizardState(
    val customers: List<CustomerDto> = emptyList(),
    val products: List<ProductDto> = emptyList(),
    val plans: List<PlanDto> = emptyList(),
    val selectedCustomer: CustomerDto? = null,
    val selectedProduct: ProductDto? = null,
    val selectedPlan: PlanDto? = null,
    val startDate: String = "",
    val endDate: String = "",
    val customPrice: String = "",
    val paymentMethod: String = "Cash",
    val paymentStatus: String = "paid",
    val notes: String = "",
    val isLoading: Boolean = false,
    val isSubmitting: Boolean = false,
    val error: String? = null
)
