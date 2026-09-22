package com.vectis.erp.feature.alerts

import com.vectis.erp.data.model.*

enum class AlertsFilter(val title: String) {
    EXPIRING("Expiring Soon"),
    EXPIRED("Expired"),
    LOW_STOCK("Low Stock"),
    TEMPLATES("Templates")
}

sealed interface AlertsUiState {
    data object Loading : AlertsUiState
    data class Success(
        val activeFilter: AlertsFilter = AlertsFilter.EXPIRING,
        val selectedLanguage: String = "en",
        val badgeCount: Int = 0,
        val expiringOrders: List<AlertOrderDto> = emptyList(),
        val expiredOrders: List<AlertOrderDto> = emptyList(),
        val lowStockAccounts: List<LowStockAccountDto> = emptyList(),
        val lowInventory: List<LowInventoryDto> = emptyList(),
        val templates: List<WhatsAppTemplateDto> = emptyList(),
        val isRefreshing: Boolean = false,
        val isSendingWhatsApp: Boolean = false
    ) : AlertsUiState
    data class Error(val message: String) : AlertsUiState
}
