package com.vectis.erp.data.model

import com.google.gson.annotations.SerializedName

data class AlertOrderDto(
    @SerializedName("id") val id: String,
    @SerializedName("order_number") val orderNumber: String,
    @SerializedName("customer_id") val customerId: String,
    @SerializedName("customer_name") val customerName: String? = null,
    @SerializedName("customer_whatsapp") val customerWhatsapp: String? = null,
    @SerializedName("customer_email") val customerEmail: String? = null,
    @SerializedName("product_id") val productId: String,
    @SerializedName("product_name") val productName: String? = null,
    @SerializedName("plan_name") val planName: String? = null,
    @SerializedName("price") val price: Double = 0.0,
    @SerializedName("status") val status: String,
    @SerializedName("start_date") val startDate: String? = null,
    @SerializedName("end_date") val endDate: String? = null,
    @SerializedName("duration") val duration: Int = 1,
    @SerializedName("duration_unit") val durationUnit: String = "months",
    @SerializedName("whatsapp_contacted_at") val whatsappContactedAt: String? = null,
    @SerializedName("days_remaining") val daysRemaining: Int? = null,
    @SerializedName("days_expired") val daysExpired: Int? = null
)

data class LowStockAccountDto(
    @SerializedName("id") val id: String,
    @SerializedName("product_id") val productId: String,
    @SerializedName("product_name") val productName: String? = null,
    @SerializedName("provider") val provider: String,
    @SerializedName("total_profiles") val totalProfiles: Int = 0,
    @SerializedName("available_profiles") val availableProfiles: Int = 0
)

data class LowInventoryDto(
    @SerializedName("id") val id: String,
    @SerializedName("name") val name: String,
    @SerializedName("fulfillment_type") val fulfillmentType: String,
    @SerializedName("available_count") val availableCount: Int = 0
)

data class AlertsResponse(
    @SerializedName("badgeCount") val badgeCount: Int = 0,
    @SerializedName("expiringOrders") val expiringOrders: List<AlertOrderDto> = emptyList(),
    @SerializedName("expiredOrders") val expiredOrders: List<AlertOrderDto> = emptyList(),
    @SerializedName("lowStockAccounts") val lowStockAccounts: List<LowStockAccountDto> = emptyList(),
    @SerializedName("lowInventory") val lowInventory: List<LowInventoryDto> = emptyList()
)

data class ComposeWhatsAppRequest(
    @SerializedName("order_id") val orderId: String,
    @SerializedName("language") val language: String = "en",
    @SerializedName("event_type") val eventType: String = "order_expiring",
    @SerializedName("phone") val phone: String? = null,
    @SerializedName("save_phone") val savePhone: Boolean? = null
)

data class ComposeWhatsAppResponse(
    @SerializedName("message") val message: String? = null,
    @SerializedName("text") val text: String? = null,
    @SerializedName("phone") val phone: String? = null,
    @SerializedName("cleanPhone") val cleanPhone: String? = null,
    @SerializedName("formatted_phone") val formattedPhone: String? = null,
    @SerializedName("waUrl") val waUrl: String? = null,
    @SerializedName("whatsapp_url") val whatsappUrl: String? = null,
    @SerializedName("event_type") val eventType: String? = null,
    @SerializedName("language") val language: String? = null
) {
    val finalUrl: String? get() = whatsappUrl ?: waUrl
    val finalText: String get() = message ?: text ?: ""
}

data class WhatsAppTemplateDto(
    @SerializedName("id") val id: String? = null,
    @SerializedName("name") val name: String? = null,
    @SerializedName("event_type") val eventType: String? = null,
    @SerializedName("language") val language: String? = null,
    @SerializedName("content") val content: String? = null,
    @SerializedName("created_at") val createdAt: String? = null
) {
    val finalId: String get() = id ?: "tmpl-${finalLanguage}-${finalEventType}"
    val finalName: String get() = name?.ifBlank { null } ?: formatDefaultName(finalEventType, finalLanguage)
    val finalEventType: String get() = eventType ?: "order_expiring"
    val finalLanguage: String get() = language ?: "en"
    val finalContent: String get() = content ?: ""

    companion object {
        fun formatDefaultName(eventType: String, lang: String): String {
            val typeTitle = when (eventType) {
                "order_created" -> "Order Delivery"
                "order_expiring" -> "Renewal Reminder"
                "order_expired" -> "Expired Follow-up"
                else -> eventType.replace('_', ' ').replaceFirstChar { it.uppercase() }
            }
            val langTitle = when (lang.lowercase()) {
                "en" -> "English"
                "fr" -> "Français"
                "ar" -> "العربية"
                "ru" -> "Русский"
                else -> lang.uppercase()
            }
            return "$typeTitle ($langTitle)"
        }
    }
}

