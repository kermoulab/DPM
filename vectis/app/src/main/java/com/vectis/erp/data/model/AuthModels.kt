package com.vectis.erp.data.model

import com.google.gson.annotations.SerializedName

/**
 * Request payload for POST /api/auth/login
 */
data class LoginRequest(
    @SerializedName("username")
    val username: String,

    @SerializedName("password")
    val password: String
)

/**
 * User data transfer object returned from backend
 */
data class UserDto(
    @SerializedName("id")
    val id: String,

    @SerializedName("username")
    val username: String,

    @SerializedName("email")
    val email: String = "",

    @SerializedName("name")
    val name: String = "",

    @SerializedName("role")
    val role: String,

    @SerializedName("status")
    val status: String = "active",

    @SerializedName("avatar")
    val avatar: String? = null,

    @SerializedName("preferred_currency")
    val preferredCurrency: String? = "USD"
)

/**
 * Response payload for POST /api/auth/login
 */
data class LoginResponse(
    @SerializedName("success")
    val success: Boolean = false,

    @SerializedName("token")
    val token: String? = null,

    @SerializedName("user")
    val user: UserDto? = null,

    @SerializedName("error")
    val error: String? = null
)

/**
 * Response payload for GET /api/auth/me
 */
data class MeResponse(
    @SerializedName("user")
    val user: UserDto? = null,

    @SerializedName("error")
    val error: String? = null
)

/**
 * Response payload for POST /api/auth/logout
 */
data class LogoutResponse(
    @SerializedName("success")
    val success: Boolean = false,

    @SerializedName("message")
    val message: String? = null,

    @SerializedName("error")
    val error: String? = null
)
