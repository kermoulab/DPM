package com.vectis.erp.data.model

import com.google.gson.annotations.SerializedName

data class SearchResultDto(
    @SerializedName("id") val id: String,
    @SerializedName("title") val title: String,
    @SerializedName("subtitle") val subtitle: String,
    @SerializedName("type") val type: String,
    @SerializedName("route") val route: String
)

data class SearchResponse(
    @SerializedName("results") val results: List<SearchResultDto> = emptyList()
)
