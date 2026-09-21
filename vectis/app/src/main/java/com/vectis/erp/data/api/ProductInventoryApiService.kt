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

    // Plans
    @GET("api/plans")
    suspend fun getPlans(
        @Query("product_id") productId: String? = null
    ): Response<PlansResponse>

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
}
