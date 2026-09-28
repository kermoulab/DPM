package com.vectis.erp.feature.inventory

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.vectis.erp.core.authorization.PermissionManager
import com.vectis.erp.core.network.ApiResult
import com.vectis.erp.core.security.SecureStorage
import com.vectis.erp.data.model.*
import com.vectis.erp.domain.repository.ProductInventoryRepository
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.text.NumberFormat
import java.util.Locale

class InventoryViewModel(
    private val repository: ProductInventoryRepository,
    private val secureStorage: SecureStorage,
    val permissionManager: PermissionManager,
    private val authRepository: com.vectis.erp.domain.repository.AuthRepository? = null
) : ViewModel() {

    private val _uiState = MutableStateFlow<InventoryUiState>(InventoryUiState.Loading)
    val uiState: StateFlow<InventoryUiState> = _uiState.asStateFlow()

    val preferredCurrency: StateFlow<String> = secureStorage.preferredCurrencyFlow

    init {
        if (secureStorage.isAuthenticated()) {
            loadData()
        }
        viewModelScope.launch {
            secureStorage.preferredCurrencyFlow.collect {
                val current = _uiState.value
                if (current is InventoryUiState.Success) {
                    _uiState.value = current.copy()
                }
            }
        }
    }

    fun selectTab(tab: InventoryTab) {
        val current = _uiState.value
        if (current is InventoryUiState.Success) {
            _uiState.value = current.copy(activeTab = tab)
        }
    }

    fun selectCategory(categoryId: String) {
        val current = _uiState.value
        if (current is InventoryUiState.Success) {
            _uiState.value = current.copy(selectedCategoryId = categoryId)
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

            val productsDef = async { repository.getProducts() }
            val categoriesDef = async { repository.getCategories() }
            val plansDef = async { repository.getPlans() }
            val accountsDef = async { repository.getServiceAccounts() }
            val licensesDef = async { repository.getLicenseKeys() }

            val productsRes = productsDef.await()
            val categoriesRes = categoriesDef.await()
            val plansRes = plansDef.await()
            val accountsRes = accountsDef.await()
            val licensesRes = licensesDef.await()

            val products = if (productsRes is ApiResult.Success) productsRes.data.products else emptyList()
            val categories = if (categoriesRes is ApiResult.Success) categoriesRes.data.categories else emptyList()
            val plans = if (plansRes is ApiResult.Success) {
                plansRes.data.plans.groupBy { it.productId }
            } else if (current is InventoryUiState.Success) {
                current.plans
            } else emptyMap()
            val accounts = if (accountsRes is ApiResult.Success) accountsRes.data.accounts else emptyList()
            val licenses = if (licensesRes is ApiResult.Success) licensesRes.data.licenses else emptyList()

            val activeTab = if (current is InventoryUiState.Success) current.activeTab else InventoryTab.ACCOUNTS
            val selectedCategory = if (current is InventoryUiState.Success) current.selectedCategoryId else "all"
            val expanded = if (current is InventoryUiState.Success) current.expandedAccountId else null
            val profilesMap = (if (current is InventoryUiState.Success) current.accountProfiles else emptyMap()).toMutableMap()
            if (expanded != null && !profilesMap.containsKey(expanded)) {
                val pRes = repository.getAccountProfiles(expanded)
                if (pRes is ApiResult.Success) {
                    profilesMap[expanded] = pRes.data.profiles
                }
            }
            val creds = if (current is InventoryUiState.Success) current.revealedCredentials else emptyMap()

            _uiState.value = InventoryUiState.Success(
                activeTab = activeTab,
                products = products,
                categories = categories,
                selectedCategoryId = selectedCategory,
                plans = plans,
                accounts = accounts,
                licenses = licenses,
                expandedAccountId = expanded,
                accountProfiles = profilesMap,
                revealedCredentials = creds,
                isRefreshing = false
            )
        }
    }

    fun createProduct(req: CreateProductRequest, onSuccess: () -> Unit, onError: (String) -> Unit) {
        if (!permissionManager.canManageProducts()) {
            onError("Permission denied: Managing products requires Manager or Admin role.")
            return
        }
        viewModelScope.launch {
            when (val res = repository.createProduct(req)) {
                is ApiResult.Success -> {
                    loadData(isRefresh = true)
                    onSuccess()
                }
                is ApiResult.Error -> onError(res.message)
                is ApiResult.NetworkError -> onError(res.exception.localizedMessage ?: "Network connection failed")
            }
        }
    }

    fun updateProduct(id: String, req: UpdateProductRequest, onSuccess: () -> Unit, onError: (String) -> Unit) {
        if (!permissionManager.canManageProducts()) {
            onError("Permission denied: Managing products requires Manager or Admin role.")
            return
        }
        viewModelScope.launch {
            when (val res = repository.updateProduct(id, req)) {
                is ApiResult.Success -> {
                    loadData(isRefresh = true)
                    onSuccess()
                }
                is ApiResult.Error -> onError(res.message)
                is ApiResult.NetworkError -> onError(res.exception.localizedMessage ?: "Network connection failed")
            }
        }
    }

    fun deleteProduct(id: String, onSuccess: () -> Unit, onError: (String) -> Unit) {
        if (!permissionManager.canManageProducts()) {
            onError("Permission denied: Managing products requires Manager or Admin role.")
            return
        }
        viewModelScope.launch {
            when (val res = repository.deleteProduct(id)) {
                is ApiResult.Success -> {
                    loadData(isRefresh = true)
                    onSuccess()
                }
                is ApiResult.Error -> onError(res.message)
                is ApiResult.NetworkError -> onError(res.exception.localizedMessage ?: "Network connection failed")
            }
        }
    }

    fun createCategory(req: CreateCategoryRequest, onSuccess: () -> Unit, onError: (String) -> Unit) {
        if (!permissionManager.canManageProducts()) {
            onError("Permission denied: Managing categories requires Manager or Admin role.")
            return
        }
        viewModelScope.launch {
            when (val res = repository.createCategory(req)) {
                is ApiResult.Success -> {
                    loadData(isRefresh = true)
                    onSuccess()
                }
                is ApiResult.Error -> onError(res.message)
                is ApiResult.NetworkError -> onError(res.exception.localizedMessage ?: "Network connection failed")
            }
        }
    }

    fun updateCategory(id: String, req: UpdateCategoryRequest, onSuccess: () -> Unit, onError: (String) -> Unit) {
        if (!permissionManager.canManageProducts()) {
            onError("Permission denied: Managing categories requires Manager or Admin role.")
            return
        }
        viewModelScope.launch {
            when (val res = repository.updateCategory(id, req)) {
                is ApiResult.Success -> {
                    loadData(isRefresh = true)
                    onSuccess()
                }
                is ApiResult.Error -> onError(res.message)
                is ApiResult.NetworkError -> onError(res.exception.localizedMessage ?: "Network connection failed")
            }
        }
    }

    fun deleteCategory(id: String, onSuccess: () -> Unit, onError: (String) -> Unit) {
        if (!permissionManager.canManageProducts()) {
            onError("Permission denied: Managing categories requires Manager or Admin role.")
            return
        }
        viewModelScope.launch {
            when (val res = repository.deleteCategory(id)) {
                is ApiResult.Success -> {
                    loadData(isRefresh = true)
                    onSuccess()
                }
                is ApiResult.Error -> onError(res.message)
                is ApiResult.NetworkError -> onError(res.exception.localizedMessage ?: "Network connection failed")
            }
        }
    }

    fun createPlan(req: CreatePlanRequest, onSuccess: () -> Unit, onError: (String) -> Unit) {
        if (!permissionManager.canManageProducts()) {
            onError("Permission denied: Managing plans requires Manager or Admin role.")
            return
        }
        viewModelScope.launch {
            when (val res = repository.createPlan(req)) {
                is ApiResult.Success -> {
                    loadData(isRefresh = true)
                    onSuccess()
                }
                is ApiResult.Error -> onError(res.message)
                is ApiResult.NetworkError -> onError(res.exception.localizedMessage ?: "Network connection failed")
            }
        }
    }

    fun updatePlan(id: String, req: UpdatePlanRequest, onSuccess: () -> Unit, onError: (String) -> Unit) {
        if (!permissionManager.canManageProducts()) {
            onError("Permission denied: Managing plans requires Manager or Admin role.")
            return
        }
        viewModelScope.launch {
            when (val res = repository.updatePlan(id, req)) {
                is ApiResult.Success -> {
                    loadData(isRefresh = true)
                    onSuccess()
                }
                is ApiResult.Error -> onError(res.message)
                is ApiResult.NetworkError -> onError(res.exception.localizedMessage ?: "Network connection failed")
            }
        }
    }

    fun deletePlan(id: String, onSuccess: () -> Unit, onError: (String) -> Unit) {
        if (!permissionManager.canManageProducts()) {
            onError("Permission denied: Managing plans requires Manager or Admin role.")
            return
        }
        viewModelScope.launch {
            when (val res = repository.deletePlan(id)) {
                is ApiResult.Success -> {
                    loadData(isRefresh = true)
                    onSuccess()
                }
                is ApiResult.Error -> onError(res.message)
                is ApiResult.NetworkError -> onError(res.exception.localizedMessage ?: "Network connection failed")
            }
        }
    }

    fun createServiceAccount(req: CreateServiceAccountRequest, onSuccess: () -> Unit, onError: (String) -> Unit) {
        if (!permissionManager.canManageInventory()) {
            onError("Permission denied: Managing inventory requires Manager or Admin role.")
            return
        }
        viewModelScope.launch {
            when (val res = repository.createServiceAccount(req)) {
                is ApiResult.Success -> {
                    loadData(isRefresh = true)
                    onSuccess()
                }
                is ApiResult.Error -> onError(res.message)
                is ApiResult.NetworkError -> onError(res.exception.localizedMessage ?: "Network connection failed")
            }
        }
    }

    fun updateServiceAccount(id: String, req: UpdateServiceAccountRequest, onSuccess: () -> Unit, onError: (String) -> Unit) {
        if (!permissionManager.canManageInventory()) {
            onError("Permission denied: Managing inventory requires Manager or Admin role.")
            return
        }
        viewModelScope.launch {
            when (val res = repository.updateServiceAccount(id, req)) {
                is ApiResult.Success -> {
                    loadData(isRefresh = true)
                    onSuccess()
                }
                is ApiResult.Error -> onError(res.message)
                is ApiResult.NetworkError -> onError(res.exception.localizedMessage ?: "Network connection failed")
            }
        }
    }

    fun deleteServiceAccount(id: String, onSuccess: () -> Unit, onError: (String) -> Unit) {
        if (!permissionManager.canManageInventory()) {
            onError("Permission denied: Managing inventory requires Manager or Admin role.")
            return
        }
        viewModelScope.launch {
            when (val res = repository.deleteServiceAccount(id)) {
                is ApiResult.Success -> {
                    loadData(isRefresh = true)
                    onSuccess()
                }
                is ApiResult.Error -> onError(res.message)
                is ApiResult.NetworkError -> onError(res.exception.localizedMessage ?: "Network connection failed")
            }
        }
    }

    fun updateServiceProfile(id: String, accountId: String, req: UpdateServiceProfileRequest, onSuccess: () -> Unit, onError: (String) -> Unit) {
        if (!permissionManager.canManageInventory()) {
            onError("Permission denied: Managing inventory requires Manager or Admin role.")
            return
        }
        viewModelScope.launch {
            when (val res = repository.updateServiceProfile(id, req)) {
                is ApiResult.Success -> {
                    val profRes = repository.getAccountProfiles(accountId)
                    if (profRes is ApiResult.Success) {
                        val state = _uiState.value as? InventoryUiState.Success
                        if (state != null) {
                            val updated = state.accountProfiles.toMutableMap()
                            updated[accountId] = profRes.data.profiles
                            _uiState.value = state.copy(accountProfiles = updated)
                        }
                    }
                    onSuccess()
                }
                is ApiResult.Error -> onError(res.message)
                is ApiResult.NetworkError -> onError(res.exception.localizedMessage ?: "Network connection failed")
            }
        }
    }

    fun addLicenseKeys(req: AddLicensesRequest, onSuccess: (AddLicensesResponse) -> Unit, onError: (String) -> Unit) {
        if (!permissionManager.canManageInventory()) {
            onError("Permission denied: Managing inventory requires Manager or Admin role.")
            return
        }
        viewModelScope.launch {
            when (val res = repository.addLicenses(req)) {
                is ApiResult.Success -> {
                    loadData(isRefresh = true)
                    onSuccess(res.data)
                }
                is ApiResult.Error -> onError(res.message)
                is ApiResult.NetworkError -> onError(res.exception.localizedMessage ?: "Network connection failed")
            }
        }
    }

    fun deleteLicenseKey(id: String, onSuccess: () -> Unit, onError: (String) -> Unit) {
        if (!permissionManager.canManageInventory()) {
            onError("Permission denied: Managing inventory requires Manager or Admin role.")
            return
        }
        viewModelScope.launch {
            when (val res = repository.deleteLicense(id)) {
                is ApiResult.Success -> {
                    loadData(isRefresh = true)
                    onSuccess()
                }
                is ApiResult.Error -> onError(res.message)
                is ApiResult.NetworkError -> onError(res.exception.localizedMessage ?: "Network connection failed")
            }
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
        val target = secureStorage.getPreferredCurrency()
        return com.vectis.erp.core.currency.CurrencyFormatter.formatWithConversion(amount, fromCode = "USD", toCode = target)
    }

    class Factory(
        private val repository: ProductInventoryRepository,
        private val secureStorage: SecureStorage,
        private val permissionManager: PermissionManager,
        private val authRepository: com.vectis.erp.domain.repository.AuthRepository? = null
    ) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            return InventoryViewModel(repository, secureStorage, permissionManager, authRepository) as T
        }
    }
}
