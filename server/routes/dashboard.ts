import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth, type AuthenticatedRequest } from '../security.js';

export const dashboardRouter = Router();

dashboardRouter.get('/stats', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const currentMonthPrefix = now.toISOString().slice(0, 7);

    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthPrefix = prevMonthDate.toISOString().slice(0, 7);

    // 1. Revenue & Costs
    const revenueRow = db.prepare(`
      SELECT 
        COALESCE(SUM(price), 0) as totalRevenue,
        COALESCE(SUM(cost), 0) as totalCost,
        COUNT(*) as totalOrders
      FROM orders
      WHERE payment_status = 'paid'
    `).get() as any;

    const renewalsRow = db.prepare(`
      SELECT 
        COALESCE(SUM(price), 0) as totalRenewalRevenue,
        COALESCE(SUM(cost), 0) as totalRenewalCost,
        COUNT(*) as totalRenewals
      FROM order_renewals
    `).get() as any;

    const totalRev = (revenueRow?.totalRevenue || 0) + (renewalsRow?.totalRenewalRevenue || 0);
    const totalCost = (revenueRow?.totalCost || 0) + (renewalsRow?.totalRenewalCost || 0);
    const grossProfit = totalRev - totalCost;
    const profitMargin = totalRev > 0 ? ((grossProfit / totalRev) * 100).toFixed(1) : '0';

    // Revenue Today
    const todayRow = db.prepare(`
      SELECT COALESCE(SUM(price), 0) as revToday
      FROM orders
      WHERE payment_status = 'paid' AND start_date LIKE ?
    `).get(`${todayStr}%`) as any;

    // Revenue This Month
    const thisMonthRow = db.prepare(`
      SELECT COALESCE(SUM(price), 0) as revThisMonth
      FROM orders
      WHERE payment_status = 'paid' AND start_date LIKE ?
    `).get(`${currentMonthPrefix}%`) as any;

    // Revenue Last Month
    const prevMonthRow = db.prepare(`
      SELECT COALESCE(SUM(price), 0) as revPrevMonth
      FROM orders
      WHERE payment_status = 'paid' AND start_date LIKE ?
    `).get(`${prevMonthPrefix}%`) as any;

    // 2. Customers
    const customerStats = db.prepare(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active,
        COUNT(CASE WHEN status = 'blocked' THEN 1 END) as blocked,
        COUNT(CASE WHEN status = 'inactive' THEN 1 END) as inactive,
        COUNT(CASE WHEN status = 'inactive' OR status = 'blocked' THEN 1 END) as inactiveOrBlocked,
        COUNT(CASE WHEN created_at LIKE ? THEN 1 END) as thisMonth
      FROM customers
    `).get(`${currentMonthPrefix}%`) as any;

    // 3. Orders by Status (Exact DB calculation)
    const orderStatuses = db.prepare(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN (status = 'active' AND (end_date IS NULL OR end_date > date('now', '+3 days'))) THEN 1 END) as active,
        COUNT(CASE WHEN (status = 'expiring' OR (status = 'active' AND end_date >= date('now') AND end_date <= date('now', '+3 days'))) THEN 1 END) as expiring,
        COUNT(CASE WHEN (status = 'expired' OR (end_date IS NOT NULL AND end_date < date('now'))) THEN 1 END) as expired,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled
      FROM orders
    `).get() as any;

    const totalOrdersCount = orderStatuses?.total || 0;
    const activeOrdersCount = orderStatuses?.active || 0;
    const expiringOrdersCount = orderStatuses?.expiring || 0;
    const expiredOrdersCount = orderStatuses?.expired || 0;

    const activePercent = totalOrdersCount > 0 ? Math.round((activeOrdersCount / totalOrdersCount) * 100) : 0;
    const expiringPercent = totalOrdersCount > 0 ? Math.round((expiringOrdersCount / totalOrdersCount) * 100) : 0;
    const expiredPercent = totalOrdersCount > 0 ? Math.max(0, 100 - activePercent - expiringPercent) : 0;

    // 4. Inventory counts
    const accountsCount = db.prepare("SELECT COUNT(*) as count FROM service_accounts WHERE status = 'active'").get() as any;
    const availableProfiles = db.prepare("SELECT COUNT(*) as count FROM service_profiles WHERE status = 'available'").get() as any;
    const availableLicenses = db.prepare("SELECT COUNT(*) as count FROM license_keys WHERE status = 'available'").get() as any;
    const totalInventoryAvailable = (availableProfiles?.count || 0) + (availableLicenses?.count || 0);

    // 5. Monthly Orders & Profit breakdown for the last 2 years (Real DB Activity)
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentYear = now.getFullYear();
    const last2Years = [currentYear - 1, currentYear]; // Last 2 years e.g. [2025, 2026]

    const getYearOverview = (targetYear: number) => {
      return monthNames.map((month, idx) => {
        const mStr = String(idx + 1).padStart(2, '0');
        const prefix = `${targetYear}-${mStr}`;
        
        // Orders created or starting in this month
        const mRow = db.prepare(`
          SELECT 
            COUNT(*) as orderCount,
            COALESCE(SUM(price - cost), 0) as profit,
            COALESCE(SUM(price), 0) as revenue
          FROM orders
          WHERE (start_date LIKE ? OR (start_date IS NULL AND created_at LIKE ?))
        `).get(`${prefix}%`, `${prefix}%`) as any;

        // Renewals in this month
        const rRow = db.prepare(`
          SELECT 
            COUNT(*) as renewalCount,
            COALESCE(SUM(price - cost), 0) as renewalProfit,
            COALESCE(SUM(price), 0) as renewalRevenue
          FROM order_renewals
          WHERE (created_at LIKE ? OR new_end_date LIKE ?)
        `).get(`${prefix}%`, `${prefix}%`) as any;

        const orderCount = (mRow?.orderCount || 0) + (rRow?.renewalCount || 0);
        const profit = Math.round(((mRow?.profit || 0) + (rRow?.renewalProfit || 0)) * 100) / 100;
        const revenue = Math.round(((mRow?.revenue || 0) + (rRow?.renewalRevenue || 0)) * 100) / 100;

        return {
          month,
          orders: orderCount,
          profit,
          revenue
        };
      });
    };

    const ordersOverviewByYear: Record<string, Array<{ month: string; orders: number; profit: number; revenue: number }>> = {};
    for (const yr of last2Years) {
      ordersOverviewByYear[String(yr)] = getYearOverview(yr);
    }

    const requestedYear = req.query.year ? parseInt(String(req.query.year), 10) : currentYear;
    const ordersOverview = ordersOverviewByYear[String(requestedYear)] || getYearOverview(requestedYear);

    // 6. Category Analytics (Max 5 categories ordered high to low by total volume/sales with distinct colors)
    const categoryColors = [
      '#6366F1', // Indigo / Blue
      '#EC4899', // Rose / Pink
      '#10B981', // Emerald / Green
      '#F59E0B', // Amber / Orange
      '#8B5CF6'  // Purple / Violet
    ];

    const topCats = db.prepare(`
      SELECT 
        c.id,
        c.name,
        COUNT(o.id) as totalOrders,
        COALESCE(SUM(o.price), 0) as totalRevenue
      FROM categories c
      LEFT JOIN products p ON p.category_id = c.id
      LEFT JOIN orders o ON o.product_id = p.id
      GROUP BY c.id, c.name
      ORDER BY totalOrders DESC, totalRevenue DESC
      LIMIT 5
    `).all() as any[];

    const sumCategoryOrders = topCats.reduce((acc, c) => acc + (c.totalOrders || 0), 0) || 1;

    const topCategories = topCats.map((cat, idx) => ({
      id: cat.id,
      name: cat.name,
      totalOrders: cat.totalOrders || 0,
      totalRevenue: Math.round((cat.totalRevenue || 0) * 100) / 100,
      percentage: Math.round(((cat.totalOrders || 0) / sumCategoryOrders) * 100),
      color: categoryColors[idx % categoryColors.length]
    }));

    const monthlyTrendsByYear: Record<string, Array<{
      month: string;
      byCategory: Record<string, { orders: number; revenue: number }>;
      totalOrders: number;
      totalRevenue: number;
    }>> = {};

    for (const yr of last2Years) {
      monthlyTrendsByYear[String(yr)] = monthNames.map((month, idx) => {
        const mStr = String(idx + 1).padStart(2, '0');
        const prefix = `${yr}-${mStr}`;

        const byCategory: Record<string, { orders: number; revenue: number }> = {};
        let monthTotalOrders = 0;
        let monthTotalRevenue = 0;

        for (const cat of topCategories) {
          const oRow = db.prepare(`
            SELECT COUNT(*) as count, COALESCE(SUM(o.price), 0) as rev
            FROM orders o
            JOIN products p ON o.product_id = p.id
            WHERE p.category_id = ? AND (o.start_date LIKE ? OR (o.start_date IS NULL AND o.created_at LIKE ?))
          `).get(cat.id, `${prefix}%`, `${prefix}%`) as any;

          const rRow = db.prepare(`
            SELECT COUNT(*) as count, COALESCE(SUM(r.price), 0) as rev
            FROM order_renewals r
            JOIN orders o ON r.order_id = o.id
            JOIN products p ON o.product_id = p.id
            WHERE p.category_id = ? AND (r.created_at LIKE ? OR r.new_end_date LIKE ?)
          `).get(cat.id, `${prefix}%`, `${prefix}%`) as any;

          const catOrders = (oRow?.count || 0) + (rRow?.count || 0);
          const catRevenue = Math.round(((oRow?.rev || 0) + (rRow?.rev || 0)) * 100) / 100;

          byCategory[cat.id] = {
            orders: catOrders,
            revenue: catRevenue
          };

          monthTotalOrders += catOrders;
          monthTotalRevenue += catRevenue;
        }

        return {
          month,
          byCategory,
          totalOrders: monthTotalOrders,
          totalRevenue: Math.round(monthTotalRevenue * 100) / 100
        };
      });
    }

    const categoryAnalytics = {
      topCategories,
      monthlyTrendsByYear
    };

    // 7. Purchase Analytics (monthly summary)
    const purchaseAnalytics = monthNames.map((month, idx) => {
      const trendForYr = monthlyTrendsByYear[String(requestedYear)];
      const monthData = trendForYr ? trendForYr[idx] : null;
      return {
        month,
        sold: monthData?.totalOrders || 0,
        purchased: Math.round((monthData?.totalRevenue || 0) * 10) / 10
      };
    });

    // 7. Top Selling Products
    const topProducts = db.prepare(`
      SELECT 
        p.id,
        p.name,
        p.slug,
        p.brand,
        p.icon,
        p.fulfillment_type,
        COUNT(o.id) as orderCount,
        COALESCE(SUM(o.price), 0) as totalRevenue
      FROM products p
      LEFT JOIN orders o ON o.product_id = p.id
      GROUP BY p.id
      ORDER BY orderCount DESC, totalRevenue DESC
      LIMIT 6
    `).all() as any[];

    // 8. Dynamic Intelligent suggestions
    const suggestions = [];

    // Expiring orders needing attention
    const expiringSoon = db.prepare(`
      SELECT o.id, o.order_number, c.name as customer_name, c.whatsapp, p.name as product_name, o.end_date
      FROM orders o
      JOIN customers c ON c.id = o.customer_id
      JOIN products p ON p.id = o.product_id
      WHERE o.status != 'cancelled' AND o.end_date >= date('now') AND o.end_date <= date('now', '+3 days')
      LIMIT 5
    `).all() as any[];

    if (expiringSoon.length > 0) {
      suggestions.push({
        type: 'warning',
        title: `${expiringSoon.length} Subscription(s) Expiring Soon`,
        description: `Customer orders expire in ≤3 days. Send WhatsApp renewal reminders now.`,
        actionText: 'View Expiring',
        actionRoute: 'alerts',
        items: expiringSoon
      });
    }

    if (totalInventoryAvailable < 5) {
      suggestions.push({
        type: 'alert',
        title: 'Low Stock Alert',
        description: `Only ${totalInventoryAvailable} license keys/profiles available across inventory. Restock to prevent fulfillment delays.`,
        actionText: 'Restock Inventory',
        actionRoute: 'inventory'
      });
    }

    if (topProducts.length > 0 && topProducts[0].orderCount > 0) {
      suggestions.push({
        type: 'opportunity',
        title: `Top Seller: ${topProducts[0].name}`,
        description: `Driving highest reseller volume with ${topProducts[0].orderCount} orders. Consider launching bundled promotions.`,
        actionText: 'View Product',
        actionRoute: 'products'
      });
    }

    // Revenue month-over-month growth (real calculation)
    const revThisMonth = thisMonthRow?.revThisMonth || 0;
    const revPrevMonth = prevMonthRow?.revPrevMonth || 0;
    const revenueGrowth = revPrevMonth > 0
      ? Math.round(((revThisMonth - revPrevMonth) / revPrevMonth) * 100 * 10) / 10
      : (revThisMonth > 0 ? 100 : 0);

    // Customer growth: new this month vs new last month
    const newCustomersLastMonth = db.prepare(`
      SELECT COUNT(*) as count FROM customers WHERE created_at LIKE ?
    `).get(`${prevMonthPrefix}%`) as any;
    const newThisMonth = customerStats?.thisMonth || 0;
    const newLastMonth = newCustomersLastMonth?.count || 0;
    const customerGrowthRate = newLastMonth > 0
      ? Math.round(((newThisMonth - newLastMonth) / newLastMonth) * 100 * 10) / 10
      : (newThisMonth > 0 ? 100 : 0);

    // Order growth: orders created this month vs last month
    const ordersThisMonth = db.prepare(`
      SELECT COUNT(*) as count FROM orders WHERE created_at LIKE ?
    `).get(`${currentMonthPrefix}%`) as any;
    const ordersLastMonth = db.prepare(`
      SELECT COUNT(*) as count FROM orders WHERE created_at LIKE ?
    `).get(`${prevMonthPrefix}%`) as any;
    const orderGrowthRate = (ordersLastMonth?.count || 0) > 0
      ? Math.round((((ordersThisMonth?.count || 0) - (ordersLastMonth?.count || 0)) / (ordersLastMonth?.count || 1)) * 100 * 10) / 10
      : ((ordersThisMonth?.count || 0) > 0 ? 100 : 0);

    // Sale analytics: computed from real order data
    const saleStatsRow = db.prepare(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN status IN ('active', 'completed') THEN 1 END) as completed,
        COUNT(CASE WHEN payment_status = 'refunded' THEN 1 END) as returned
      FROM orders
    `).get() as any;
    const totalOrders = saleStatsRow?.total || 0;
    const completedOrders = saleStatsRow?.completed || 0;
    const returnedOrders = saleStatsRow?.returned || 0;
    const totalCompletedRate = totalOrders > 0
      ? Math.round((completedOrders / totalOrders) * 100)
      : 0;

    res.json({
      financial: {
        totalRevenue: totalRev,
        totalCost,
        grossProfit,
        profitMargin: parseFloat(profitMargin),
        revenueToday: todayRow?.revToday || 0,
        revenueThisMonth: revThisMonth,
        revenuePrevMonth: revPrevMonth,
        revenueGrowth
      },
      customers: {
        total: customerStats?.total || 0,
        active: customerStats?.active || 0,
        blocked: customerStats?.blocked || 0,
        inactive: customerStats?.inactive || 0,
        inactiveOrBlocked: customerStats?.inactiveOrBlocked ?? ((customerStats?.inactive || 0) + (customerStats?.blocked || 0)),
        newThisMonth,
        growthRate: customerGrowthRate
      },
      orders: {
        total: totalOrdersCount,
        active: activeOrdersCount,
        expiring: expiringOrdersCount,
        expired: expiredOrdersCount,
        cancelled: orderStatuses?.cancelled || 0,
        activePercent,
        expiringPercent,
        expiredPercent,
        growthRate: orderGrowthRate
      },
      inventory: {
        stockStatus: totalInventoryAvailable,
        turnoverRate: totalOrdersCount, // Total orders processed = effective turnover metric
        productsOrdered: totalOrdersCount,
        serviceAccountsCount: accountsCount?.count || 0
      },
      saleAnalytics: {
        totalCompletedRate,
        completed: completedOrders,
        distributed: completedOrders,
        returned: returnedOrders
      },
      ordersOverview,
      ordersOverviewByYear,
      purchaseAnalytics,
      categoryAnalytics,
      topProducts,
      suggestions
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to compute dashboard analytics: ' + err.message });
  }
});
