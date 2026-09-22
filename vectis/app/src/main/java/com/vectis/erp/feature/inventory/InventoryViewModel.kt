package com.vectis.erp.feature.inventory

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.vectis.erp.core.authorization.PermissionManager
import com.vectis.erp.core.network.ApiResult
import com.vectis.erp.core.security.SecureStorage
import com.vectis.erp.data.model.*
import com.vectis.erp.domain.repository.ProductInventoryRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.text.NumberFormat
import java.util.Locale

class InventoryViewModel(
    private val repository: ProductInventoryRepository,
    private val secureStorage: SecureStorage,
    val permissionManager: PermissionManager
) : ViewModel() {

    private val _uiState = MutableStateFlow<InventoryUiState>(InventoryUiState.Loading)
    val uiState: StateFlow<InventoryUiState> = _uiState.asStateFlow()

    init {
        loadData()
    }

    fun selectTab(tab: InventoryTab) {
        val current = _uiState.value
        if (current is InventoryUiState.Success) {
            _uiState.value = current.copy(activeTab = tab)
        }
    }

    fun loadData(isRefresh: Boolean = false) {
        viewModelScope.launch {
            val current = _uiState.value
            if (!isRefresh && current !is InventoryUiState.Success) {
                _uiState.value = InventoryUiState.Loading
            } else if (isRefresh && current is InventoryUiState.Success) {
                _uiState.value = current.copy(isRefreshing = true)
            }

            val productsRes = repository.getProducts()
            val plansRes = repository.getPlans()
            val accountsRes = repository.getServiceAccounts()
            val licensesRes = repository.getLicenseKeys()

            val products = if (productsRes is ApiResult.Success) productsRes.data.products else emptyList()
            val plans = if (plansRes is ApiResult.Success) {
                plansRes.data.plans.groupBy { it.productId }
            } else if (current is InventoryUiState.Success) {
                current.plans
            } else emptyMap()
            val accounts = if (accountsRes is ApiResult.Success) accountsRes.data.accounts else emptyList()
            val licenses = if (licensesRes is ApiResult.Success) licensesRes.data.licenses else emptyList()

            val activeTab = if (current is InventoryUiState.Success) current.activeTab else InventoryTab.PRODUCTS
            val expanded = if (current is InventoryUiState.Success) current.expandedAccountId else null
            val profiles = if (current is InventoryUiState.Success) current.accountProfiles else emptyMap()
            val creds = if (current is InventoryUiState.Success) current.revealedCredentials else emptyMap()

            _uiState.value = InventoryUiState.Success(
                activeTab = activeTab,
                products = products,
                plans = plans,
                accounts = accounts,
                licenses = licenses,
                expandedAccountId = expanded,
                accountProfiles = profiles,
                revealedCredentials = creds,
                isRefreshing = false
            )
        }
    }

    fun toggleAccountExpansion(accountId: String) {
        val current = _uiState.value as? InventoryUiState.Success ?: return
        val isCurrentlyExpanded = current.expandedAccountId == accountId
        val newExpandedId = if (isCurrentlyExpanded) null else accountId

        _uiState.value = current.copy(expandedAccountId = newExpandedId)

        if (newExpandedId != null && !current.accountProfiles.containsKey(accountId)) {
            viewModelScope.launch {
                when (val result = repository.getAccountProfiles(accountId)) {
                    is ApiResult.Success -> {
                        val state = _uiState.value as? InventoryUiState.Success ?: return@launch
                        val updated = state.accountProfiles.toMutableMap()
                        updated[accountId] = result.data.profiles
                        _uiState.value = state.copy(accountProfiles = updated)
                    }
                    else -> {}
                }
            }
        }
    }

    fun revealCredential(accountId: String, onError: (String) -> Unit) {
        if (!permissionManager.canViewCredentials()) {
            onError("Permission denied: Viewing master credentials requires Manager or Admin role.")
            return
        }

        viewModelScope.launch {
            when (val result = repository.revealCredentials(accountId)) {
                is ApiResult.Success -> {
                    val state = _uiState.value as? InventoryUiState.Success ?: return@launch
                    val updated = state.revealedCredentials.toMutableMap()
                    updated[accountId] = result.data
                    _uiState.value = state.copy(revealedCredentials = updated)
                }
                is ApiResult.Error -> {
                    onError(result.message)
                }
                is ApiResult.NetworkError -> {
                    onError(result.exception.localizedMessage ?: "Network connection failed")
                }
            }
        }
    }

    fun hideCredential(accountId: String) {
        val state = _uiState.value as? InventoryUiState.Success ?: return
        val updated = state.revealedCredentials.toMutableMap()
        updated.remove(accountId)
        _uiState.value = state.copy(revealedCredentials = updated)
    }

    fun formatCurrency(amount: Double): String {
        val currency = secureStorage.getPreferredCurrency()
        val format = NumberFormat.getNumberInstance(Locale.US).apply {
            minimumFractionDigits = 2
            maximumFractionDigits = 2
        }
        val symbol = when (currency.uppercase()) {
            "MAD" -> " MAD"
            "EUR" -> "€"
            "USD" -> "$"
            else -> " $currency"
        }
        return if (currency.uppercase() == "MAD") {
            "${format.format(amount)}$symbol"
        } else {
            "$symbol${format.format(amount)}"
        }
    }

    class Factory(
        private val repository: ProductInventoryRepository,
        private val secureStorage: SecureStorage,
        private val permissionManager: PermissionManager
    ) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            return InventoryViewModel(repository, secureStorage, permissionManager) as T
        }
    }
}
