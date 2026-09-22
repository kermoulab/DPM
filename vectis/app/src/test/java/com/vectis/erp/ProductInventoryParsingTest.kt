package com.vectis.erp

import com.google.gson.Gson
import com.vectis.erp.data.model.*
import org.junit.Assert.*
import org.junit.Test

class ProductInventoryParsingTest {

    private val gson = Gson()

    @Test
    fun testProductsResponseParsing() {
        val json = """
            {
                "products": [
                    {
                        "id": "prod-1",
                        "name": "Netflix 4K UHD",
                        "slug": "netflix-4k-uhd",
                        "capabilities": ["subscription", "service_account", "profiles"],
                        "fulfillment_type": "automatic",
                        "status": "active",
                        "plan_count": 3,
                        "available_inventory": 4,
                        "in_stock": true
                    },
                    {
                        "id": "prod-2",
                        "name": "Windows 11 Pro Retail",
                        "slug": "windows-11-pro",
                        "capabilities": ["license_key"],
                        "fulfillment_type": "automatic",
                        "status": "active",
                        "plan_count": 1,
                        "available_inventory": 10,
                        "in_stock": true
                    }
                ]
            }
        """.trimIndent()

        val response = gson.fromJson(json, ProductsResponse::class.java)

        assertNotNull(response)
        assertEquals(2, response.products.size)

        val netflix = response.products[0]
        assertEquals("Netflix 4K UHD", netflix.name)
        assertTrue(netflix.isSubscription)
        assertTrue(netflix.isServiceAccount)
        assertFalse(netflix.isLicenseKey)
        assertEquals(4, netflix.availableInventory)
        assertTrue(netflix.inStock)

        val win11 = response.products[1]
        assertEquals("Windows 11 Pro Retail", win11.name)
        assertFalse(win11.isSubscription)
        assertFalse(win11.isServiceAccount)
        assertTrue(win11.isLicenseKey)
        assertEquals(10, win11.availableInventory)
    }

    @Test
    fun testServiceAccountsAndProfilesParsing() {
        val accountJson = """
            {
                "accounts": [
                    {
                        "id": "sa-1",
                        "product_id": "prod-1",
                        "provider": "Netflix",
                        "login": "master_nf_1@vectis.ma",
                        "masked_credential": "••••••••",
                        "capacity": 5,
                        "active_profiles_count": 3,
                        "available_profiles_count": 2,
                        "status": "active"
                    }
                ]
            }
        """.trimIndent()

        val accResponse = gson.fromJson(accountJson, ServiceAccountsResponse::class.java)
        assertNotNull(accResponse)
        assertEquals(1, accResponse.accounts.size)
        val acc = accResponse.accounts[0]
        assertEquals("master_nf_1@vectis.ma", acc.login)
        assertEquals(5, acc.capacity)
        assertEquals(3, acc.activeProfilesCount)

        val profilesJson = """
            {
                "profiles": [
                    {
                        "id": "sp-1",
                        "service_account_id": "sa-1",
                        "profile_name": "Profile 1",
                        "pin": "1234",
                        "status": "assigned",
                        "assigned_customer_name": "Alice Wonderland"
                    },
                    {
                        "id": "sp-2",
                        "service_account_id": "sa-1",
                        "profile_name": "Profile 2",
                        "pin": null,
                        "status": "available"
                    }
                ]
            }
        """.trimIndent()

        val profResponse = gson.fromJson(profilesJson, ServiceProfilesResponse::class.java)
        assertNotNull(profResponse)
        assertEquals(2, profResponse.profiles.size)
        assertEquals("Profile 1", profResponse.profiles[0].profileName)
        assertEquals("1234", profResponse.profiles[0].pin)
        assertEquals("assigned", profResponse.profiles[0].status)
        assertEquals("Alice Wonderland", profResponse.profiles[0].assignedCustomerName)
        assertEquals("available", profResponse.profiles[1].status)
    }

    @Test
    fun testLicenseKeysParsing() {
        val json = """
            {
                "licenses": [
                    {
                        "id": "lic-1",
                        "product_id": "prod-2",
                        "product_name": "Windows 11 Pro Retail",
                        "license_key": "W269N-WFGWX-YVC9B-4J6C9-T83GX",
                        "status": "available",
                        "expiry_date": null
                    }
                ]
            }
        """.trimIndent()

        val response = gson.fromJson(json, LicenseKeysResponse::class.java)
        assertNotNull(response)
        assertEquals(1, response.licenses.size)
        assertEquals("W269N-WFGWX-YVC9B-4J6C9-T83GX", response.licenses[0].licenseKey)
        assertEquals("available", response.licenses[0].status)
    }

