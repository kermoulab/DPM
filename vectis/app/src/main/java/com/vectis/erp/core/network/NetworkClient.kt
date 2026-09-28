package com.vectis.erp.core.network

import com.google.gson.Gson
import com.google.gson.GsonBuilder
import com.vectis.erp.core.security.SecureStorage
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import okhttp3.OkHttpClient
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

/**
 * NetworkClient - Centralized HTTP & Retrofit client.
 * Manages Auth, Device Identity, and Sensitive Data Filter Interceptors.
 */
class NetworkClient(private val secureStorage: SecureStorage) {

    private val _unauthorizedEvents = MutableSharedFlow<Unit>(extraBufferCapacity = 1)
    val unauthorizedEvents: SharedFlow<Unit> = _unauthorizedEvents.asSharedFlow()

    private val _deviceRevokedEvents = MutableSharedFlow<Unit>(extraBufferCapacity = 1)
    val deviceRevokedEvents: SharedFlow<Unit> = _deviceRevokedEvents.asSharedFlow()

    val gson: Gson = GsonBuilder()
        .setDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'")
        .create()

    val okHttpClient: OkHttpClient by lazy {
        OkHttpClient.Builder()
            .dispatcher(okhttp3.Dispatcher().apply {
                maxRequests = 64
                maxRequestsPerHost = 20
            })
            .connectionPool(okhttp3.ConnectionPool(10, 5, TimeUnit.MINUTES))
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .retryOnConnectionFailure(true)
            .followRedirects(true)
            .followSslRedirects(true)
            .addInterceptor(DeviceInterceptor(secureStorage) {
                _deviceRevokedEvents.tryEmit(Unit)
            })
            .addInterceptor(AuthInterceptor(secureStorage) {
                _unauthorizedEvents.tryEmit(Unit)
            })
            .addNetworkInterceptor { chain ->
                val req = chain.request()
                val token = secureStorage.getAuthToken()
                val deviceId = secureStorage.getDeviceId()
                val deviceToken = secureStorage.getDeviceToken()

                val newBuilder = req.newBuilder()
                if (!token.isNullOrBlank() && req.header("Authorization") == null) {
                    newBuilder.header("Authorization", "Bearer ${token.trim().trim('"', '\'')}")
                }
                if (!deviceId.isNullOrBlank() && req.header("X-Device-Id") == null) {
                    newBuilder.header("X-Device-Id", deviceId)
                }
                if (!deviceToken.isNullOrBlank() && req.header("X-Device-Token") == null) {
                    newBuilder.header("X-Device-Token", deviceToken)
                }
                chain.proceed(newBuilder.build())
            }
            .authenticator { _, response ->
                val token = secureStorage.getAuthToken()
                if (!token.isNullOrBlank() && response.request.header("Authorization") == null) {
                    response.request.newBuilder()
                        .header("Authorization", "Bearer ${token.trim().trim('"', '\'')}")
                        .build()
                } else {
                    null
                }
            }
            .addInterceptor(SensitiveDataFilterLoggingInterceptor())
            .build()
    }

    private var retrofitInstance: Retrofit? = null
    private var currentBaseUrl: String? = null

    fun getRetrofit(): Retrofit {
        val serverUrl = secureStorage.getServerUrl()
        val normalizedUrl = if (serverUrl.endsWith("/")) serverUrl else "$serverUrl/"

        if (retrofitInstance == null || currentBaseUrl != normalizedUrl) {
            currentBaseUrl = normalizedUrl
            retrofitInstance = Retrofit.Builder()
                .baseUrl(normalizedUrl)
                .client(okHttpClient)
                .addConverterFactory(GsonConverterFactory.create(gson))
                .build()
        }
        return retrofitInstance!!
    }

    inline fun <reified T> createService(): T {
        return getRetrofit().create(T::class.java)
    }
}
