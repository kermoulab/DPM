package com.vectis.erp.feature.alerts

import com.vectis.erp.data.model.*

enum class AlertsFilter(val title: String) {
    EXPIRING("Expiring Soon"),
    EXPIRED("Expired"),
    LOW_STOCK("Low Stock"),
    TEMPLATES("Templates")
}

data class RenewalFeedback(
    val orderNumber: String,
    val startDate: String,
    val newEndDate: String,
    val previousEndDate: String? = null,
    val duration: Int = 1,
    val durationUnit: String = "months"
)

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
        val isSendingWhatsApp: Boolean = false,
        val renewingOrderId: String? = null,
        val renewalFeedback: RenewalFeedback? = null,
        val contactedOrderIds: Set<String> = emptySet()
    ) : AlertsUiState
    data class Error(val message: String) : AlertsUiState
}

/**
 * Determines whether an alert order was genuinely contacted via WhatsApp for this alert cycle:
 * - Returns false if whatsapp_contacted_at is null, blank, or placeholder string ("null", "none").
 * - Returns false if whatsapp_contacted_at was recorded before this subscription alert window (e.g. at order creation months ago).
 * - Returns true only if whatsapp_contacted_at falls within the alert window (from 8 days before endDate onwards).
 */
fun isAlertContactedFromServer(order: AlertOrderDto): Boolean {
    val contactedAt = order.whatsappContactedAt?.trim() ?: return false
    if (contactedAt.isEmpty() || contactedAt.equals("null", ignoreCase = true) || contactedAt.equals("none", ignoreCase = true)) {
        return false
    }

    val endDate = order.endDate?.trim()?.take(10) ?: return false
    return try {
        val endLocalDate = java.time.LocalDate.parse(endDate)
        val alertWindowStart = endLocalDate.minusDays(8)
        val contactedDate = contactedAt.take(10)
        val contactedLocalDate = java.time.LocalDate.parse(contactedDate)
        !contactedLocalDate.isBefore(alertWindowStart)
    } catch (_: Exception) {
        false
    }
}

