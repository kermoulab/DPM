package com.vectis.erp.feature.alerts

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.vectis.erp.core.network.ApiResult
import com.vectis.erp.core.security.SecureStorage
import com.vectis.erp.data.model.AlertOrderDto
import com.vectis.erp.data.model.ComposeWhatsAppRequest
import com.vectis.erp.data.model.UpsertTemplateRequest
import com.vectis.erp.data.model.WhatsAppTemplateDto
import com.vectis.erp.domain.repository.AlertRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.text.NumberFormat
import java.util.Locale

class AlertsViewModel(
    private val repository: AlertRepository,
    private val secureStorage: SecureStorage
) : ViewModel() {

    private val _uiState = MutableStateFlow<AlertsUiState>(AlertsUiState.Loading)
    val uiState: StateFlow<AlertsUiState> = _uiState.asStateFlow()

    private var currentLanguage: String = "en"
    private var currentFilter: AlertsFilter = AlertsFilter.EXPIRING

    init {
        loadAlerts()
    }

    fun loadAlerts(isRefresh: Boolean = false) {
        viewModelScope.launch {
            val current = _uiState.value
            if (!isRefresh && current !is AlertsUiState.Success) {
                _uiState.value = AlertsUiState.Loading
            } else if (isRefresh && current is AlertsUiState.Success) {
                _uiState.value = current.copy(isRefreshing = true)
            }

            val templates = if (current is AlertsUiState.Success) current.templates else emptyList()

            when (val result = repository.getAlerts()) {
                is ApiResult.Success -> {
                    _uiState.value = AlertsUiState.Success(
                        activeFilter = currentFilter,
                        selectedLanguage = currentLanguage,
                        badgeCount = result.data.badgeCount,
                        expiringOrders = result.data.expiringOrders,
                        expiredOrders = result.data.expiredOrders,
                        lowStockAccounts = result.data.lowStockAccounts,
                        lowInventory = result.data.lowInventory,
                        templates = templates,
                        isRefreshing = false
                    )
                    if (currentFilter == AlertsFilter.TEMPLATES) {
                        loadTemplates()
                    }
                }
                is ApiResult.Error -> {
                    _uiState.value = AlertsUiState.Error(result.message)
                }
                is ApiResult.NetworkError -> {
                    _uiState.value = AlertsUiState.Error(result.exception.localizedMessage ?: "Network error occurred")
                }
            }
        }
    }

    fun loadTemplates() {
        viewModelScope.launch {
            when (val result = repository.getTemplates()) {
                is ApiResult.Success -> {
                    val current = _uiState.value as? AlertsUiState.Success ?: return@launch
                    _uiState.value = current.copy(templates = result.data.templates)
                }
                else -> {}
            }
        }
    }

    fun upsertTemplate(req: UpsertTemplateRequest, onSuccess: () -> Unit, onError: (String) -> Unit) {
        viewModelScope.launch {
            when (val res = repository.upsertTemplate(req)) {
                is ApiResult.Success -> {
                    loadTemplates()
                    onSuccess()
                }
                is ApiResult.Error -> onError(res.message)
                is ApiResult.NetworkError -> onError(res.exception.localizedMessage ?: "Network error")
            }
        }
    }

    fun deleteTemplate(id: String, onSuccess: () -> Unit, onError: (String) -> Unit) {
        viewModelScope.launch {
            when (val res = repository.deleteTemplate(id)) {
                is ApiResult.Success -> {
                    loadTemplates()
                    onSuccess()
                }
                is ApiResult.Error -> onError(res.message)
                is ApiResult.NetworkError -> onError(res.exception.localizedMessage ?: "Network error")
            }
        }
    }

    fun setFilter(filter: AlertsFilter) {
        currentFilter = filter
        val current = _uiState.value
        if (current is AlertsUiState.Success) {
            _uiState.value = current.copy(activeFilter = filter)
            if (filter == AlertsFilter.TEMPLATES && current.templates.isEmpty()) {
                loadTemplates()
            }
        }
    }

    fun setLanguage(language: String) {
        currentLanguage = language
        val current = _uiState.value
        if (current is AlertsUiState.Success) {
            _uiState.value = current.copy(selectedLanguage = language)
        }
    }

    fun sendWhatsAppAlert(
        context: Context,
        order: AlertOrderDto,
        eventType: String,
        onError: (String) -> Unit
    ) {
        viewModelScope.launch {
            val req = ComposeWhatsAppRequest(
                orderId = order.id,
                language = currentLanguage,
                eventType = eventType,
                phone = order.customerWhatsapp
            )
            when (val result = repository.composeWhatsApp(req)) {
                is ApiResult.Success -> {
                    val url = result.data.whatsappUrl
                    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK
                    }
                    try {
                        context.startActivity(intent)
                    } catch (e: Exception) {
                        val fallback = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
                            flags = Intent.FLAG_ACTIVITY_NEW_TASK
                        }
                        context.startActivity(fallback)
                    }
                }
                is ApiResult.Error -> onError(result.message)
                is ApiResult.NetworkError -> onError(result.exception.localizedMessage ?: "Network connection error")
            }
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
        private val repository: AlertRepository,
        private val secureStorage: SecureStorage
    ) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            return AlertsViewModel(repository, secureStorage) as T
        }
    }
}
