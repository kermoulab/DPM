package com.vectis.erp.core.notification

import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.vectis.erp.VectisApplication
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

class VectisFirebaseMessagingService : FirebaseMessagingService() {

    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onDestroy() {
        super.onDestroy()
        serviceScope.cancel()
    }

    override fun onNewToken(token: String) {
        super.onNewToken(token)

        val app = VectisApplication.instance
        app.secureStorage.setPushToken(token)

        // If user is currently authenticated, sync token immediately with backend
        if (app.secureStorage.isAuthenticated()) {
            serviceScope.launch {
                app.notificationRepository.registerPushToken(
                    token = token,
                    deviceId = app.secureStorage.getDeviceId()
                )
            }
        }
    }

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)

        val data = remoteMessage.data
        val title = remoteMessage.notification?.title
            ?: data["title"]
            ?: "Vectis ERP Alert"

        val message = remoteMessage.notification?.body
            ?: data["message"]
            ?: data["body"]
            ?: "You have a new update in Vectis."

        val type = data["type"]
        val entityType = data["entityType"]
        val entityId = data["entityId"]

        NotificationHelper.showNotification(
            context = applicationContext,
            title = title,
            message = message,
            type = type,
            entityType = entityType,
            entityId = entityId
        )
    }
}
