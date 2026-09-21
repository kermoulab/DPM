package com.vectis.erp

import com.google.gson.Gson
import com.vectis.erp.data.model.DashboardStatsDto
import org.junit.Assert.*
import org.junit.Test

/**
 * DashboardParsingTest - Verifies that dashboard stats JSON matches backend contracts
 */
class DashboardParsingTest {

    private val gson = Gson()

    @Test
    fun testDashboardStatsParsing() {
        val json = """
            {
              "financial": {
                "totalRevenue": 15420.50,
                "totalCost": 6210.00,
                "grossProfit": 9210.50,
                "profitMargin": 59.7,
                "revenueToday": 450.00,
                "revenueThisMonth": 4820.00,
                "revenueGrowth": 22.0
              },
              "customers": {
                "total": 342,
                "active": 310,
                "blocked": 4,
                "newThisMonth": 28,
                "growthRate": 8.9
              },
              "orders": {
                "total": 520,
                "active": 410,
                "expiring": 18,
                "expired": 82,
                "cancelled": 10
              },
              "inventory": {
                "stockStatus": 84,
                "turnoverRate": 72,
                "productsOrdered": 91,
                "totalProfiles": 180,
                "availableProfiles": 38,
                "assignedProfiles": 142
              },
              "recentOrders": [
                {
                  "id": "ord_101",
                  "order_number": "ORD-1049",
                  "product_name": "Netflix 4K UHD",
                  "plan_name": "1 Month Private Profile",
                  "status": "active",
                  "start_date": "2026-09-20",
                  "end_date": "2026-10-20",
                  "price": 4.50,
                  "currency": "USD"
                }
              ],
              "topProducts": [
                {
                  "id": "prod_1",
                  "name": "Netflix Premium",
                  "orderCount": 184,
                  "totalRevenue": 2450.00
                }
              ]
            }
        """.trimIndent()

        val stats = gson.fromJson(json, DashboardStatsDto::class.java)
        assertNotNull(stats)
        assertEquals(15420.50, stats.financial.totalRevenue, 0.01)
        assertEquals(410, stats.orders.active)
        assertEquals(18, stats.orders.expiring)
        assertEquals(38, stats.inventory.availableProfiles)
        assertEquals(1, stats.recentOrders.size)
        assertEquals("Netflix 4K UHD", stats.recentOrders[0].productName)
        assertEquals("1 Month Private Profile", stats.recentOrders[0].planName)
        assertEquals(4.50, stats.recentOrders[0].price, 0.01)
    }
}
