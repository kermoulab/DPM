package com.vectis.erp.feature.settings

import com.vectis.erp.data.model.*

enum class SettingsTab(val title: String) {
    GENERAL("General & Health"),
    SECURITY("Security & Password"),
    TEAM("Team Users"),
    AUDIT("Audit Trail")
}

sealed interface SettingsUiState {
    data object Loading : SettingsUiState
    data class Success(
        val activeTab: SettingsTab = SettingsTab.GENERAL,
        val user: UserDto?,
        val preferredCurrency: String,
        val serverUrl: String,
        val deviceId: String,
        val isServerOnline: Boolean,
        val serverUptime: Long = 0,
        val companyName: String = "Vectis ERP",
        val health: HealthResponse? = null,
        val teamUsers: List<UserDto> = emptyList(),
        val auditLogs: List<AuditLogDto> = emptyList(),
        val auditPage: Int = 1,
        val auditTotalPages: Int = 1,
        val auditTotal: Int = 0,
        val isRefreshing: Boolean = false
    ) : SettingsUiState
    data class Error(val message: String) : SettingsUiState
}
