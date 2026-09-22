package com.vectis.erp.feature.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.vectis.erp.core.authorization.PermissionManager
import com.vectis.erp.core.authorization.UserRole
import com.vectis.erp.core.network.ApiResult
import com.vectis.erp.core.security.SecureStorage
import com.vectis.erp.data.model.*
import com.vectis.erp.domain.repository.SettingsRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class SettingsViewModel(
    private val repository: SettingsRepository,
    val secureStorage: SecureStorage,
    val permissionManager: PermissionManager = PermissionManager(secureStorage)
) : ViewModel() {

    private val _uiState = MutableStateFlow<SettingsUiState>(SettingsUiState.Loading)
    val uiState: StateFlow<SettingsUiState> = _uiState.asStateFlow()

    init {
        loadSettings()
    }

    fun selectTab(tab: SettingsTab) {
        val current = _uiState.value
        if (current is SettingsUiState.Success) {
            _uiState.value = current.copy(activeTab = tab)
            if (tab == SettingsTab.TEAM && current.teamUsers.isEmpty()) {
                loadTeamUsers()
            } else if (tab == SettingsTab.AUDIT && current.auditLogs.isEmpty()) {
                loadAuditLogs(1)
            }
        }
    }

    fun loadSettings(isRefresh: Boolean = false) {
        viewModelScope.launch {
            val current = _uiState.value
            if (!isRefresh && current !is SettingsUiState.Success) {
                _uiState.value = SettingsUiState.Loading
            } else if (isRefresh && current is SettingsUiState.Success) {
                _uiState.value = current.copy(isRefreshing = true)
            }

            val meResult = repository.getMe()
            val healthResult = repository.getHealth()
            val sysResult = repository.getSettings()
            val currenciesResult = repository.getCurrencies()

            val availableCurrencies = when (currenciesResult) {
                is ApiResult.Success -> currenciesResult.data
                else -> com.vectis.erp.core.currency.CurrencyFormatter.FALLBACK_CURRENCIES
            }

            val user = when (meResult) {
                is ApiResult.Success -> meResult.data
                else -> UserDto(
                    id = secureStorage.getUserId() ?: "",
                    username = secureStorage.getUserName() ?: "User",
                    email = "",
                    name = secureStorage.getUserName() ?: "User",
                    role = secureStorage.getUserRole() ?: "agent",
                    preferredCurrency = secureStorage.getPreferredCurrency()
                )
            }

            val health = (healthResult as? ApiResult.Success)?.data
            val isOnline = healthResult is ApiResult.Success
            val uptime = health?.uptimeSeconds ?: 0L
            val companyName = ((sysResult as? ApiResult.Success)?.data?.get("company_name") as? String) ?: "Vectis ERP"

            val activeTab = if (current is SettingsUiState.Success) current.activeTab else SettingsTab.GENERAL
            val teamUsers = if (current is SettingsUiState.Success) current.teamUsers else emptyList()
            val auditLogs = if (current is SettingsUiState.Success) current.auditLogs else emptyList()
            val auditPage = if (current is SettingsUiState.Success) current.auditPage else 1
            val auditTotal = if (current is SettingsUiState.Success) current.auditTotal else 0
            val auditTotalPages = if (current is SettingsUiState.Success) current.auditTotalPages else 1

            _uiState.value = SettingsUiState.Success(
                activeTab = activeTab,
                user = user,
                preferredCurrency = secureStorage.getPreferredCurrency(),
                availableCurrencies = availableCurrencies,
                serverUrl = secureStorage.getServerUrl(),
                deviceId = secureStorage.getDeviceId() ?: "Not paired",
                isServerOnline = isOnline,
                serverUptime = uptime,
                companyName = companyName,
                health = health,
                teamUsers = teamUsers,
                auditLogs = auditLogs,
                auditPage = auditPage,
                auditTotal = auditTotal,
                auditTotalPages = auditTotalPages,
                isRefreshing = false
            )

            if (activeTab == SettingsTab.TEAM) {
                loadTeamUsers()
            } else if (activeTab == SettingsTab.AUDIT) {
                loadAuditLogs(auditPage)
            }
        }
    }

    fun updatePreferredCurrency(currency: String) {
        val curr = currency.uppercase()
        secureStorage.setPreferredCurrency(curr)
        viewModelScope.launch {
            repository.updateCurrency(curr)
            loadSettings(isRefresh = true)
        }
    }

    fun updateServerUrl(newUrl: String) {
        val cleanUrl = newUrl.trimEnd('/')
        secureStorage.setServerUrl(cleanUrl)
        loadSettings(isRefresh = true)
    }

    fun changePassword(current: String, newPw: String, onSuccess: () -> Unit, onError: (String) -> Unit) {
        viewModelScope.launch {
            when (val res = repository.changePassword(current, newPw)) {
                is ApiResult.Success -> onSuccess()
                is ApiResult.Error -> onError(res.message)
                is ApiResult.NetworkError -> onError(res.exception.localizedMessage ?: "Network connection failed")
            }
        }
    }

    fun loadTeamUsers() {
        if (!permissionManager.canManageDevices() && permissionManager.currentUserRole != UserRole.ADMIN && permissionManager.currentUserRole != UserRole.OWNER) {
            return
        }
        viewModelScope.launch {
            when (val res = repository.getUsers()) {
                is ApiResult.Success -> {
                    val state = _uiState.value as? SettingsUiState.Success ?: return@launch
                    _uiState.value = state.copy(teamUsers = res.data.users)
                }
                else -> {}
            }
        }
    }

    fun createUser(req: CreateUserRequest, onSuccess: () -> Unit, onError: (String) -> Unit) {
        viewModelScope.launch {
            when (val res = repository.createUser(req)) {
                is ApiResult.Success -> {
                    loadTeamUsers()
                    onSuccess()
                }
                is ApiResult.Error -> onError(res.message)
                is ApiResult.NetworkError -> onError(res.exception.localizedMessage ?: "Network connection failed")
            }
        }
    }

    fun deleteUser(id: String, onSuccess: () -> Unit, onError: (String) -> Unit) {
        viewModelScope.launch {
            when (val res = repository.deleteUser(id)) {
                is ApiResult.Success -> {
                    loadTeamUsers()
                    onSuccess()
                }
                is ApiResult.Error -> onError(res.message)
                is ApiResult.NetworkError -> onError(res.exception.localizedMessage ?: "Network connection failed")
            }
        }
    }

    fun loadAuditLogs(page: Int = 1) {
        if (!permissionManager.canViewAuditLogs()) return
        viewModelScope.launch {
            when (val res = repository.getAuditLogs(page = page, limit = 30)) {
                is ApiResult.Success -> {
                    val state = _uiState.value as? SettingsUiState.Success ?: return@launch
                    _uiState.value = state.copy(
                        auditLogs = res.data.logs,
                        auditPage = res.data.page,
                        auditTotalPages = res.data.totalPages,
                        auditTotal = res.data.total
                    )
                }
                else -> {}
            }
        }
    }

    fun logout(onSuccess: () -> Unit) {
        viewModelScope.launch {
            repository.logout()
            secureStorage.clearSession()
            onSuccess()
        }
    }

    fun unpairDevice(onSuccess: () -> Unit) {
        viewModelScope.launch {
            val deviceId = secureStorage.getDeviceId()
            if (!deviceId.isNullOrBlank()) {
                repository.unpairDevice(deviceId)
            }
            secureStorage.clearDevicePairing()
            secureStorage.clearSession()
            onSuccess()
        }
    }

    class Factory(
        private val repository: SettingsRepository,
        private val secureStorage: SecureStorage,
        private val permissionManager: PermissionManager? = null
    ) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            return SettingsViewModel(
                repository = repository,
                secureStorage = secureStorage,
                permissionManager = permissionManager ?: PermissionManager(secureStorage)
            ) as T
        }
    }
}
