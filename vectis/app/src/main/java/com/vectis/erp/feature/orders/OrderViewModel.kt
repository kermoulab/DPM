package com.vectis.erp.feature.orders

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
import com.vectis.erp.domain.repository.OrderRepository
import com.vectis.erp.domain.repository.ProductInventoryRepository
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.*

class OrderViewModel(
    private val orderRepository: OrderRepository,
    private val customerRepository: CustomerRepository,
    private val productRepository: ProductInventoryRepository,
    private val secureStorage: SecureStorage,
    val permissionManager: PermissionManager
) : ViewModel() {

    private val _listUiState = MutableStateFlow<OrderListUiState>(OrderListUiState.Loading)
    val listUiState: StateFlow<OrderListUiState> = _listUiState.asStateFlow()

    private val _detailUiState = MutableStateFlow<OrderDetailUiState>(OrderDetailUiState.Loading)
    val detailUiState: StateFlow<OrderDetailUiState> = _detailUiState.asStateFlow()

    private val _wizardState = MutableStateFlow(CreateOrderWizardState())
    val wizardState: StateFlow<CreateOrderWizardState> = _wizardState.asStateFlow()

    private var currentStatusFilter: String? = null
    private var currentSearchQuery: String = ""
    private var searchJob: Job? = null

    init {
        loadOrders()
    }

    fun loadOrders(isRefresh: Boolean = false) {
        viewModelScope.launch {
            val current = _listUiState.value
            if (!isRefresh && current !is OrderListUiState.Success) {
                _listUiState.value = OrderListUiState.Loading
            } else if (isRefresh && current is OrderListUiState.Success) {
                _listUiState.value = current.copy(isRefreshing = true)
            }

            when (val result = orderRepository.getOrders(
                status = currentStatusFilter,
                search = currentSearchQuery.ifBlank { null }
            )) {
                is ApiResult.Success -> {
                    _listUiState.value = OrderListUiState.Success(
                        orders = result.data.orders,
                        counts = result.data.counts ?: emptyMap(),
                        selectedStatus = currentStatusFilter,
                        searchQuery = currentSearchQuery,
                        isRefreshing = false
                    )
                }
                is ApiResult.Error -> {
                    _listUiState.value = OrderListUiState.Error(result.message)
                }
                is ApiResult.NetworkError -> {
                    _listUiState.value = OrderListUiState.Error(result.exception.localizedMessage ?: "Network error occurred")
                }
            }
        }
    }

    fun onStatusFilterChanged(status: String?) {
        currentStatusFilter = status
        loadOrders(isRefresh = false)
    }

    fun onSearchQueryChanged(query: String) {
        currentSearchQuery = query
        searchJob?.cancel()
        searchJob = viewModelScope.launch {
            delay(350)
            loadOrders(isRefresh = false)
        }
    }

    fun loadOrderDetail(id: String) {
        viewModelScope.launch {
            _detailUiState.value = OrderDetailUiState.Loading
            when (val result = orderRepository.getOrderDetail(id)) {
                is ApiResult.Success -> {
                    _detailUiState.value = OrderDetailUiState.Success(
                        order = result.data.order,
                        renewals = result.data.renewals
                    )
                }
                is ApiResult.Error -> {
                    _detailUiState.value = OrderDetailUiState.Error(result.message)
                }
                is ApiResult.NetworkError -> {
                    _detailUiState.value = OrderDetailUiState.Error(result.exception.localizedMessage ?: "Network error occurred")
                }
            }
        }
    }

    fun renewOrder(
        id: String,
        extendFrom: String,
        customPrice: Double?,
        onSuccess: () -> Unit,
        onError: (String) -> Unit
    ) {
        if (!permissionManager.canRenewOrder()) {
            onError("Permission denied: You cannot renew orders.")
            return
        }

        viewModelScope.launch {
            val req = RenewOrderRequest(extendFrom = extendFrom, customPrice = customPrice)
            when (val result = orderRepository.renewOrder(id, req)) {
                is ApiResult.Success -> {
                    loadOrders(isRefresh = true)
                    loadOrderDetail(id)
                    onSuccess()
                }
                is ApiResult.Error -> onError(result.message)
                is ApiResult.NetworkError -> onError(result.exception.localizedMessage ?: "Network error")
            }
        }
    }

    fun cancelOrder(
        id: String,
        reason: String?,
        onSuccess: () -> Unit,
        onError: (String) -> Unit
    ) {
        if (!permissionManager.canEditOrder()) {
            onError("Permission denied: You cannot cancel orders.")
            return
        }

        viewModelScope.launch {
            val req = CancelOrderRequest(reason = reason)
            when (val result = orderRepository.cancelOrder(id, req)) {
                is ApiResult.Success -> {
                    loadOrders(isRefresh = true)
                    loadOrderDetail(id)
                    onSuccess()
                }
                is ApiResult.Error -> onError(result.message)
                is ApiResult.NetworkError -> onError(result.exception.localizedMessage ?: "Network error")
            }
        }
    }

    fun deleteOrder(
        id: String,
        onSuccess: () -> Unit,
        onError: (String) -> Unit
    ) {
        if (!permissionManager.canDeleteOrder()) {
            onError("Permission denied: Only Admins can delete orders.")
            return
        }

        viewModelScope.launch {
            when (val result = orderRepository.deleteOrder(id)) {
                is ApiResult.Success -> {
                    loadOrders(isRefresh = true)
                    onSuccess()
                }
                is ApiResult.Error -> onError(result.message)
                is ApiResult.NetworkError -> onError(result.exception.localizedMessage ?: "Network error")
            }
        }
    }

    // --- Dynamic Universal Order Wizard ---

    fun initCreateOrderWizard() {
        val today = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
        _wizardState.value = CreateOrderWizardState(isLoading = true, startDate = today)
        viewModelScope.launch {
            val custResult = customerRepository.getCustomers(status = "active")
            val prodResult = productRepository.getProducts(status = "active")

            val customers = if (custResult is ApiResult.Success) custResult.data.customers else emptyList()
            val products = if (prodResult is ApiResult.Success) prodResult.data.products else emptyList()

            _wizardState.value = _wizardState.value.copy(
                customers = customers,
                products = products,
                isLoading = false
            )
        }
    }

    fun selectWizardCustomer(customer: CustomerDto) {
        _wizardState.value = _wizardState.value.copy(selectedCustomer = customer)
    }

    fun selectWizardProduct(product: ProductDto) {
        _wizardState.value = _wizardState.value.copy(
            selectedProduct = product,
            selectedPlan = null,
            plans = emptyList(),
            customPrice = ""
        )
        // Dynamically fetch plans for the selected product
        viewModelScope.launch {
            when (val res = productRepository.getPlans(product.id)) {
                is ApiResult.Success -> {
                    _wizardState.value = _wizardState.value.copy(plans = res.data.plans)
                }
                else -> {}
            }
        }
    }

    fun selectWizardPlan(plan: PlanDto) {
        val startDateStr = _wizardState.value.startDate
        val endDateStr = calculateEndDateLocally(startDateStr, plan.duration, plan.durationUnit)
        _wizardState.value = _wizardState.value.copy(
            selectedPlan = plan,
            customPrice = plan.price.toString(),
            endDate = endDateStr
        )
    }

    fun setWizardStartDate(date: String) {
        val plan = _wizardState.value.selectedPlan
        val endDate = if (plan != null) calculateEndDateLocally(date, plan.duration, plan.durationUnit) else ""
        _wizardState.value = _wizardState.value.copy(startDate = date, endDate = endDate)
    }

    fun setWizardCustomPrice(price: String) {
        _wizardState.value = _wizardState.value.copy(customPrice = price)
    }

    fun setWizardPaymentMethod(method: String) {
        _wizardState.value = _wizardState.value.copy(paymentMethod = method)
    }

    fun setWizardNotes(notes: String) {
        _wizardState.value = _wizardState.value.copy(notes = notes)
    }

    fun submitCreateOrder(onSuccess: (String) -> Unit, onError: (String) -> Unit) {
        val state = _wizardState.value
        val customer = state.selectedCustomer
        val product = state.selectedProduct
        val plan = state.selectedPlan

        if (customer == null) {
            onError("Please select a customer.")
            return
        }
        if (product == null) {
            onError("Please select a product.")
            return
        }
        if (plan == null) {
            onError("Please select a pricing plan.")
            return
        }

        val price = state.customPrice.toDoubleOrNull() ?: plan.price

        viewModelScope.launch {
            _wizardState.value = state.copy(isSubmitting = true)
            val req = CreateOrderRequest(
                customerId = customer.id,
                productId = product.id,
                planId = plan.id,
                startDate = state.startDate.ifBlank { null },
                customPrice = price,
                paymentMethod = state.paymentMethod,
                paymentStatus = state.paymentStatus,
                notes = state.notes.ifBlank { null }
            )

            when (val result = orderRepository.createOrder(req)) {
                is ApiResult.Success -> {
                    _wizardState.value = state.copy(isSubmitting = false)
                    loadOrders(isRefresh = true)
                    val newOrderId = result.data.order?.id ?: ""
                    onSuccess(newOrderId)
                }
                is ApiResult.Error -> {
                    _wizardState.value = state.copy(isSubmitting = false)
                    onError(result.message)
                }
                is ApiResult.NetworkError -> {
                    _wizardState.value = state.copy(isSubmitting = false)
                    onError(result.exception.localizedMessage ?: "Network error")
                }
            }
        }
    }

    private fun calculateEndDateLocally(startDateStr: String, duration: Int, unit: String): String {
        return try {
            val sdf = SimpleDateFormat("yyyy-MM-dd", Locale.US)
            val cal = Calendar.getInstance()
            cal.time = sdf.parse(startDateStr) ?: Date()
            when (unit.lowercase()) {
                "days" -> cal.add(Calendar.DAY_OF_YEAR, duration)
                "weeks" -> cal.add(Calendar.WEEK_OF_YEAR, duration)
                "months" -> cal.add(Calendar.MONTH, duration)
                "years" -> cal.add(Calendar.YEAR, duration)
                else -> cal.add(Calendar.MONTH, duration)
            }
            sdf.format(cal.time)
        } catch (e: Exception) {
            ""
        }
    }

    fun sendWhatsAppReceipt(context: Context, order: OrderDto) {
        val phone = sanitizeWhatsAppPhone(order.customerWhatsapp) ?: return
        val digitsOnly = phone.removePrefix("+")

        val sb = StringBuilder()
        sb.append("👋 Hello ${order.customerName ?: "Valued Customer"},\n\n")
        sb.append("📦 *Order Receipt: ${order.orderNumber}*\n")
        sb.append("• *Product:* ${order.productName ?: "Service"}\n")
        sb.append("• *Plan:* ${order.planName ?: ""}\n")
        sb.append("• *Price:* ${formatCurrency(order.price)}\n")
        if (!order.startDate.isNullOrBlank()) sb.append("• *Start Date:* ${order.startDate}\n")
        if (!order.endDate.isNullOrBlank()) sb.append("• *Valid Until:* ${order.endDate}\n")

        // Dynamic Fulfillment details
        if (order.isServiceAccount && !order.accountLogin.isNullOrBlank()) {
            sb.append("\n🔐 *Access Credentials:*\n")
            sb.append("• *Login:* `${order.accountLogin}`\n")
            if (!order.profileName.isNullOrBlank()) sb.append("• *Profile:* ${order.profileName}\n")
            if (!order.profilePin.isNullOrBlank()) sb.append("• *PIN:* ${order.profilePin}\n")
        } else if (order.isLicenseKey && !order.licenseKeyString.isNullOrBlank()) {
            sb.append("\n🔑 *License Key:*\n")
            sb.append("`${order.licenseKeyString}`\n")
        }

        sb.append("\nThank you for choosing Vectis ERP!")

        val encodedMessage = Uri.encode(sb.toString())
        val url = "https://wa.me/$digitsOnly?text=$encodedMessage"
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
        private val orderRepository: OrderRepository,
        private val customerRepository: CustomerRepository,
        private val productRepository: ProductInventoryRepository,
        private val secureStorage: SecureStorage,
        private val permissionManager: PermissionManager
    ) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            return OrderViewModel(
                orderRepository,
                customerRepository,
                productRepository,
                secureStorage,
                permissionManager
            ) as T
        }
    }
}
