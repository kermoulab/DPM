package com.vectis.erp.feature.customers

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.vectis.erp.core.authorization.PermissionManager
import com.vectis.erp.core.network.ApiResult
import com.vectis.erp.core.security.SecureStorage
import com.vectis.erp.data.model.*
import com.vectis.erp.domain.repository.CustomerRepository
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.text.NumberFormat
import java.util.Locale

class CustomerViewModel(
    private val repository: CustomerRepository,
    private val secureStorage: SecureStorage,
    val permissionManager: PermissionManager
) : ViewModel() {

    private val _listUiState = MutableStateFlow<CustomerListUiState>(CustomerListUiState.Loading)
    val listUiState: StateFlow<CustomerListUiState> = _listUiState.asStateFlow()

    private val _detailUiState = MutableStateFlow<CustomerDetailUiState>(CustomerDetailUiState.Loading)
    val detailUiState: StateFlow<CustomerDetailUiState> = _detailUiState.asStateFlow()

    private var currentSearchQuery: String = ""
    private var currentStatusFilter: String? = null
    private var searchJob: Job? = null

    init {
        loadCustomers()
    }

    fun loadCustomers(isRefresh: Boolean = false) {
        viewModelScope.launch {
            if (!isRefresh && _listUiState.value !is CustomerListUiState.Success) {
                _listUiState.value = CustomerListUiState.Loading
            } else if (isRefresh && _listUiState.value is CustomerListUiState.Success) {
                val current = _listUiState.value as CustomerListUiState.Success
                _listUiState.value = current.copy(isRefreshing = true)
            }

            when (val result = repository.getCustomers(search = currentSearchQuery.ifBlank { null }, status = currentStatusFilter)) {
                is ApiResult.Success -> {
                    _listUiState.value = CustomerListUiState.Success(
                        customers = result.data.customers,
                        searchQuery = currentSearchQuery,
                        selectedStatus = currentStatusFilter,
                        isRefreshing = false
                    )
                }
                is ApiResult.Error -> {
                    _listUiState.value = CustomerListUiState.Error(result.message)
                }
                is ApiResult.NetworkError -> {
                    _listUiState.value = CustomerListUiState.Error(result.exception.localizedMessage ?: "Network connection failed")
                }
            }
        }
    }

    fun onSearchQueryChanged(query: String) {
        currentSearchQuery = query
        searchJob?.cancel()
        searchJob = viewModelScope.launch {
            delay(350) // Debounce search
            loadCustomers(isRefresh = false)
        }
    }

    fun onStatusFilterChanged(status: String?) {
        currentStatusFilter = status
        loadCustomers(isRefresh = false)
    }

    fun loadCustomerDetail(id: String) {
        viewModelScope.launch {
            _detailUiState.value = CustomerDetailUiState.Loading
            when (val result = repository.getCustomerDetail(id)) {
                is ApiResult.Success -> {
                    _detailUiState.value = CustomerDetailUiState.Success(
                        customer = result.data.customer,
                        orders = result.data.orders
                    )
                }
                is ApiResult.Error -> {
                    _detailUiState.value = CustomerDetailUiState.Error(result.message)
                }
                is ApiResult.NetworkError -> {
                    _detailUiState.value = CustomerDetailUiState.Error(result.exception.localizedMessage ?: "Network connection failed")
                }
            }
        }
    }

    fun createCustomer(
        name: String,
        email: String?,
        whatsapp: String?,
        notes: String?,
        onSuccess: (String) -> Unit,
        onError: (String) -> Unit
    ) {
        if (!permissionManager.canCreateCustomer()) {
            onError("You do not have permission to create customers.")
            return
        }

        val sanitizedPhone = sanitizeWhatsAppPhone(whatsapp)
        viewModelScope.launch {
            val req = CreateCustomerRequest(
                name = name.trim(),
                email = email?.trim()?.ifBlank { null },
                whatsapp = sanitizedPhone,
                notes = notes?.trim()?.ifBlank { null }
            )
            when (val result = repository.createCustomer(req)) {
                is ApiResult.Success -> {
                    loadCustomers(isRefresh = true)
                    val newId = result.data.id ?: result.data.customer?.id ?: ""
                    onSuccess(newId)
                }
                is ApiResult.Error -> {
                    onError(result.message)
                }
                is ApiResult.NetworkError -> {
                    onError(result.exception.localizedMessage ?: "Network error occurred")
                }
            }
        }
    }

    fun updateCustomer(
        id: String,
        name: String?,
        email: String?,
        whatsapp: String?,
        notes: String?,
        status: String?,
        onSuccess: () -> Unit,
        onError: (String) -> Unit
    ) {
        if (!permissionManager.canEditCustomer()) {
            onError("You do not have permission to edit customers.")
            return
        }

        val sanitizedPhone = if (whatsapp != null) sanitizeWhatsAppPhone(whatsapp) else null
        viewModelScope.launch {
            val req = UpdateCustomerRequest(
                name = name?.trim()?.ifBlank { null },
                email = email?.trim()?.ifBlank { null },
                whatsapp = sanitizedPhone,
                notes = notes?.trim()?.ifBlank { null },
                status = status
            )
            when (val result = repository.updateCustomer(id, req)) {
                is ApiResult.Success -> {
                    loadCustomers(isRefresh = true)
                    loadCustomerDetail(id)
                    onSuccess()
                }
                is ApiResult.Error -> {
                    onError(result.message)
                }
                is ApiResult.NetworkError -> {
                    onError(result.exception.localizedMessage ?: "Network error occurred")
                }
            }
        }
    }

    fun deleteCustomer(
        id: String,
        onSuccess: () -> Unit,
        onError: (String) -> Unit
    ) {
        if (!permissionManager.canDeleteCustomer()) {
            onError("Only Admins and Owners can permanently delete customers.")
            return
        }

        viewModelScope.launch {
            when (val result = repository.deleteCustomer(id)) {
                is ApiResult.Success -> {
                    loadCustomers(isRefresh = true)
                    onSuccess()
                }
                is ApiResult.Error -> {
                    onError(result.message)
                }
                is ApiResult.NetworkError -> {
                    onError(result.exception.localizedMessage ?: "Network error occurred")
                }
            }
        }
    }

    fun openWhatsApp(context: Context, rawPhone: String?, customerName: String? = null) {
        val sanitized = sanitizeWhatsAppPhone(rawPhone) ?: return
        val digitsOnly = sanitized.removePrefix("+")
        val message = if (!customerName.isNullOrBlank()) {
            Uri.encode("Hello $customerName, contacting you from Vectis ERP regarding your account.")
        } else {
            ""
        }
        val url = if (message.isNotBlank()) {
            "https://wa.me/$digitsOnly?text=$message"
        } else {
            "https://wa.me/$digitsOnly"
        }
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        try {
            context.startActivity(intent)
        } catch (e: Exception) {
            val browserIntent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            context.startActivity(browserIntent)
        }
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
        private val repository: CustomerRepository,
        private val secureStorage: SecureStorage,
        private val permissionManager: PermissionManager
    ) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            return CustomerViewModel(repository, secureStorage, permissionManager) as T
        }
    }
}
