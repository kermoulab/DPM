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
    val permissionManager: PermissionManager,
    private val authRepository: com.vectis.erp.domain.repository.AuthRepository? = null
) : ViewModel() {

    private val _listUiState = MutableStateFlow<OrderListUiState>(OrderListUiState.Loading)
    val listUiState: StateFlow<OrderListUiState> = _listUiState.asStateFlow()

    private val _detailUiState = MutableStateFlow<OrderDetailUiState>(OrderDetailUiState.Loading)
    val detailUiState: StateFlow<OrderDetailUiState> = _detailUiState.asStateFlow()

    val preferredCurrency: StateFlow<String> = secureStorage.preferredCurrencyFlow

    private val _wizardState = MutableStateFlow(CreateOrderWizardState())
    val wizardState: StateFlow<CreateOrderWizardState> = _wizardState.asStateFlow()

    private var currentStatusFilter: String? = null
    private var currentSearchQuery: String = ""
    private var searchJob: Job? = null

    init {
        if (secureStorage.isAuthenticated()) {
            loadOrders()
        }
        viewModelScope.launch {
            secureStorage.preferredCurrencyFlow.collect {
                val currentList = _listUiState.value
                if (currentList is OrderListUiState.Success) {
                    _listUiState.value = OrderListUiState.Success(currentList.orders, currentList.counts)
                }
                val currentDetail = _detailUiState.value
                if (currentDetail is OrderDetailUiState.Success) {
                    _detailUiState.value = OrderDetailUiState.Success(currentDetail.order, currentDetail.renewals)
                }
            }
        }
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

    fun updateOrder(
        id: String,
        request: UpdateOrderRequest,
        onSuccess: () -> Unit,
        onError: (String) -> Unit
    ) {
        if (!permissionManager.canEditOrder()) {
            onError("Permission denied: You do not have permission to edit orders.")
            return
        }

        viewModelScope.launch {
            when (val result = orderRepository.updateOrder(id, request)) {
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

    fun quickAddCustomer(
        name: String,
        email: String,
        whatsapp: String,
        onSuccess: (CustomerDto) -> Unit,
        onError: (String) -> Unit
    ) {
        if (name.isBlank()) {
            onError("Customer name is required.")
            return
        }
        viewModelScope.launch {
            when (val res = customerRepository.createCustomer(
                com.vectis.erp.data.model.CreateCustomerRequest(
                    name = name.trim(),
                    email = email.trim().ifEmpty { null },
                    whatsapp = whatsapp.trim().ifEmpty { null }
                )
            )) {
                is ApiResult.Success -> {
                    val newCust = res.data.customer ?: CustomerDto(
                        id = res.data.id ?: java.util.UUID.randomUUID().toString(),
                        name = name.trim(),
                        email = email.trim().ifEmpty { null },
                        whatsapp = whatsapp.trim().ifEmpty { null }
                    )
                    val updated = listOf(newCust) + _wizardState.value.customers
                    _wizardState.value = _wizardState.value.copy(
                        customers = updated,
                        selectedCustomer = newCust
                    )
                    onSuccess(newCust)
                }
                is ApiResult.Error -> onError(res.message)
                is ApiResult.NetworkError -> onError(res.exception.localizedMessage ?: "Network error")
            }
        }
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
                customCost = plan.cost,
                paymentMethod = state.paymentMethod.lowercase().trim().ifBlank { "cash" },
                paymentStatus = state.paymentStatus.lowercase().trim().ifBlank { "paid" },
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

    fun calculateEndDateLocally(startDateStr: String, duration: Int, unit: String): String {
        return try {
            val cleanDate = startDateStr.split("T")[0]
            val sdf = SimpleDateFormat("yyyy-MM-dd", Locale.US).apply {
                timeZone = TimeZone.getTimeZone("UTC")
            }
            val cal = Calendar.getInstance(TimeZone.getTimeZone("UTC"))
            cal.time = sdf.parse(cleanDate) ?: Date()
            when (unit.lowercase()) {
                "hours" -> cal.add(Calendar.HOUR_OF_DAY, duration)
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

    fun calculateStatusForEndDate(endDateStr: String): String {
        if (endDateStr.isBlank()) return "active"
        val clean = endDateStr.split("T")[0]
        val sdf = SimpleDateFormat("yyyy-MM-dd", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }
        val todayStr = sdf.format(Date())
        if (clean < todayStr) return "expired"
        val cal = Calendar.getInstance(TimeZone.getTimeZone("UTC"))
        cal.add(Calendar.DAY_OF_YEAR, 7)
        val sevenDaysStr = sdf.format(cal.time)
        if (clean <= sevenDaysStr) return "expiring"
        return "active"
    }

    suspend fun fetchCustomers(): List<CustomerDto> {
        return when (val res = customerRepository.getCustomers()) {
            is ApiResult.Success -> res.data.customers
            else -> emptyList()
        }
    }

    suspend fun fetchProducts(): List<ProductDto> {
        return when (val res = productRepository.getProducts()) {
            is ApiResult.Success -> res.data.products
            else -> emptyList()
        }
    }

    suspend fun fetchPlans(productId: String): List<PlanDto> {
        return when (val res = productRepository.getPlans(productId)) {
            is ApiResult.Success -> res.data.plans
            else -> emptyList()
        }
    }

    suspend fun revealServiceAccountPassword(accountId: String): String? {
        return when (val res = productRepository.revealCredentials(accountId)) {
            is ApiResult.Success -> res.data.password
            else -> null
        }
    }

    fun buildWhatsAppReceiptText(order: OrderDto, lang: String = "en", overridePassword: String? = null): String {
        val cName = order.customerName ?: "Valued Customer"
        val oNum = order.orderNumber
        val pName = order.productName ?: "Product"
        val eDate = order.endDate ?: ""
        val lic = order.licenseKeyString ?: ""
        val login = order.accountLogin ?: ""
        val password = overridePassword ?: order.accountPassword ?: ""
        val prof = order.profileName ?: ""
        val pin = order.profilePin ?: ""

        val creds = when {
            lic.isNotBlank() -> when (lang) {
                "fr" -> "🔑 Clé de licence: $lic"
                "ar" -> "🔑 مفتاح الترخيص: $lic"
                "ru" -> "🔑 Лицензионный ключ: $lic"
                else -> "🔑 License Key: $lic"
            }
            login.isNotBlank() || password.isNotBlank() || prof.isNotBlank() -> {
                val parts = mutableListOf<String>()
                when (lang) {
                    "fr" -> {
                        if (login.isNotBlank()) parts.add("📧 Identifiant: $login")
                        if (password.isNotBlank()) parts.add("🔑 Mot de passe: $password")
                        if (prof.isNotBlank()) parts.add("👤 Profil: $prof")
                        if (pin.isNotBlank()) parts.add("🔒 Code PIN: $pin")
                    }
                    "ar" -> {
                        if (login.isNotBlank()) parts.add("📧 البريد / الحساب: $login")
                        if (password.isNotBlank()) parts.add("🔑 كلمة المرور: $password")
                        if (prof.isNotBlank()) parts.add("👤 الملف الشخصي: $prof")
                        if (pin.isNotBlank()) parts.add("🔒 رمز PIN: $pin")
                    }
                    "ru" -> {
                        if (login.isNotBlank()) parts.add("📧 Логин / Email: $login")
                        if (password.isNotBlank()) parts.add("🔑 Пароль: $password")
                        if (prof.isNotBlank()) parts.add("👤 Профиль: $prof")
                        if (pin.isNotBlank()) parts.add("🔒 PIN-код: $pin")
                    }
                    else -> {
                        if (login.isNotBlank()) parts.add("📧 Email/Login: $login")
                        if (password.isNotBlank()) parts.add("🔑 Password: $password")
                        if (prof.isNotBlank()) parts.add("👤 Profile: $prof")
                        if (pin.isNotBlank()) parts.add("🔒 PIN: $pin")
                    }
                }
                parts.joinToString("\n")
            }
            else -> ""
        }

        return when (lang) {
            "fr" -> "Merci $cName pour votre achat!\nVotre commande #$oNum pour $pName est active jusqu'au $eDate.\n\nDétails d'accès:\n$creds\n\nMerci pour votre confiance!"
            "ar" -> "شكراً لك $cName على طلبك!\nطلبك رقم #$oNum لخدمة $pName مفعّل حتى تاريخ $eDate.\n\nبيانات الدخول:\n$creds\n\nشكراً لاختيارك لنا!"
            "ru" -> "Спасибо за ваш заказ, $cName!\nВаш заказ #$oNum на $pName активен до $eDate.\n\nДанные для доступа:\n$creds\n\nСпасибо, что выбрали нас!"
            else -> "Thank you $cName for your purchase!\nYour order #$oNum for $pName is active until $eDate.\n\nAccess Details:\n$creds\n\nThank you for choosing us! If you have any questions, feel free to reach out."
        }
    }

    fun sendWhatsAppReceipt(context: Context, order: OrderDto, lang: String = "en", overridePassword: String? = null) {
        val phone = sanitizeWhatsAppPhone(order.customerWhatsapp) ?: return
        val digitsOnly = phone.removePrefix("+")
        val message = buildWhatsAppReceiptText(order, lang, overridePassword)

        val encodedMessage = Uri.encode(message)
        val url = "https://wa.me/$digitsOnly?text=$encodedMessage"
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        try {
            context.startActivity(intent)
        } catch (e: Exception) {
            try {
                val fallback = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                }
                context.startActivity(fallback)
            } catch (_: Exception) {}
        }
    }

    fun formatCurrency(amount: Double): String {
        val target = secureStorage.getPreferredCurrency()
        return com.vectis.erp.core.currency.CurrencyFormatter.formatWithConversion(amount, fromCode = "USD", toCode = target)
    }

    class Factory(
        private val orderRepository: OrderRepository,
        private val customerRepository: CustomerRepository,
        private val productRepository: ProductInventoryRepository,
        private val secureStorage: SecureStorage,
        private val permissionManager: PermissionManager,
        private val authRepository: com.vectis.erp.domain.repository.AuthRepository? = null
    ) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            return OrderViewModel(
                orderRepository,
                customerRepository,
                productRepository,
                secureStorage,
                permissionManager,
                authRepository
            ) as T
        }
    }
}
