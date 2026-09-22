package com.vectis.erp.domain.repository

import com.vectis.erp.core.network.ApiResult
import com.vectis.erp.data.model.SearchResponse

interface SearchRepository {
    suspend fun search(query: String): ApiResult<SearchResponse>
}
