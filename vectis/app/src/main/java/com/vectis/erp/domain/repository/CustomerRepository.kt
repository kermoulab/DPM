package com.vectis.erp.domain.repository

import com.vectis.erp.core.network.ApiResult
import com.vectis.erp.data.model.*

interface CustomerRepository {
    suspend fun getCustomers(search: String? = null, status: String? = null): ApiResult<CustomersResponse>
    suspend fun getCustomerDetail(id: String): ApiResult<CustomerDetailResponse>
    suspend fun createCustomer(request: CreateCustomerRequest): ApiResult<CustomerMutationResponse>
    suspend fun updateCustomer(id: String, request: UpdateCustomerRequest): ApiResult<CustomerMutationResponse>
    suspend fun deleteCustomer(id: String): ApiResult<CustomerMutationResponse>
}
