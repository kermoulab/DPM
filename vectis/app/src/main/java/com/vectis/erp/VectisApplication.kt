package com.vectis.erp

import android.app.Application
import android.util.Log
import com.google.firebase.messaging.FirebaseMessaging
import com.vectis.erp.core.network.ApiResult
import com.vectis.erp.core.network.NetworkClient
import com.vectis.erp.core.notification.NotificationHelper
import com.vectis.erp.core.security.SecureStorage
import com.vectis.erp.data.repository.NotificationRepositoryImpl
import com.vectis.erp.domain.repository.NotificationRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/**
 * VectisApplication - Application entry point.
 * Initializes secure storage, networking foundation, and notification channels.
 * Follows Rule 1: No local business database is created or initialized.
 */
class VectisApplication : Application() {

    private val applicationScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    lateinit var secureStorage: SecureStorage
        private set

    lateinit var networkClient: NetworkClient
        private set

    lateinit var notificationRepository: NotificationRepository
        private set

    override fun onCreate() {
        super.onCreate()
        instance = this

        secureStorage = SecureStorage.create(this)
        networkClient = NetworkClient(secureStorage)
        notificationRepository = NotificationRepositoryImpl(networkClient)

        // Initialize high-priority push and alert notification channel
        NotificationHelper.initNotificationChannels(this)
    }

    /**
     * Completely hands-free background push token synchronization.
     * Triggered on app launch, resume, and login. Requires ZERO user button clicks.
     */
    fun syncPushTokenAutomatically() {
        if (!secureStorage.isAuthenticated()) return

        applicationScope.launch {
            try {
                // 1. Fetch dynamic client config from server
                val configResult = notificationRepository.getClientConfig()
                if (configResult is ApiResult.Success && configResult.data != null) {
                    val reconfigured = NotificationHelper.configureFirebaseAtRuntime(this@VectisApplication, configResult.data)
                    if (reconfigured) {
                        try {
                            FirebaseMessaging.getInstance().deleteToken()
                        } catch (_: Exception) {}
                    }
                }

                // 2. Obtain active FCM token and register with server
                FirebaseMessaging.getInstance().token
                    .addOnSuccessListener { token ->
                        if (!token.isNullOrBlank()) {
                            secureStorage.setPushToken(token)
                            applicationScope.launch {
                                notificationRepository.registerPushToken(token, secureStorage.getDeviceId())
                            }
                        }
                    }
            } catch (e: Exception) {
                Log.w("VectisApp", "Hands-free push sync notice: ${e.message}")
            }
        }
    }

    companion object {
        lateinit var instance: VectisApplication
            private set
    }
}
