package com.vectis.erp.feature.search

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.vectis.erp.core.network.ApiResult
import com.vectis.erp.data.model.SearchResultDto
import com.vectis.erp.domain.repository.SearchRepository
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed interface SearchUiState {
    data object Idle : SearchUiState
    data object Loading : SearchUiState
    data class Success(val query: String, val results: List<SearchResultDto>) : SearchUiState
    data class Error(val message: String) : SearchUiState
}

class SearchViewModel(
    private val repository: SearchRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<SearchUiState>(SearchUiState.Idle)
    val uiState: StateFlow<SearchUiState> = _uiState.asStateFlow()

    private var searchJob: Job? = null

    fun onQueryChanged(newQuery: String) {
        searchJob?.cancel()
        val trimmed = newQuery.trim()
        if (trimmed.isEmpty()) {
            _uiState.value = SearchUiState.Idle
            return
        }

        searchJob = viewModelScope.launch {
            delay(250)
            _uiState.value = SearchUiState.Loading
            when (val res = repository.search(trimmed)) {
                is ApiResult.Success -> {
                    _uiState.value = SearchUiState.Success(trimmed, res.data.results)
                }
                is ApiResult.Error -> {
                    _uiState.value = SearchUiState.Error(res.message)
                }
                is ApiResult.NetworkError -> {
                    _uiState.value = SearchUiState.Error(res.exception.localizedMessage ?: "Network error")
                }
            }
        }
    }

    fun clear() {
        searchJob?.cancel()
        _uiState.value = SearchUiState.Idle
    }

    class Factory(
        private val repository: SearchRepository
    ) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            return SearchViewModel(repository) as T
        }
    }
}
