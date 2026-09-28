package com.vectis.erp

import android.app.Application
import com.vectis.erp.core.network.NetworkClient
import com.vectis.erp.core.notification.NotificationHelper
import com.vectis.erp.core.security.SecureStorage
import com.vectis.erp.data.repository.NotificationRepositoryImpl
import com.vectis.erp.domain.repository.NotificationRepository

/**
 * VectisApplication - Application entry point.
 * Initializes secure storage, networking foundation, and notification channels.
 * Follows Rule 1: No local business database is created or initialized.
 */
class VectisApplication : Application() {

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

    companion object {
        lateinit var instance: VectisApplication
            private set
    }
}
