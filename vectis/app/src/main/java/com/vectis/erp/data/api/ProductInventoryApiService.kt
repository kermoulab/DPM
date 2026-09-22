package com.vectis.erp.data.api

import com.vectis.erp.data.model.*
import retrofit2.Response
import retrofit2.http.*

interface ProductInventoryApiService {

    // Products
    @GET("api/products")
    suspend fun getProducts(
        @Query("search") search: String? = null,
        @Query("status") status: String? = null,
        @Query("category_id") categoryId: String? = null
    ): Response<ProductsResponse>

    @GET("api/products/{id}")
    suspend fun getProductDetail(
        @Path("id") id: String
    ): Response<ProductDetailResponse>

    @POST("api/products")
    suspend fun createProduct(
        @Body req: CreateProductRequest
    ): Response<ProductDetailResponse>

    @PUT("api/products/{id}")
    suspend fun updateProduct(
        @Path("id") id: String,
        @Body req: UpdateProductRequest
    ): Response<ProductDetailResponse>

    @DELETE("api/products/{id}")
    suspend fun deleteProduct(
        @Path("id") id: String
    ): Response<SimpleActionResponse>

    // Categories
    @GET("api/categories")
    suspend fun getCategories(): Response<CategoriesResponse>

    @POST("api/categories")
    suspend fun createCategory(
        @Body req: CreateCategoryRequest
    ): Response<CategoryResponse>

    // Plans
    @GET("api/plans")
    suspend fun getPlans(
        @Query("product_id") productId: String? = null
    ): Response<PlansResponse>

    @POST("api/plans")
    suspend fun createPlan(
        @Body req: CreatePlanRequest
    ): Response<PlanResponse>

    @DELETE("api/plans/{id}")
    suspend fun deletePlan(
        @Path("id") id: String
    ): Response<SimpleActionResponse>

    // Inventory - Service Accounts
    @GET("api/inventory/accounts")
    suspend fun getServiceAccounts(
        @Query("product_id") productId: String? = null,
        @Query("status") status: String? = null
    ): Response<ServiceAccountsResponse>

    @GET("api/inventory/accounts/{id}/profiles")
    suspend fun getAccountProfiles(
        @Path("id") accountId: String
    ): Response<ServiceProfilesResponse>

    @POST("api/inventory/accounts/{id}/reveal-credentials")
    suspend fun revealCredentials(
        @Path("id") accountId: String
    ): Response<RevealCredentialResponse>

    // Inventory - License Keys
    @GET("api/inventory/licenses")
    suspend fun getLicenseKeys(
        @Query("product_id") productId: String? = null,
        @Query("status") status: String? = null
    ): Response<LicenseKeysResponse>

    @POST("api/inventory/accounts")
    suspend fun createServiceAccount(
        @Body req: CreateServiceAccountRequest
    ): Response<SimpleActionResponse>

    @PUT("api/inventory/accounts/{id}")
    suspend fun updateServiceAccount(
        @Path("id") id: String,
        @Body req: UpdateServiceAccountRequest
    ): Response<SimpleActionResponse>

    @DELETE("api/inventory/accounts/{id}")
    suspend fun deleteServiceAccount(
        @Path("id") id: String
    ): Response<SimpleActionResponse>

    @PUT("api/inventory/profiles/{id}")
    suspend fun updateServiceProfile(
        @Path("id") id: String,
        @Body req: UpdateServiceProfileRequest
    ): Response<SimpleActionResponse>

    @POST("api/inventory/licenses")
    suspend fun addLicenses(
        @Body req: AddLicensesRequest
    ): Response<AddLicensesResponse>

    @DELETE("api/inventory/licenses/{id}")
    suspend fun deleteLicense(
        @Path("id") id: String
    ): Response<SimpleActionResponse>
}
