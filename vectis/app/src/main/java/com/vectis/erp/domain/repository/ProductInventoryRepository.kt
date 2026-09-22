package com.vectis.erp.domain.repository

import com.vectis.erp.core.network.ApiResult
import com.vectis.erp.data.model.*

interface ProductInventoryRepository {
    suspend fun getProducts(search: String? = null, status: String? = null): ApiResult<ProductsResponse>
    suspend fun getProductDetail(id: String): ApiResult<ProductDetailResponse>
    suspend fun getPlans(productId: String? = null): ApiResult<PlansResponse>
    suspend fun getServiceAccounts(productId: String? = null, status: String? = null): ApiResult<ServiceAccountsResponse>
    suspend fun getAccountProfiles(accountId: String): ApiResult<ServiceProfilesResponse>
    suspend fun revealCredentials(accountId: String): ApiResult<RevealCredentialResponse>
    suspend fun getLicenseKeys(productId: String? = null, status: String? = null): ApiResult<LicenseKeysResponse>

    // Product & Category CRUD
    suspend fun createProduct(req: CreateProductRequest): ApiResult<ProductDetailResponse>
    suspend fun updateProduct(id: String, req: UpdateProductRequest): ApiResult<ProductDetailResponse>
    suspend fun deleteProduct(id: String): ApiResult<SimpleActionResponse>
    suspend fun getCategories(): ApiResult<CategoriesResponse>
    suspend fun createCategory(req: CreateCategoryRequest): ApiResult<CategoryResponse>

    // Plan CRUD
    suspend fun createPlan(req: CreatePlanRequest): ApiResult<PlanResponse>
    suspend fun deletePlan(id: String): ApiResult<SimpleActionResponse>
}
