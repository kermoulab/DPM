package com.vectis.erp.core.notification

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import com.vectis.erp.MainActivity

object NotificationHelper {

    const val CHANNEL_ID_ALERTS = "vectis_subscription_alerts"
    private const val CHANNEL_NAME = "Subscription Alerts"
    private const val CHANNEL_DESC = "Notifications for expiring and expired customer subscriptions, accounts, and security events"

    fun initNotificationChannels(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID_ALERTS,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = CHANNEL_DESC
                enableVibration(true)
            }
            val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(channel)
        }
    }

    /**
     * Shows a structured push / alert notification.
     * Attaches deep linking parameters to navigate directly to the affected entity screen upon tap.
     * Complies with security rules: NEVER includes passwords or plaintext credentials.
     */
    fun showNotification(
        context: Context,
        notificationId: Int = (System.currentTimeMillis() % 100000).toInt(),
        title: String,
        message: String,
        type: String? = null,
        entityType: String? = null,
        entityId: String? = null
    ) {
        initNotificationChannels(context)

        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("deep_link_type", type)
            putExtra("deep_link_entity_type", entityType)
            putExtra("deep_link_entity_id", entityId)
            if (entityType == "order" && entityId != null) {
                putExtra("deep_link_order_id", entityId)
            }
        }

        val pendingIntent = PendingIntent.getActivity(
            context,
            notificationId,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(context, CHANNEL_ID_ALERTS)
            .setSmallIcon(android.R.drawable.ic_dialog_alert)
            .setContentTitle(title)
            .setContentText(message)
            .setStyle(NotificationCompat.BigTextStyle().bigText(message))
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .build()

        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(notificationId, notification)
    }

    /**
     * Backward-compatible helper for legacy subscription alert calls.
     */
    fun showSubscriptionAlert(
        context: Context,
        notificationId: Int,
        title: String,
        message: String,
        orderId: String? = null,
        customerId: String? = null
    ) {
        showNotification(
            context = context,
            notificationId = notificationId,
            title = title,
            message = message,
            type = "ORDER_EXPIRING",
            entityType = "order",
            entityId = orderId
        )
    }
}
