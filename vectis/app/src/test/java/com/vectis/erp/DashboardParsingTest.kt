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
                "inactive": 28,
                "newThisMonth": 28,
                "growthRate": 8.9,
                "monthly": [
                  { "month": "Jan", "count": 25 },
                  { "month": "Feb", "count": 42 }
                ]
              },
              "orders": {
                "total": 520,
                "active": 410,
                "expiring": 18,
                "expired": 82,
                "cancelled": 10,
                "activePercent": 79.0,
                "expiringPercent": 3.0,
                "expiredPercent": 16.0,
                "dailyOrders": [
                  { "day": "Mon", "count": 12 },
                  { "day": "Tue", "count": 19 }
                ]
              },
              "inventory": {
                "stockStatus": 84,
                "turnoverRate": 72,
                "productsOrdered": 91,
                "totalProfiles": 180,
                "availableProfiles": 38,
                "assignedProfiles": 142,
                "activeSubsPercent": 79.0
              },
              "categoryAnalytics": {
                "topCategories": [
                  { "id": "cat_1", "name": "Streaming", "totalOrders": 120, "totalRevenue": 1500.0, "percentage": 60, "color": "#3b82f6" }
                ],
                "monthlyTrendsByYear": {
                  "2026": [
                    {
                      "month": "Jan",
                      "totalOrders": 30,
                      "totalRevenue": 400.0,
                      "byCategory": {
                        "cat_1": { "orders": 30, "revenue": 400.0 }
                      }
                    }
                  ]
                }
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
        assertEquals(2, stats.orders.dailyOrders.size)
        assertEquals("Mon", stats.orders.dailyOrders[0].day)
        assertEquals(12, stats.orders.dailyOrders[0].count)
        assertEquals(28, stats.customers.inactive)
        assertEquals(2, stats.customers.monthly.size)
        assertEquals("Feb", stats.customers.monthly[1].month)
        assertEquals(42, stats.customers.monthly[1].count)
        assertEquals(79.0, stats.inventory.activeSubsPercent, 0.01)
        assertNotNull(stats.categoryAnalytics)
        assertEquals(1, stats.categoryAnalytics!!.topCategories.size)
        assertEquals("Streaming", stats.categoryAnalytics!!.topCategories[0].name)
        assertEquals(38, stats.inventory.availableProfiles)
        assertEquals(1, stats.recentOrders.size)
        assertEquals("Netflix 4K UHD", stats.recentOrders[0].productName)
        assertEquals("1 Month Private Profile", stats.recentOrders[0].planName)
        assertEquals(4.50, stats.recentOrders[0].price, 0.01)
    }
}
