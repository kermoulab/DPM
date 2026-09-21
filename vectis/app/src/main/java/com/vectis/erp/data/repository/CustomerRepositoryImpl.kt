package com.vectis.erp.data.repository

import com.vectis.erp.core.network.ApiResult
import com.vectis.erp.core.network.NetworkClient
import com.vectis.erp.data.api.CustomerApiService
import com.vectis.erp.data.model.*
import com.vectis.erp.domain.repository.CustomerRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class CustomerRepositoryImpl(
    private val networkClient: NetworkClient
) : CustomerRepository {

    override suspend fun getCustomers(search: String?, status: String?): ApiResult<CustomersResponse> = withContext(Dispatchers.IO) {
        try {
            val api = networkClient.createService<CustomerApiService>()
            val response = api.getCustomers(search = search, status = status)
            if (response.isSuccessful && response.body() != null) {
                ApiResult.Success(response.body()!!)
            } else {
                ApiResult.Error(response.code(), "Failed to fetch customers (${response.code()})")
            }
        } catch (e: Exception) {
            ApiResult.NetworkError(e)
        }
    }

    override suspend fun getCustomerDetail(id: String): ApiResult<CustomerDetailResponse> = withContext(Dispatchers.IO) {
        try {
            val api = networkClient.createService<CustomerApiService>()
            val response = api.getCustomerDetail(id)
            if (response.isSuccessful && response.body() != null) {
                ApiResult.Success(response.body()!!)
            } else {
                ApiResult.Error(response.code(), "Failed to fetch customer details (${response.code()})")
            }
        } catch (e: Exception) {
            ApiResult.NetworkError(e)
        }
    }

    override suspend fun createCustomer(request: CreateCustomerRequest): ApiResult<CustomerMutationResponse> = withContext(Dispatchers.IO) {
        try {
            val api = networkClient.createService<CustomerApiService>()
            val response = api.createCustomer(request)
            if (response.isSuccessful && response.body() != null) {
                ApiResult.Success(response.body()!!)
            } else {
                val errorBody = response.errorBody()?.string() ?: ""
                ApiResult.Error(response.code(), if (errorBody.isNotBlank()) errorBody else "Failed to create customer (${response.code()})")
            }
        } catch (e: Exception) {
            ApiResult.NetworkError(e)
        }
    }

    override suspend fun updateCustomer(id: String, request: UpdateCustomerRequest): ApiResult<CustomerMutationResponse> = withContext(Dispatchers.IO) {
        try {
            val api = networkClient.createService<CustomerApiService>()
            val response = api.updateCustomer(id, request)
            if (response.isSuccessful && response.body() != null) {
                ApiResult.Success(response.body()!!)
            } else {
                val errorBody = response.errorBody()?.string() ?: ""
                ApiResult.Error(response.code(), if (errorBody.isNotBlank()) errorBody else "Failed to update customer (${response.code()})")
            }
        } catch (e: Exception) {
            ApiResult.NetworkError(e)
        }
    }

    override suspend fun deleteCustomer(id: String): ApiResult<CustomerMutationResponse> = withContext(Dispatchers.IO) {
        try {
            val api = networkClient.createService<CustomerApiService>()
            val response = api.deleteCustomer(id)
            if (response.isSuccessful && response.body() != null) {
                ApiResult.Success(response.body()!!)
            } else {
                val errorBody = response.errorBody()?.string() ?: ""
                val msg = if (errorBody.contains("Cannot delete customer with existing orders")) {
                    "Cannot delete customer with existing orders. Please cancel or remove customer orders first."
                } else if (response.code() == 403) {
                    "Permission denied: Only Admins can delete customers."
                } else {
                    "Failed to delete customer (${response.code()})"
                }
                ApiResult.Error(response.code(), msg)
            }
        } catch (e: Exception) {
            ApiResult.NetworkError(e)
        }
    }
}
