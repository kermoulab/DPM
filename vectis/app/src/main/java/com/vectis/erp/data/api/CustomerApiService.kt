package com.vectis.erp.data.api

import com.vectis.erp.data.model.*
import retrofit2.Response
import retrofit2.http.*

interface CustomerApiService {

    @GET("api/customers")
    suspend fun getCustomers(
        @Query("search") search: String? = null,
        @Query("status") status: String? = null
    ): Response<CustomersResponse>

    @GET("api/customers/{id}")
    suspend fun getCustomerDetail(
        @Path("id") id: String
    ): Response<CustomerDetailResponse>

    @POST("api/customers")
    suspend fun createCustomer(
        @Body request: CreateCustomerRequest
    ): Response<CustomerMutationResponse>

    @PUT("api/customers/{id}")
    suspend fun updateCustomer(
        @Path("id") id: String,
        @Body request: UpdateCustomerRequest
    ): Response<CustomerMutationResponse>

    @DELETE("api/customers/{id}")
    suspend fun deleteCustomer(
        @Path("id") id: String
    ): Response<CustomerMutationResponse>
}