object BuiltInWhatsAppTemplates {
    val ALL: List<WhatsAppTemplateDto> = listOf(
        // order_created
        WhatsAppTemplateDto(
            id = "tmpl-en-order_created",
            name = "Order Delivery (English)",
            eventType = "order_created",
            language = "en",
            content = "Hello {customer_name}! Thank you for your order of {product_name} ({plan_name}). Your access is active until {end_date}. Order ID: #{order_id}. Enjoy!"
        ),
        WhatsAppTemplateDto(
            id = "tmpl-fr-order_created",
            name = "Livraison de Commande (Français)",
            eventType = "order_created",
            language = "fr",
            content = "Bonjour {customer_name}! Merci pour votre commande de {product_name} ({plan_name}). Votre accès est actif jusqu au {end_date}. Commande #{order_id}."
        ),
        WhatsAppTemplateDto(
            id = "tmpl-ar-order_created",
            name = "تسليم الطلب (العربية)",
            eventType = "order_created",
            language = "ar",
            content = "مرحباً {customer_name}! شكراً لطلبك {product_name} ({plan_name}). اشتراكك نشط ومفعّل حتى {end_date}. رقم الطلب: #{order_id}."
        ),
        WhatsAppTemplateDto(
            id = "tmpl-ru-order_created",
            name = "Доставка заказа (Русский)",
            eventType = "order_created",
            language = "ru",
            content = "Здравствуйте, {customer_name}! Спасибо за заказ {product_name} ({plan_name}). Ваш доступ активен до {end_date}. Заказ #{order_id}."
        ),

        // order_expiring
        WhatsAppTemplateDto(
            id = "tmpl-en-order_expiring",
            name = "Renewal Reminder (English)",
            eventType = "order_expiring",
            language = "en",
            content = "Dear {customer_name}, your subscription for {product_name} ({plan_name}) will expire in {days_remaining} days on {end_date}. Order #{order_id}. Please reply to renew now and ensure uninterrupted service!"
        ),
        WhatsAppTemplateDto(
            id = "tmpl-fr-order_expiring",
            name = "Rappel Expiration (Français)",
            eventType = "order_expiring",
            language = "fr",
            content = "Bonjour {customer_name}, votre abonnement pour {product_name} ({plan_name}) expire dans {days_remaining} jours, le {end_date}. Commande #{order_id}. Répondez à ce message pour renouveler et éviter toute coupure de service!"
        ),
        WhatsAppTemplateDto(
            id = "tmpl-ar-order_expiring",
            name = "تذكير بقرب الانتهاء (العربية)",
            eventType = "order_expiring",
            language = "ar",
            content = "مرحباً {customer_name}، نود تذكيرك بأن اشتراكك في {product_name} ({plan_name}) سينتهي خلال {days_remaining} أيام بتاريخ {end_date}. رقم الطلب: #{order_id}. يرجى الرد لتجديد اشتراكك وتجنب انقطاع الخدمة!"
        ),
        WhatsAppTemplateDto(
            id = "tmpl-ru-order_expiring",
            name = "Напоминание об истечении (Русский)",
            eventType = "order_expiring",
            language = "ru",
            content = "Уважаемый(ая) {customer_name}, ваша подписка на {product_name} ({plan_name}) истекает через {days_remaining} дн. ({end_date}). Заказ #{order_id}. Напишите нам для продления, чтобы не потерять доступ!"
        ),

        // order_expired
        WhatsAppTemplateDto(
            id = "tmpl-en-order_expired",
            name = "Expired Follow-up (English)",
            eventType = "order_expired",
            language = "en",
            content = "Hello {customer_name}, your subscription for {product_name} ({plan_name}) has expired on {end_date}. Order #{order_id}. Would you like to renew your access today? Reply to this message to reactivate immediately!"
        ),
        WhatsAppTemplateDto(
            id = "tmpl-fr-order_expired",
            name = "Abonnement Expiré (Français)",
            eventType = "order_expired",
            language = "fr",
            content = "Bonjour {customer_name}, votre abonnement pour {product_name} ({plan_name}) est désormais expiré (terminé le {end_date}). Commande #{order_id}. Souhaitez-vous renouveler votre accès aujourd'hui ? Répondez pour le réactiver immédiatement!"
        ),
        WhatsAppTemplateDto(
            id = "tmpl-ar-order_expired",
            name = "انتهاء الاشتراك وتجديده (العربية)",
            eventType = "order_expired",
            language = "ar",
            content = "مرحباً {customer_name}، لقد انتهت صلاحية اشتراكك في {product_name} ({plan_name}) بتاريخ {end_date}. رقم الطلب #{order_id}. هل ترغب في تجديد اشتراكك اليوم؟ تواصل معنا للرد وإعادة تفعيل حسابك فوراً!"
        ),
        WhatsAppTemplateDto(
            id = "tmpl-ru-order_expired",
            name = "Истекший доступ (Русский)",
            eventType = "order_expired",
            language = "ru",
            content = "Здравствуйте, {customer_name}! Срок действия вашей подписки на {product_name} ({plan_name}) истек ({end_date}). Заказ #{order_id}. Хотите продлить доступ прямо сейчас? Ответьте на это сообщение, чтобы возобновить подписку!"
        )
    )

    fun mergeWithServer(serverTemplates: List<WhatsAppTemplateDto>?): List<WhatsAppTemplateDto> {
        if (serverTemplates.isNullOrEmpty()) return ALL
        val serverMap = serverTemplates.associateBy { "${it.finalEventType}_${it.finalLanguage}" }
        val mergedDefaults = ALL.map { defaultTmpl ->
            val key = "${defaultTmpl.finalEventType}_${defaultTmpl.finalLanguage}"
            serverMap[key] ?: defaultTmpl
        }
        val customOnly = serverTemplates.filter { tmpl ->
            ALL.none { it.finalEventType == tmpl.finalEventType && it.finalLanguage == tmpl.finalLanguage }
        }
        return mergedDefaults + customOnly
    }
}

data class WhatsAppTemplatesResponse(
    @SerializedName("templates") val templates: List<WhatsAppTemplateDto> = emptyList()
)

data class UpsertTemplateRequest(
    @SerializedName("id") val id: String? = null,
    @SerializedName("name") val name: String? = null,
    @SerializedName("event_type") val eventType: String,
    @SerializedName("language") val language: String,
    @SerializedName("content") val content: String
)

