package com.vectis.erp.data.repository

import com.vectis.erp.core.network.ApiResult
import com.vectis.erp.core.network.NetworkClient
import com.vectis.erp.data.api.ProductInventoryApiService
import com.vectis.erp.data.model.*
import com.vectis.erp.domain.repository.ProductInventoryRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class ProductInventoryRepositoryImpl(
    private val networkClient: NetworkClient
) : ProductInventoryRepository {

    override suspend fun getProducts(search: String?, status: String?): ApiResult<ProductsResponse> = withContext(Dispatchers.IO) {
        try {
            val api = networkClient.createService<ProductInventoryApiService>()
            val response = api.getProducts(search = search, status = status)
            if (response.isSuccessful && response.body() != null) {
                ApiResult.Success(response.body()!!)
            } else {
                ApiResult.Error(response.code(), "Failed to fetch products (${response.code()})")
            }
        } catch (e: Exception) {
            ApiResult.NetworkError(e)
        }
    }

    override suspend fun getProductDetail(id: String): ApiResult<ProductDetailResponse> = withContext(Dispatchers.IO) {
        try {
            val api = networkClient.createService<ProductInventoryApiService>()
            val response = api.getProductDetail(id)
            if (response.isSuccessful && response.body() != null) {
                ApiResult.Success(response.body()!!)
            } else {
                ApiResult.Error(response.code(), "Failed to fetch product details (${response.code()})")
            }
        } catch (e: Exception) {
            ApiResult.NetworkError(e)
        }
    }

    override suspend fun getPlans(productId: String?): ApiResult<PlansResponse> = withContext(Dispatchers.IO) {
        try {
            val api = networkClient.createService<ProductInventoryApiService>()
            val response = api.getPlans(productId)
            if (response.isSuccessful && response.body() != null) {
                ApiResult.Success(response.body()!!)
            } else {
                ApiResult.Error(response.code(), "Failed to fetch plans (${response.code()})")
            }
        } catch (e: Exception) {
            ApiResult.NetworkError(e)
        }
    }

    override suspend fun getServiceAccounts(productId: String?, status: String?): ApiResult<ServiceAccountsResponse> = withContext(Dispatchers.IO) {
        try {
            val api = networkClient.createService<ProductInventoryApiService>()
            val response = api.getServiceAccounts(productId, status)
            if (response.isSuccessful && response.body() != null) {
                ApiResult.Success(response.body()!!)
            } else {
                ApiResult.Error(response.code(), "Failed to fetch service accounts (${response.code()})")
            }
        } catch (e: Exception) {
            ApiResult.NetworkError(e)
        }
    }

    override suspend fun getAccountProfiles(accountId: String): ApiResult<ServiceProfilesResponse> = withContext(Dispatchers.IO) {
        try {
            val api = networkClient.createService<ProductInventoryApiService>()
            val response = api.getAccountProfiles(accountId)
            if (response.isSuccessful && response.body() != null) {
                ApiResult.Success(response.body()!!)
            } else {
                ApiResult.Error(response.code(), "Failed to fetch account profile slots (${response.code()})")
            }
        } catch (e: Exception) {
            ApiResult.NetworkError(e)
        }
    }

    override suspend fun revealCredentials(accountId: String): ApiResult<RevealCredentialResponse> = withContext(Dispatchers.IO) {
        try {
            val api = networkClient.createService<ProductInventoryApiService>()
            val response = api.revealCredentials(accountId)
            if (response.isSuccessful && response.body() != null) {
                ApiResult.Success(response.body()!!)
            } else {
                ApiResult.Error(response.code(), if (response.code() == 403) "Permission denied to view credentials." else "Failed to reveal credentials (${response.code()})")
            }
        } catch (e: Exception) {
            ApiResult.NetworkError(e)
        }
    }

    override suspend fun getLicenseKeys(productId: String?, status: String?): ApiResult<LicenseKeysResponse> = withContext(Dispatchers.IO) {
        try {
            val api = networkClient.createService<ProductInventoryApiService>()
            val response = api.getLicenseKeys(productId, status)
            if (response.isSuccessful && response.body() != null) {
                ApiResult.Success(response.body()!!)
            } else {
                ApiResult.Error(response.code(), "Failed to fetch license keys (${response.code()})")
            }
        } catch (e: Exception) {
            ApiResult.NetworkError(e)
        }
    }

    override suspend fun createProduct(req: CreateProductRequest): ApiResult<ProductDetailResponse> = withContext(Dispatchers.IO) {
        try {
            val api = networkClient.createService<ProductInventoryApiService>()
            val response = api.createProduct(req)
            if (response.isSuccessful && response.body() != null) {
                ApiResult.Success(response.body()!!)
            } else {
                ApiResult.Error(response.code(), "Failed to create product (${response.code()})")
            }
        } catch (e: Exception) {
            ApiResult.NetworkError(e)
        }
    }

    override suspend fun updateProduct(id: String, req: UpdateProductRequest): ApiResult<ProductDetailResponse> = withContext(Dispatchers.IO) {
        try {
            val api = networkClient.createService<ProductInventoryApiService>()
            val response = api.updateProduct(id, req)
            if (response.isSuccessful && response.body() != null) {
                ApiResult.Success(response.body()!!)
            } else {
                ApiResult.Error(response.code(), "Failed to update product (${response.code()})")
            }
        } catch (e: Exception) {
            ApiResult.NetworkError(e)
        }
    }

    override suspend fun deleteProduct(id: String): ApiResult<SimpleActionResponse> = withContext(Dispatchers.IO) {
        try {
            val api = networkClient.createService<ProductInventoryApiService>()
            val response = api.deleteProduct(id)
            if (response.isSuccessful && response.body() != null) {
                ApiResult.Success(response.body()!!)
            } else {
                ApiResult.Error(response.code(), "Failed to delete product (${response.code()})")
            }
        } catch (e: Exception) {
            ApiResult.NetworkError(e)
        }
    }

    override suspend fun getCategories(): ApiResult<CategoriesResponse> = withContext(Dispatchers.IO) {
        try {
            val api = networkClient.createService<ProductInventoryApiService>()
            val response = api.getCategories()
            if (response.isSuccessful && response.body() != null) {
                ApiResult.Success(response.body()!!)
            } else {
                ApiResult.Error(response.code(), "Failed to fetch categories (${response.code()})")
            }
        } catch (e: Exception) {
            ApiResult.NetworkError(e)
        }
    }

    override suspend fun createCategory(req: CreateCategoryRequest): ApiResult<CategoryResponse> = withContext(Dispatchers.IO) {
        try {
            val api = networkClient.createService<ProductInventoryApiService>()
            val response = api.createCategory(req)
            if (response.isSuccessful && response.body() != null) {
                ApiResult.Success(response.body()!!)
            } else {
                ApiResult.Error(response.code(), "Failed to create category (${response.code()})")
            }
        } catch (e: Exception) {
            ApiResult.NetworkError(e)
        }
    }

    override suspend fun createPlan(req: CreatePlanRequest): ApiResult<PlanResponse> = withContext(Dispatchers.IO) {
        try {
            val api = networkClient.createService<ProductInventoryApiService>()
            val response = api.createPlan(req)
            if (response.isSuccessful && response.body() != null) {
                ApiResult.Success(response.body()!!)
            } else {
                ApiResult.Error(response.code(), "Failed to create plan (${response.code()})")
            }
        } catch (e: Exception) {
            ApiResult.NetworkError(e)
        }
    }

    override suspend fun deletePlan(id: String): ApiResult<SimpleActionResponse> = withContext(Dispatchers.IO) {
        try {
            val api = networkClient.createService<ProductInventoryApiService>()
            val response = api.deletePlan(id)
            if (response.isSuccessful && response.body() != null) {
                ApiResult.Success(response.body()!!)
            } else {
                ApiResult.Error(response.code(), "Failed to delete plan (${response.code()})")
            }
        } catch (e: Exception) {
            ApiResult.NetworkError(e)
        }
    }

    override suspend fun createServiceAccount(req: CreateServiceAccountRequest): ApiResult<SimpleActionResponse> = withContext(Dispatchers.IO) {
        try {
            val api = networkClient.createService<ProductInventoryApiService>()
            val response = api.createServiceAccount(req)
            if (response.isSuccessful && response.body() != null) {
                ApiResult.Success(response.body()!!)
            } else {
                ApiResult.Error(response.code(), "Failed to create service account (${response.code()})")
            }
        } catch (e: Exception) {
            ApiResult.NetworkError(e)
        }
    }

    override suspend fun updateServiceAccount(id: String, req: UpdateServiceAccountRequest): ApiResult<SimpleActionResponse> = withContext(Dispatchers.IO) {
        try {
            val api = networkClient.createService<ProductInventoryApiService>()
            val response = api.updateServiceAccount(id, req)
            if (response.isSuccessful && response.body() != null) {
                ApiResult.Success(response.body()!!)
            } else {
                ApiResult.Error(response.code(), "Failed to update service account (${response.code()})")
            }
        } catch (e: Exception) {
            ApiResult.NetworkError(e)
        }
    }

    override suspend fun deleteServiceAccount(id: String): ApiResult<SimpleActionResponse> = withContext(Dispatchers.IO) {
        try {
            val api = networkClient.createService<ProductInventoryApiService>()
            val response = api.deleteServiceAccount(id)
            if (response.isSuccessful && response.body() != null) {
                ApiResult.Success(response.body()!!)
            } else {
                ApiResult.Error(response.code(), "Failed to delete service account (${response.code()})")
            }
        } catch (e: Exception) {
            ApiResult.NetworkError(e)
        }
    }

    override suspend fun updateServiceProfile(id: String, req: UpdateServiceProfileRequest): ApiResult<SimpleActionResponse> = withContext(Dispatchers.IO) {
        try {
            val api = networkClient.createService<ProductInventoryApiService>()
            val response = api.updateServiceProfile(id, req)
            if (response.isSuccessful && response.body() != null) {
                ApiResult.Success(response.body()!!)
            } else {
                ApiResult.Error(response.code(), "Failed to update profile (${response.code()})")
            }
        } catch (e: Exception) {
            ApiResult.NetworkError(e)
        }
    }

    override suspend fun addLicenses(req: AddLicensesRequest): ApiResult<AddLicensesResponse> = withContext(Dispatchers.IO) {
        try {
            val api = networkClient.createService<ProductInventoryApiService>()
            val response = api.addLicenses(req)
            if (response.isSuccessful && response.body() != null) {
                ApiResult.Success(response.body()!!)
            } else {
                ApiResult.Error(response.code(), "Failed to add license keys (${response.code()})")
            }
        } catch (e: Exception) {
            ApiResult.NetworkError(e)
        }
    }

    override suspend fun deleteLicense(id: String): ApiResult<SimpleActionResponse> = withContext(Dispatchers.IO) {
        try {
            val api = networkClient.createService<ProductInventoryApiService>()
            val response = api.deleteLicense(id)
            if (response.isSuccessful && response.body() != null) {
                ApiResult.Success(response.body()!!)
            } else {
                ApiResult.Error(response.code(), "Failed to delete license key (${response.code()})")
            }
        } catch (e: Exception) {
            ApiResult.NetworkError(e)
        }
    }
}
