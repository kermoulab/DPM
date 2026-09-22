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

    // Inventory - Service Account & Profile CRUD
    suspend fun createServiceAccount(req: CreateServiceAccountRequest): ApiResult<SimpleActionResponse>
    suspend fun updateServiceAccount(id: String, req: UpdateServiceAccountRequest): ApiResult<SimpleActionResponse>
    suspend fun deleteServiceAccount(id: String): ApiResult<SimpleActionResponse>
    suspend fun updateServiceProfile(id: String, req: UpdateServiceProfileRequest): ApiResult<SimpleActionResponse>

    // Inventory - License Key CRUD
    suspend fun addLicenses(req: AddLicensesRequest): ApiResult<AddLicensesResponse>
    suspend fun deleteLicense(id: String): ApiResult<SimpleActionResponse>
}
