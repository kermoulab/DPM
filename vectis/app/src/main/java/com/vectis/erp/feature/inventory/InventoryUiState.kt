package com.vectis.erp.feature.inventory

import com.vectis.erp.data.model.*

enum class InventoryTab(val title: String) {
    PRODUCTS("Products & Plans"),
    ACCOUNTS("Service Accounts"),
    LICENSES("License Keys")
}

sealed interface InventoryUiState {
    data object Loading : InventoryUiState
    data class Success(
        val activeTab: InventoryTab = InventoryTab.PRODUCTS,
        val products: List<ProductDto> = emptyList(),
        val plans: Map<String, List<PlanDto>> = emptyMap(),
        val accounts: List<ServiceAccountDto> = emptyList(),
        val licenses: List<LicenseKeyDto> = emptyList(),
        val expandedAccountId: String? = null,
        val accountProfiles: Map<String, List<ServiceProfileDto>> = emptyMap(),
        val revealedCredentials: Map<String, RevealCredentialResponse> = emptyMap(),
        val isRefreshing: Boolean = false,
        val searchQuery: String = ""
    ) : InventoryUiState
    data class Error(val message: String) : InventoryUiState
}
