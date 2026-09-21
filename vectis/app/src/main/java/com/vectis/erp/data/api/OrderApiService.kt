package com.vectis.erp.data.api

import com.vectis.erp.data.model.*
import retrofit2.Response
import retrofit2.http.*

interface OrderApiService {

    @GET("api/orders")
    suspend fun getOrders(
        @Query("status") status: String? = null,
        @Query("customer_id") customerId: String? = null,
        @Query("product_id") productId: String? = null,
        @Query("search") search: String? = null
    ): Response<OrdersResponse>

    @GET("api/orders/{id}")
    suspend fun getOrderDetail(
        @Path("id") id: String
    ): Response<OrderDetailResponse>

    @POST("api/orders")
    suspend fun createOrder(
        @Body request: CreateOrderRequest
    ): Response<OrderMutationResponse>

    @POST("api/orders/{id}/renew")
    suspend fun renewOrder(
        @Path("id") id: String,
        @Body request: RenewOrderRequest
    ): Response<OrderMutationResponse>

    @POST("api/orders/{id}/cancel")
    suspend fun cancelOrder(
        @Path("id") id: String,
        @Body request: CancelOrderRequest
    ): Response<OrderMutationResponse>

    @DELETE("api/orders/{id}")
    suspend fun deleteOrder(
        @Path("id") id: String
    ): Response<OrderMutationResponse>
}