    @Test
    fun testRevealCredentialParsing() {
        val json = """
            {
                "login": "netflix_host@vectis.ma",
                "password": "SuperSecretPassword123!",
                "provider": "Netflix"
            }
        """.trimIndent()

        val response = gson.fromJson(json, RevealCredentialResponse::class.java)
        assertNotNull(response)
        assertEquals("netflix_host@vectis.ma", response.login)
        assertEquals("SuperSecretPassword123!", response.password)
        assertEquals("Netflix", response.provider)
    }

    @Test
    fun testCategoriesParsing() {
        val json = """
            {
                "categories": [
                    {
                        "id": "cat-streaming",
                        "name": "Streaming",
                        "slug": "streaming",
                        "icon": "Tv",
                        "description": "Video and music streaming services",
                        "status": "active"
                    },
                    {
                        "id": "cat-software",
                        "name": "Software & OS",
                        "slug": "software-os",
                        "icon": "Cpu",
                        "description": "Operating systems and software licenses",
                        "status": "active"
                    }
                ]
            }
        """.trimIndent()

        val response = gson.fromJson(json, CategoriesResponse::class.java)
        assertNotNull(response)
        assertEquals(2, response.categories.size)
        assertEquals("Streaming", response.categories[0].name)
        assertEquals("cat-software", response.categories[1].id)
    }

    @Test
    fun testProductAndPlanRequestsSerialization() {
        val prodReq = CreateProductRequest(
            categoryId = "cat-streaming",
            name = "Spotify Premium",
            brand = "Spotify",
            description = "High fidelity music streaming",
            capabilities = listOf("subscription", "service_account"),
            fulfillmentType = "automatic"
        )
        val prodJson = gson.toJson(prodReq)
        assertTrue(prodJson.contains("Spotify Premium"))
        assertTrue(prodJson.contains("cat-streaming"))
        assertTrue(prodJson.contains("service_account"))

        val planReq = CreatePlanRequest(
            productId = "prod-spotify",
            name = "3 Months Family",
            duration = 3,
            durationUnit = "months",
            price = 29.99,
            cost = 15.00,
            currency = "USD"
        )
        val planJson = gson.toJson(planReq)
        assertTrue(planJson.contains("3 Months Family"))
        assertTrue(planJson.contains("29.99"))
        assertTrue(planJson.contains("months"))

        val actionJson = """{"success":true,"message":"Plan deleted successfully"}"""
        val action = gson.fromJson(actionJson, SimpleActionResponse::class.java)
        assertTrue(action.success)
        assertEquals("Plan deleted successfully", action.message)
    }

    @Test
    fun testServiceAccountRequestsSerialization() {
        val createReq = CreateServiceAccountRequest(
            productId = "prod-netflix",
            provider = "Netflix",
            login = "test_nf@vectis.ma",
            password = "SecretPassword123!",
            capacity = 5,
            expiryDate = "2026-12-31",
            notes = "Test account",
            createProfiles = true
        )
        val createJson = gson.toJson(createReq)
        assertTrue(createJson.contains("test_nf@vectis.ma"))
        assertTrue(createJson.contains("SecretPassword123!"))
        assertTrue(createJson.contains("\"capacity\":5"))
        assertTrue(createJson.contains("\"create_profiles\":true"))

        val updateReq = UpdateServiceAccountRequest(
            provider = "Netflix Premium",
            capacity = 4,
            status = "exhausted"
        )
        val updateJson = gson.toJson(updateReq)
        assertTrue(updateJson.contains("Netflix Premium"))
        assertTrue(updateJson.contains("exhausted"))
    }

    @Test
    fun testProfileAndLicenseRequestsSerialization() {
        val profileReq = UpdateServiceProfileRequest(
            profileName = "VIP Profile",
            pin = "9988",
            status = "available"
        )
        val profileJson = gson.toJson(profileReq)
        assertTrue(profileJson.contains("VIP Profile"))
        assertTrue(profileJson.contains("9988"))

        val licenseReq = AddLicensesRequest(
            productId = "prod-win11",
            keys = listOf("KEY1-AAAA-BBBB", "KEY2-CCCC-DDDD"),
            expiryDate = "2027-01-01",
            notes = "Batch 1"
        )
        val licJson = gson.toJson(licenseReq)
        assertTrue(licJson.contains("KEY1-AAAA-BBBB"))
        assertTrue(licJson.contains("KEY2-CCCC-DDDD"))
        assertTrue(licJson.contains("Batch 1"))

        val licResJson = """{"success":true,"added":2,"duplicate":0,"total":2}"""
        val licRes = gson.fromJson(licResJson, AddLicensesResponse::class.java)
        assertTrue(licRes.success)
        assertEquals(2, licRes.added)
        assertEquals(0, licRes.duplicate)
    }
}
