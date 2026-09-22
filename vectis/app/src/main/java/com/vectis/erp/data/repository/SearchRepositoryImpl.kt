package com.vectis.erp.data.repository

import com.vectis.erp.core.network.ApiResult
import com.vectis.erp.core.network.NetworkClient
import com.vectis.erp.data.api.SearchApiService
import com.vectis.erp.data.model.SearchResponse
import com.vectis.erp.domain.repository.SearchRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class SearchRepositoryImpl(
    private val networkClient: NetworkClient
) : SearchRepository {

    override suspend fun search(query: String): ApiResult<SearchResponse> = withContext(Dispatchers.IO) {
        try {
            val api = networkClient.createService<SearchApiService>()
            val response = api.search(query)
            if (response.isSuccessful && response.body() != null) {
                ApiResult.Success(response.body()!!)
            } else {
                ApiResult.Error(response.code(), "Search query failed (${response.code()})")
            }
        } catch (e: Exception) {
            ApiResult.NetworkError(e)
        }
    }
}
