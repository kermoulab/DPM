package com.vectis.erp.data.model

import com.google.gson.annotations.SerializedName

data class ProductDto(
    @SerializedName("id") val id: String,
    @SerializedName("name") val name: String,
    @SerializedName("slug") val slug: String? = null,
    @SerializedName("category_id") val categoryId: String? = null,
    @SerializedName("brand") val brand: String? = null,
    @SerializedName("description") val description: String? = null,
    @SerializedName("capabilities") val capabilities: List<String> = emptyList(),
    @SerializedName("fulfillment_type") val fulfillmentType: String = "automatic",
    @SerializedName("status") val status: String = "active",
    @SerializedName("icon") val icon: String? = null,
    @SerializedName("image_url") val imageUrl: String? = null,
    @SerializedName("plan_count") val planCount: Int = 0,
    @SerializedName("available_inventory") val availableInventory: Int = 0,
    @SerializedName("in_stock") val inStock: Boolean = true
) {
    val isSubscription: Boolean
        get() = capabilities.contains("subscription")

    val isServiceAccount: Boolean
        get() = capabilities.contains("service_account") || capabilities.contains("profiles")

    val isLicenseKey: Boolean
        get() = capabilities.contains("license_key")

    val isDigitalFile: Boolean
        get() = capabilities.contains("digital_file") || capabilities.contains("file_download")
}

data class ProductsResponse(
    @SerializedName("products") val products: List<ProductDto> = emptyList()
)

data class InventorySummaryDto(
    @SerializedName("available") val available: Int = 0,
    @SerializedName("total") val total: Int = 0
)

data class ProductDetailResponse(
    @SerializedName("product") val product: ProductDto,
    @SerializedName("plans") val plans: List<PlanDto> = emptyList(),
    @SerializedName("inventorySummary") val inventorySummary: InventorySummaryDto? = null
)

data class PlanDto(
    @SerializedName("id") val id: String,
    @SerializedName("product_id") val productId: String,
    @SerializedName("name") val name: String,
    @SerializedName("duration") val duration: Int,
    @SerializedName("duration_unit") val durationUnit: String = "months",
    @SerializedName("price") val price: Double = 0.0,
    @SerializedName("cost") val cost: Double = 0.0,
    @SerializedName("currency") val currency: String = "MAD",
    @SerializedName("status") val status: String = "active",
    @SerializedName("stock_limit") val stockLimit: Int? = null
)

data class PlansResponse(
    @SerializedName("plans") val plans: List<PlanDto> = emptyList()
)

data class ServiceAccountDto(
    @SerializedName("id") val id: String,
    @SerializedName("product_id") val productId: String,
    @SerializedName("product_name") val productName: String? = null,
    @SerializedName("provider") val provider: String,
    @SerializedName("login") val login: String,
    @SerializedName("masked_credential") val maskedCredential: String? = "••••••••",
    @SerializedName("capacity") val capacity: Int = 1,
    @SerializedName("active_profiles_count") val activeProfilesCount: Int = 0,
    @SerializedName("available_profiles_count") val availableProfilesCount: Int = 0,
    @SerializedName("status") val status: String = "active",
    @SerializedName("expiry_date") val expiryDate: String? = null,
    @SerializedName("notes") val notes: String? = null
)

data class ServiceAccountsResponse(
    @SerializedName("accounts") val accounts: List<ServiceAccountDto> = emptyList()
)

data class ServiceProfileDto(
    @SerializedName("id") val id: String,
    @SerializedName("service_account_id") val serviceAccountId: String,
    @SerializedName("profile_name") val profileName: String,
    @SerializedName("pin") val pin: String? = null,
    @SerializedName("status") val status: String = "available",
    @SerializedName("assigned_customer_id") val assignedCustomerId: String? = null,
    @SerializedName("assigned_customer_name") val assignedCustomerName: String? = null,
    @SerializedName("assigned_order_id") val assignedOrderId: String? = null
)

data class ServiceProfilesResponse(
    @SerializedName("profiles") val profiles: List<ServiceProfileDto> = emptyList()
)

data class LicenseKeyDto(
    @SerializedName("id") val id: String,
    @SerializedName("product_id") val productId: String,
    @SerializedName("product_name") val productName: String? = null,
    @SerializedName("license_key") val licenseKey: String,
    @SerializedName("status") val status: String = "available",
    @SerializedName("expiry_date") val expiryDate: String? = null,
    @SerializedName("notes") val notes: String? = null,
    @SerializedName("assigned_order_id") val assignedOrderId: String? = null,
    @SerializedName("assigned_customer_name") val assignedCustomerName: String? = null
)

data class LicenseKeysResponse(
    @SerializedName("licenses") val licenses: List<LicenseKeyDto> = emptyList()
)

data class RevealCredentialResponse(
    @SerializedName("login") val login: String,
    @SerializedName("password") val password: String,
    @SerializedName("provider") val provider: String? = null
)

data class CategoryDto(
    @SerializedName("id") val id: String,
    @SerializedName("name") val name: String,
    @SerializedName("slug") val slug: String,
    @SerializedName("icon") val icon: String? = null,
    @SerializedName("description") val description: String? = null,
    @SerializedName("status") val status: String = "active"
)

data class CategoriesResponse(
    @SerializedName("categories") val categories: List<CategoryDto> = emptyList()
)

data class CreateCategoryRequest(
    @SerializedName("name") val name: String,
    @SerializedName("icon") val icon: String? = "Folder",
    @SerializedName("description") val description: String? = null
)

data class CategoryResponse(
    @SerializedName("success") val success: Boolean = true,
    @SerializedName("id") val id: String,
    @SerializedName("name") val name: String,
    @SerializedName("slug") val slug: String
)

data class CreateProductRequest(
    @SerializedName("category_id") val categoryId: String,
    @SerializedName("name") val name: String,
    @SerializedName("brand") val brand: String? = null,
    @SerializedName("description") val description: String? = null,
    @SerializedName("capabilities") val capabilities: List<String> = listOf("subscription"),
    @SerializedName("fulfillment_type") val fulfillmentType: String = "automatic",
    @SerializedName("stock_limit") val stockLimit: Int? = null
)

data class UpdateProductRequest(
    @SerializedName("category_id") val categoryId: String? = null,
    @SerializedName("name") val name: String? = null,
    @SerializedName("brand") val brand: String? = null,
    @SerializedName("description") val description: String? = null,
    @SerializedName("capabilities") val capabilities: List<String>? = null,
    @SerializedName("fulfillment_type") val fulfillmentType: String? = null,
    @SerializedName("status") val status: String? = null,
    @SerializedName("stock_limit") val stockLimit: Int? = null
)

data class CreatePlanRequest(
    @SerializedName("product_id") val productId: String,
    @SerializedName("name") val name: String,
    @SerializedName("duration") val duration: Int,
    @SerializedName("duration_unit") val durationUnit: String = "months",
    @SerializedName("price") val price: Double,
    @SerializedName("cost") val cost: Double = 0.0,
    @SerializedName("currency") val currency: String = "USD",
    @SerializedName("stock_limit") val stockLimit: Int? = null
)

data class PlanResponse(
    @SerializedName("success") val success: Boolean = true,
    @SerializedName("id") val id: String,
    @SerializedName("plan") val plan: PlanDto? = null
)

data class SimpleActionResponse(
    @SerializedName("success") val success: Boolean = true,
    @SerializedName("message") val message: String? = null,
    @SerializedName("error") val error: String? = null
)
