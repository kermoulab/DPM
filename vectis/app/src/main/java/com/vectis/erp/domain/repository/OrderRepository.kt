package com.vectis.erp.domain.repository

import com.vectis.erp.core.network.ApiResult
import com.vectis.erp.data.model.*

interface OrderRepository {
    suspend fun getOrders(status: String? = null, customerId: String? = null, productId: String? = null, search: String? = null): ApiResult<OrdersResponse>
    suspend fun getOrderDetail(id: String): ApiResult<OrderDetailResponse>
    suspend fun createOrder(request: CreateOrderRequest): ApiResult<OrderMutationResponse>
    suspend fun renewOrder(id: String, request: RenewOrderRequest): ApiResult<OrderMutationResponse>
    suspend fun cancelOrder(id: String, request: CancelOrderRequest): ApiResult<OrderMutationResponse>
    suspend fun deleteOrder(id: String): ApiResult<OrderMutationResponse>
}
