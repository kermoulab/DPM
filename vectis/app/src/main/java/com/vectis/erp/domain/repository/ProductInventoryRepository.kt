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
}
