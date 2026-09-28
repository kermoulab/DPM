package com.vectis.erp.feature.alerts

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.vectis.erp.core.network.ApiResult
import com.vectis.erp.core.security.SecureStorage
import com.vectis.erp.data.model.*
import com.vectis.erp.domain.repository.AlertRepository
import com.vectis.erp.domain.repository.OrderRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale
import java.util.TimeZone

class AlertsViewModel(
    private val repository: AlertRepository,
    private val orderRepository: OrderRepository,
    private val secureStorage: SecureStorage
) : ViewModel() {

    private val _uiState = MutableStateFlow<AlertsUiState>(AlertsUiState.Loading)
    val uiState: StateFlow<AlertsUiState> = _uiState.asStateFlow()

    private var currentLanguage: String = "en"
    private var currentFilter: AlertsFilter = AlertsFilter.EXPIRING

    init {
        if (secureStorage.isAuthenticated()) {
            loadAlerts()
        }
    }

    fun loadAlerts(isRefresh: Boolean = false) {
        viewModelScope.launch {
            val current = _uiState.value
            if (!isRefresh && current !is AlertsUiState.Success) {
                _uiState.value = AlertsUiState.Loading
            } else if (isRefresh && current is AlertsUiState.Success) {
                _uiState.value = current.copy(isRefreshing = true)
            }

            val templates = if (current is AlertsUiState.Success && current.templates.isNotEmpty()) {
                current.templates
            } else {
                BuiltInWhatsAppTemplates.ALL
            }
            val existingContacted = if (current is AlertsUiState.Success) current.contactedOrderIds else emptySet()

            when (val result = repository.getAlerts()) {
                is ApiResult.Success -> {
                    val serverContacted = (result.data.expiringOrders + result.data.expiredOrders)
                        .filter { isAlertContactedFromServer(it) }
                        .map { it.id }
                        .toSet()

                    _uiState.value = AlertsUiState.Success(
                        activeFilter = currentFilter,
                        selectedLanguage = currentLanguage,
                        badgeCount = result.data.badgeCount,
                        expiringOrders = result.data.expiringOrders,
                        expiredOrders = result.data.expiredOrders,
                        lowStockAccounts = result.data.lowStockAccounts,
                        lowInventory = result.data.lowInventory,
                        templates = templates,
                        isRefreshing = false,
                        renewingOrderId = (current as? AlertsUiState.Success)?.renewingOrderId,
                        renewalFeedback = (current as? AlertsUiState.Success)?.renewalFeedback,
                        contactedOrderIds = existingContacted + serverContacted
                    )
                    loadTemplates()
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
                    _uiState.value = current.copy(
                        templates = BuiltInWhatsAppTemplates.mergeWithServer(result.data.templates)
                    )
                }
                else -> {
                    val current = _uiState.value as? AlertsUiState.Success ?: return@launch
                    if (current.templates.isEmpty()) {
                        _uiState.value = current.copy(templates = BuiltInWhatsAppTemplates.ALL)
                    }
                }
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
            val ensureTemplates = if (current.templates.isEmpty()) BuiltInWhatsAppTemplates.ALL else current.templates
            _uiState.value = current.copy(activeFilter = filter, templates = ensureTemplates)
            if (filter == AlertsFilter.TEMPLATES) {
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

    fun computeProjectedRenewal(order: AlertOrderDto): RenewalFeedback {
        val sdf = SimpleDateFormat("yyyy-MM-dd", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }
        val todayStr = sdf.format(java.util.Date())
        val cleanEnd = order.endDate?.take(10) ?: todayStr
        val isExpired = cleanEnd < todayStr
        val startDateStr = if (isExpired) todayStr else cleanEnd

        val cal = Calendar.getInstance(TimeZone.getTimeZone("UTC"))
        try {
            val parsed = sdf.parse(startDateStr)
            if (parsed != null) cal.time = parsed
        } catch (_: Exception) {}

        val duration = if (order.duration > 0) order.duration else 1
        when (order.durationUnit.lowercase()) {
            "hours" -> cal.add(Calendar.HOUR_OF_DAY, duration)
            "days" -> cal.add(Calendar.DAY_OF_MONTH, duration)
            "weeks" -> cal.add(Calendar.DAY_OF_MONTH, duration * 7)
            "months" -> cal.add(Calendar.MONTH, duration)
            "years" -> cal.add(Calendar.YEAR, duration)
            else -> cal.add(Calendar.DAY_OF_MONTH, duration)
        }
        val newEndDateStr = sdf.format(cal.time)

        return RenewalFeedback(
            orderNumber = order.orderNumber,
            startDate = startDateStr,
            newEndDate = newEndDateStr,
            previousEndDate = order.endDate?.take(10),
            duration = duration,
            durationUnit = order.durationUnit
        )
    }

    fun renewOrder(order: AlertOrderDto, onError: (String) -> Unit = {}) {
        val current = _uiState.value as? AlertsUiState.Success ?: return
        if (current.renewingOrderId != null) return

        _uiState.value = current.copy(renewingOrderId = order.id)
        viewModelScope.launch {
            val req = RenewOrderRequest(extendFrom = "end_date", customPrice = null)
            when (val res = orderRepository.renewOrder(order.id, req)) {
                is ApiResult.Success -> {
                    val proj = computeProjectedRenewal(order)
                    loadAlerts(isRefresh = true)
                    val updated = _uiState.value as? AlertsUiState.Success
                    if (updated != null) {
                        _uiState.value = updated.copy(
                            renewingOrderId = null,
                            renewalFeedback = proj
                        )
                    }
                }
                is ApiResult.Error -> {
                    val cur = _uiState.value as? AlertsUiState.Success
                    if (cur != null) _uiState.value = cur.copy(renewingOrderId = null)
                    onError(res.message)
                }
                is ApiResult.NetworkError -> {
                    val cur = _uiState.value as? AlertsUiState.Success
                    if (cur != null) _uiState.value = cur.copy(renewingOrderId = null)
                    onError(res.exception.localizedMessage ?: "Network error")
                }
            }
        }
    }

    fun dismissRenewalFeedback() {
        val current = _uiState.value as? AlertsUiState.Success ?: return
        _uiState.value = current.copy(renewalFeedback = null)
    }

    fun sendWhatsAppAlert(
        context: Context,
        order: AlertOrderDto,
        eventType: String,
        customPhone: String? = null,
        savePhone: Boolean = false,
        onSuccess: (() -> Unit)? = null,
        onError: (String) -> Unit
    ) {
        val phoneToSend = customPhone?.trim()?.ifBlank { null } ?: order.customerWhatsapp
        viewModelScope.launch {
            val req = ComposeWhatsAppRequest(
                orderId = order.id,
                language = currentLanguage,
                eventType = eventType,
                phone = phoneToSend,
                savePhone = if (savePhone) true else null
            )
            when (val result = repository.composeWhatsApp(req)) {
                is ApiResult.Success -> {
                    val url = result.data.finalUrl
                    if (url.isNullOrBlank()) {
                        onError("Unable to generate WhatsApp link. Please verify customer phone number.")
                        return@launch
                    }
                    val markContacted = {
                        val current = _uiState.value as? AlertsUiState.Success
                        if (current != null) {
                            _uiState.value = current.copy(
                                contactedOrderIds = current.contactedOrderIds + order.id
                            )
                        }
                    }
                    try {
                        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
                            flags = Intent.FLAG_ACTIVITY_NEW_TASK
                        }
                        context.startActivity(intent)
                        markContacted()
                        onSuccess?.invoke()
                    } catch (e: Exception) {
                        try {
                            val browserIntent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
                                flags = Intent.FLAG_ACTIVITY_NEW_TASK
                            }
                            context.startActivity(browserIntent)
                            markContacted()
                            onSuccess?.invoke()
                        } catch (e2: Exception) {
                            onError("Could not open WhatsApp: ${e2.localizedMessage ?: "No compatible application found"}")
                        }
                    }
                }
                is ApiResult.Error -> onError(result.message)
                is ApiResult.NetworkError -> onError(result.exception.localizedMessage ?: "Network connection error")
            }
        }
    }

    fun formatCurrency(amount: Double): String {
        val target = secureStorage.getPreferredCurrency()
        return com.vectis.erp.core.currency.CurrencyFormatter.formatWithConversion(amount, fromCode = "USD", toCode = target)
    }

    class Factory(
        private val repository: AlertRepository,
        private val orderRepository: OrderRepository,
        private val secureStorage: SecureStorage
    ) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            return AlertsViewModel(repository, orderRepository, secureStorage) as T
        }
    }
}
