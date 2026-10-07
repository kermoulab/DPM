package com.vectis.erp

import android.app.Application
import android.util.Log
import com.google.firebase.FirebaseApp
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
 *
 * Multi-tenant design: Firebase is NOT auto-initialized from google-services.json.
 * Firebase initializes at runtime only after fetching the tenant's real Firebase
 * client config from their ERP server (GET /api/notifications/client-config).
 * This allows one generic APK to work with any deployment (erp1.com, erp2.com, etc.)
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
     *
     * Flow:
     * 1. Fetch tenant's Firebase client config from their ERP server.
     * 2a. If Firebase is not yet initialized OR config changed → initializeApp() / reinitialize.
     *     Call deleteToken() to discard any stale token, then return.
     *     FCM automatically calls onNewToken() with a fresh token for the new project.
     *     VectisFirebaseMessagingService.onNewToken() handles registration with the backend.
     * 2b. If Firebase already initialized with the same config → re-register the current token
     *     (handles restarts where token is valid but server record may have been lost).
     * 2c. If no config available from server yet → Firebase stays uninitialized, no-op.
     */
    fun syncPushTokenAutomatically() {
        if (!secureStorage.isAuthenticated()) return

        applicationScope.launch {
            try {
                // Step 1: Fetch tenant's Firebase client config
                val configResult = notificationRepository.getClientConfig()
                if (configResult is ApiResult.Success && configResult.data != null) {
                    val reconfigured = NotificationHelper.configureFirebaseAtRuntime(
                        this@VectisApplication, configResult.data
                    )
                    if (reconfigured) {
                        // Firebase was freshly initialized or reconfigured for a different project.
                        // deleteToken() clears any stale cached token, then FCM auto-registers
                        // and fires onNewToken() with a fresh token for the tenant's project.
                        // VectisFirebaseMessagingService.onNewToken() will register it with server.
                        try { FirebaseMessaging.getInstance().deleteToken() } catch (_: Exception) {}
                        return@launch
                    }
                }

                // Step 2b: Config unchanged — Firebase already initialized with the right project.
                // Just ensure the current token is registered with the backend.
                if (FirebaseApp.getApps(this@VectisApplication).isEmpty()) {
                    // No Firebase yet (server had no client config). Nothing to do.
                    return@launch
                }

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
                Log.w("VectisApp", "Push sync notice: ${e.message}")
            }
        }
    }

    companion object {
        lateinit var instance: VectisApplication
            private set
    }
}
