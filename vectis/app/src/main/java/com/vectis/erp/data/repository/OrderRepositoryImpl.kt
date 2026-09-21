package com.vectis.erp.data.repository

import com.vectis.erp.core.network.ApiResult
import com.vectis.erp.core.network.NetworkClient
import com.vectis.erp.data.api.OrderApiService
import com.vectis.erp.data.model.*
import com.vectis.erp.domain.repository.OrderRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class OrderRepositoryImpl(
    private val networkClient: NetworkClient
) : OrderRepository {

    override suspend fun getOrders(status: String?, customerId: String?, productId: String?, search: String?): ApiResult<OrdersResponse> = withContext(Dispatchers.IO) {
        try {
            val api = networkClient.createService<OrderApiService>()
            val response = api.getOrders(status = status, customerId = customerId, productId = productId, search = search)
            if (response.isSuccessful && response.body() != null) {
                ApiResult.Success(response.body()!!)
            } else {
                ApiResult.Error(response.code(), "Failed to fetch orders (${response.code()})")
            }
        } catch (e: Exception) {
            ApiResult.NetworkError(e)
        }
    }

    override suspend fun getOrderDetail(id: String): ApiResult<OrderDetailResponse> = withContext(Dispatchers.IO) {
        try {
            val api = networkClient.createService<OrderApiService>()
            val response = api.getOrderDetail(id)
            if (response.isSuccessful && response.body() != null) {
                ApiResult.Success(response.body()!!)
            } else {
                ApiResult.Error(response.code(), "Failed to fetch order details (${response.code()})")
            }
        } catch (e: Exception) {
            ApiResult.NetworkError(e)
        }
    }

    override suspend fun createOrder(request: CreateOrderRequest): ApiResult<OrderMutationResponse> = withContext(Dispatchers.IO) {
        try {
            val api = networkClient.createService<OrderApiService>()
            val response = api.createOrder(request)
            if (response.isSuccessful && response.body() != null) {
                ApiResult.Success(response.body()!!)
            } else {
                val errorBody = response.errorBody()?.string() ?: ""
                ApiResult.Error(response.code(), if (errorBody.isNotBlank()) errorBody else "Failed to create order (${response.code()})")
            }
        } catch (e: Exception) {
            ApiResult.NetworkError(e)
        }
    }

    override suspend fun renewOrder(id: String, request: RenewOrderRequest): ApiResult<OrderMutationResponse> = withContext(Dispatchers.IO) {
        try {
            val api = networkClient.createService<OrderApiService>()
            val response = api.renewOrder(id, request)
            if (response.isSuccessful && response.body() != null) {
                ApiResult.Success(response.body()!!)
            } else {
                val errorBody = response.errorBody()?.string() ?: ""
                ApiResult.Error(response.code(), if (errorBody.isNotBlank()) errorBody else "Failed to renew order (${response.code()})")
            }
        } catch (e: Exception) {
            ApiResult.NetworkError(e)
        }
    }

    override suspend fun cancelOrder(id: String, request: CancelOrderRequest): ApiResult<OrderMutationResponse> = withContext(Dispatchers.IO) {
        try {
            val api = networkClient.createService<OrderApiService>()
            val response = api.cancelOrder(id, request)
            if (response.isSuccessful && response.body() != null) {
                ApiResult.Success(response.body()!!)
            } else {
                val errorBody = response.errorBody()?.string() ?: ""
                ApiResult.Error(response.code(), if (errorBody.isNotBlank()) errorBody else "Failed to cancel order (${response.code()})")
            }
        } catch (e: Exception) {
            ApiResult.NetworkError(e)
        }
    }

    override suspend fun deleteOrder(id: String): ApiResult<OrderMutationResponse> = withContext(Dispatchers.IO) {
        try {
            val api = networkClient.createService<OrderApiService>()
            val response = api.deleteOrder(id)
            if (response.isSuccessful && response.body() != null) {
                ApiResult.Success(response.body()!!)
            } else {
                val errorBody = response.errorBody()?.string() ?: ""
                val msg = if (response.code() == 403) "Permission denied: Only Admins can delete orders." else "Failed to delete order (${response.code()})"
                ApiResult.Error(response.code(), if (errorBody.isNotBlank()) errorBody else msg)
            }
        } catch (e: Exception) {
            ApiResult.NetworkError(e)
        }
    }
}
