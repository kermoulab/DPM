package com.vectis.erp

import android.app.Application
import com.vectis.erp.core.network.NetworkClient
import com.vectis.erp.core.security.SecureStorage

/**
 * VectisApplication - Application entry point.
 * Initializes secure storage and networking foundation.
 * Follows Rule 1: No local business database is created or initialized.
 */
class VectisApplication : Application() {

    lateinit var secureStorage: SecureStorage
        private set

    lateinit var networkClient: NetworkClient
        private set

    override fun onCreate() {
        super.onCreate()
        instance = this

        secureStorage = SecureStorage.create(this)
        networkClient = NetworkClient(secureStorage)
    }

    companion object {
        lateinit var instance: VectisApplication
            private set
    }
}
