import { query } from '../connection/pool.js';
import { ordersRepo } from './orders.repository.js';

export class DashboardRepository {
  async getStats(): Promise<any> {
    await ordersRepo.reconcileSubscriptionStatuses();

    // 1. Financial summary
    const revRes = await query<{ total_rev: string; total_cost: string }>(
      `SELECT COALESCE(SUM(price), 0)::text as total_rev,
              COALESCE(SUM(cost), 0)::text as total_cost
       FROM orders WHERE payment_status != 'refunded'`
    );
    const renewalsRes = await query<{ renewal_rev: string; renewal_cost: string }>(
      `SELECT COALESCE(SUM(price), 0)::text as renewal_rev,
              COALESCE(SUM(cost), 0)::text as renewal_cost
       FROM order_renewals`
    );

    const baseRev = parseFloat(revRes.rows[0]?.total_rev || '0');
    const baseCost = parseFloat(revRes.rows[0]?.total_cost || '0');
    const renRev = parseFloat(renewalsRes.rows[0]?.renewal_rev || '0');
    const renCost = parseFloat(renewalsRes.rows[0]?.renewal_cost || '0');

    const totalRevenue = baseRev + renRev;
    const totalCost = baseCost + renCost;
    const grossProfit = totalRevenue - totalCost;
    const profitMargin = totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(1) : '0.0';

    // 2. Today, this month, previous month revenue
    const todayRes = await query<{ rev: string }>(
      `SELECT COALESCE(SUM(price), 0)::text as rev
       FROM orders
       WHERE payment_status != 'refunded' AND start_date = CURRENT_DATE`
    );
    const thisMonthRes = await query<{ rev: string }>(
      `SELECT COALESCE(SUM(price), 0)::text as rev
       FROM orders
       WHERE payment_status != 'refunded'
         AND DATE_TRUNC('month', start_date::timestamp) = DATE_TRUNC('month', CURRENT_DATE::timestamp)`
    );
    const prevMonthRes = await query<{ rev: string }>(
      `SELECT COALESCE(SUM(price), 0)::text as rev
       FROM orders
       WHERE payment_status != 'refunded'
         AND DATE_TRUNC('month', start_date::timestamp) = DATE_TRUNC('month', CURRENT_DATE::timestamp - INTERVAL '1 month')`
    );

    const revThisMonth = parseFloat(thisMonthRes.rows[0]?.rev || '0');
    const revPrevMonth = parseFloat(prevMonthRes.rows[0]?.rev || '0');
    const revenueGrowth = revPrevMonth > 0
      ? Math.round(((revThisMonth - revPrevMonth) / revPrevMonth) * 100 * 10) / 10
      : (revThisMonth > 0 ? 100 : 0);

    // 3. Customer metrics
    const customerStats = await query<{ total: string; active: string; blocked: string; inactive: string; this_month: string }>(
      `SELECT COUNT(*)::text as total,
              COUNT(CASE WHEN status = 'active' THEN 1 END)::text as active,
              COUNT(CASE WHEN status = 'blocked' THEN 1 END)::text as blocked,
              COUNT(CASE WHEN status = 'inactive' THEN 1 END)::text as inactive,
              COUNT(CASE WHEN DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE::timestamp) THEN 1 END)::text as this_month
       FROM customers`
    );
    const prevMonthCustomers = await query<{ count: string }>(
      `SELECT COUNT(*)::text as count FROM customers
       WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE::timestamp - INTERVAL '1 month')`
    );
    const newThisMonthCust = parseInt(customerStats.rows[0]?.this_month || '0', 10);
    const newPrevMonthCust = parseInt(prevMonthCustomers.rows[0]?.count || '0', 10);
    const customerGrowthRate = newPrevMonthCust > 0
      ? Math.round(((newThisMonthCust - newPrevMonthCust) / newPrevMonthCust) * 100 * 10) / 10
      : (newThisMonthCust > 0 ? 100 : 0);

    // 3b. Customer registrations by month for last 8 months
    const last8Months: Array<{ label: string; yearMonth: string }> = [];
    for (let i = 7; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const mStr = d.toLocaleString('en-US', { month: 'short' });
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      last8Months.push({ label: mStr, yearMonth: ym });
    }
    const custMonthlyRes = await query<{ ym: string; cnt: string }>(
      `SELECT TO_CHAR(created_at, 'YYYY-MM') as ym,
              COUNT(*)::text as cnt
       FROM customers
       WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE::timestamp - INTERVAL '7 months')
       GROUP BY ym`
    );
    const custMap: Record<string, number> = {};
    for (const r of custMonthlyRes.rows) {
      custMap[r.ym] = parseInt(r.cnt, 10);
    }
    const customerMonthly = last8Months.map((m) => ({
      month: m.label,
      count: custMap[m.yearMonth] || 0
    }));

    // 4. Order status metrics
    const orderStatuses = await query<{ total: string; active: string; expiring: string; expired: string; cancelled: string }>(
      `SELECT COUNT(*)::text as total,
              COUNT(CASE WHEN status = 'active' THEN 1 END)::text as active,
              COUNT(CASE WHEN status = 'expiring' THEN 1 END)::text as expiring,
              COUNT(CASE WHEN status = 'expired' THEN 1 END)::text as expired,
              COUNT(CASE WHEN status = 'cancelled' THEN 1 END)::text as cancelled
       FROM orders`
    );
    const totalOrdersCount = parseInt(orderStatuses.rows[0]?.total || '0', 10);
    const activeOrdersCount = parseInt(orderStatuses.rows[0]?.active || '0', 10);
    const expiringOrdersCount = parseInt(orderStatuses.rows[0]?.expiring || '0', 10);
    const expiredOrdersCount = parseInt(orderStatuses.rows[0]?.expired || '0', 10);

    const activePercent = totalOrdersCount > 0 ? Math.round((activeOrdersCount / totalOrdersCount) * 100) : 0;
    const expiringPercent = totalOrdersCount > 0 ? Math.round((expiringOrdersCount / totalOrdersCount) * 100) : 0;
    const expiredPercent = totalOrdersCount > 0 ? Math.round((expiredOrdersCount / totalOrdersCount) * 100) : 0;

    // 4b. Daily orders for current week (Mon-Sun)
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const dailyOrdersRes = await query<{ dow: number; order_count: string }>(
      `SELECT EXTRACT(ISODOW FROM start_date)::int as dow,
              COUNT(*)::text as order_count
       FROM orders
       WHERE start_date >= DATE_TRUNC('week', CURRENT_DATE::timestamp)
         AND start_date < DATE_TRUNC('week', CURRENT_DATE::timestamp) + INTERVAL '7 days'
         AND payment_status != 'refunded'
       GROUP BY dow`
    );
    const dailyMap: Record<number, number> = {};
    for (const r of dailyOrdersRes.rows) {
      dailyMap[r.dow] = parseInt(r.order_count, 10);
    }
    const dailyOrders = dayNames.map((name, idx) => ({
      day: name,
      count: dailyMap[idx + 1] || 0
    }));

    // 5. Inventory summary (real DB calculations)
    const accountsCount = await query<{ count: string }>(
      "SELECT COUNT(*)::text as count FROM service_accounts WHERE status = 'active'"
    );
    const profilesStats = await query<{ total: string; available: string; assigned: string }>(
      `SELECT COUNT(*)::text as total,
              COUNT(CASE WHEN status = 'available' THEN 1 END)::text as available,
              COUNT(CASE WHEN status = 'assigned' THEN 1 END)::text as assigned
       FROM service_profiles`
    );
    const licensesStats = await query<{ total: string; available: string; assigned: string }>(
      `SELECT COUNT(*)::text as total,
              COUNT(CASE WHEN status = 'available' THEN 1 END)::text as available,
              COUNT(CASE WHEN status = 'assigned' THEN 1 END)::text as assigned
       FROM license_keys`
    );

    const totalProfiles = parseInt(profilesStats.rows[0]?.total || '0', 10);
    const availableProfiles = parseInt(profilesStats.rows[0]?.available || '0', 10);
    const assignedProfiles = parseInt(profilesStats.rows[0]?.assigned || '0', 10);

    const totalLicenses = parseInt(licensesStats.rows[0]?.total || '0', 10);
    const availableLicenses = parseInt(licensesStats.rows[0]?.available || '0', 10);
    const assignedLicenses = parseInt(licensesStats.rows[0]?.assigned || '0', 10);

    const totalInventory = totalProfiles + totalLicenses;
    const totalAvailable = availableProfiles + availableLicenses;
    const totalAssigned = assignedProfiles + assignedLicenses;

    // Stock Status % = available inventory items / total inventory items (0% if none)
    const stockStatus = totalInventory > 0
      ? Math.round((totalAvailable / totalInventory) * 100)
      : 0;

    // Turnover % = allocated/assigned items / total inventory items (0% if none)
    const turnoverRate = totalInventory > 0
      ? Math.round((totalAssigned / totalInventory) * 100)
      : 0;

    // Ordered % = active orders / total orders (0% if none)
    const productsOrdered = totalOrdersCount > 0
      ? Math.round((activeOrdersCount / totalOrdersCount) * 100)
      : 0;

    // Assigned Profiles % = assigned / total profiles (0% if none)
    const assignedProfilesPercent = totalProfiles > 0
      ? Math.round((assignedProfiles / totalProfiles) * 100)
      : 0;

    // Unallocated Keys % = available / total licenses (0% if none)
    const unallocatedKeysPercent = totalLicenses > 0
      ? Math.round((availableLicenses / totalLicenses) * 100)
      : 0;

    // 6. Sale analytics
    const saleStatsRow = await query<{ total: string; completed: string; returned: string }>(
      `SELECT COUNT(*)::text as total,
              COUNT(CASE WHEN status IN ('active', 'completed') THEN 1 END)::text as completed,
              COUNT(CASE WHEN payment_status = 'refunded' THEN 1 END)::text as returned
       FROM orders`
    );
    const completedOrders = parseInt(saleStatsRow.rows[0]?.completed || '0', 10);
    const returnedOrders = parseInt(saleStatsRow.rows[0]?.returned || '0', 10);
    const totalCompletedRate = totalOrdersCount > 0 ? Math.round((completedOrders / totalOrdersCount) * 100) : 0;

    // 7. Top products
    const topProducts = await query<any>(
      `SELECT p.id, p.name, COALESCE(p.slug, LOWER(REPLACE(p.name, ' ', '-'))) as slug,
              p.brand, p.icon, p.fulfillment_type,
              COUNT(o.id)::int as "orderCount",
              COUNT(o.id)::int as sales_count,
              COALESCE(SUM(o.price), 0)::float as "totalRevenue",
              COALESCE(SUM(o.price), 0)::float as revenue
       FROM products p
       LEFT JOIN orders o ON o.product_id = p.id AND o.payment_status != 'refunded'
       GROUP BY p.id
       ORDER BY "orderCount" DESC, "totalRevenue" DESC, p.name ASC
       LIMIT 20`
    );

    // 8. Orders overview by year & month (currentYear and currentYear - 1)
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentYear = new Date().getFullYear();
    const prevYear = currentYear - 1;
    const years = [prevYear, currentYear];

    const ordersOverviewByYear: Record<string, Array<{ month: string; orders: number; profit: number; revenue: number }>> = {};

    for (const yr of years) {
      const yearStr = String(yr);
      ordersOverviewByYear[yearStr] = [];

      const yearMonthlyRes = await query<{
        month_num: number;
        order_count: string;
        rev: string;
        cost: string;
      }>(
        `SELECT EXTRACT(MONTH FROM start_date)::int as month_num,
                COUNT(*)::text as order_count,
                COALESCE(SUM(price), 0)::text as rev,
                COALESCE(SUM(cost), 0)::text as cost
         FROM orders
         WHERE EXTRACT(YEAR FROM start_date)::int = $1
           AND payment_status != 'refunded'
         GROUP BY month_num`,
        [yr]
      );

      const mapByMonth: Record<number, { count: number; rev: number; cost: number }> = {};
      for (const r of yearMonthlyRes.rows) {
        mapByMonth[r.month_num] = {
          count: parseInt(r.order_count, 10),
          rev: parseFloat(r.rev),
          cost: parseFloat(r.cost)
        };
      }

      for (let m = 1; m <= 12; m++) {
        const item = mapByMonth[m] || { count: 0, rev: 0, cost: 0 };
        ordersOverviewByYear[yearStr].push({
          month: months[m - 1],
          orders: item.count,
          revenue: item.rev,
          profit: item.rev - item.cost
        });
      }
    }

    const ordersOverview = ordersOverviewByYear[String(currentYear)] || [];

    // 9. Category Analytics (Purchase Analytics - Monthly Category Trends)
    const categoryPalette = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4', '#64748b'];

    const catRowsRes = await query<{
      id: string;
      name: string;
      total_orders: string;
      total_revenue: string;
    }>(
      `SELECT c.id, c.name,
              COUNT(o.id)::text as total_orders,
              COALESCE(SUM(o.price), 0)::text as total_revenue
       FROM categories c
       LEFT JOIN products p ON p.category_id = c.id
       LEFT JOIN orders o ON o.product_id = p.id AND o.payment_status != 'refunded'
       GROUP BY c.id
       ORDER BY COUNT(o.id) DESC, COALESCE(SUM(o.price), 0) DESC, c.name ASC`
    );

    const grandTotalCatOrders = catRowsRes.rows.reduce(
      (sum, r) => sum + parseInt(r.total_orders || '0', 10),
      0
    );

    const topCategories = catRowsRes.rows.map((r, idx) => {
      const ordersCount = parseInt(r.total_orders || '0', 10);
      return {
        id: r.id,
        name: r.name,
        totalOrders: ordersCount,
        totalRevenue: parseFloat(r.total_revenue || '0'),
        percentage: grandTotalCatOrders > 0 ? Math.round((ordersCount / grandTotalCatOrders) * 100) : 0,
        color: categoryPalette[idx % categoryPalette.length]
      };
    });

    const monthlyTrendsByYear: Record<
      string,
      Array<{
        month: string;
        byCategory: Record<string, { orders: number; revenue: number }>;
        totalOrders: number;
        totalRevenue: number;
      }>
    > = {};

    for (const yr of years) {
      const yearStr = String(yr);
      monthlyTrendsByYear[yearStr] = [];

      const trendsRes = await query<{
        month_num: number;
        category_id: string;
        order_count: string;
        rev: string;
      }>(
        `SELECT EXTRACT(MONTH FROM o.start_date)::int as month_num,
                p.category_id,
                COUNT(o.id)::text as order_count,
                COALESCE(SUM(o.price), 0)::text as rev
         FROM orders o
         JOIN products p ON p.id = o.product_id
         WHERE EXTRACT(YEAR FROM o.start_date)::int = $1
           AND o.payment_status != 'refunded'
         GROUP BY month_num, p.category_id`,
        [yr]
      );

      const trendsMap: Record<number, Record<string, { orders: number; revenue: number }>> = {};
      for (const r of trendsRes.rows) {
        if (!trendsMap[r.month_num]) {
          trendsMap[r.month_num] = {};
        }
        trendsMap[r.month_num][r.category_id] = {
          orders: parseInt(r.order_count, 10),
          revenue: parseFloat(r.rev)
        };
      }

      for (let m = 1; m <= 12; m++) {
        const byCat = trendsMap[m] || {};
        let mOrders = 0;
        let mRev = 0;
        for (const cat of topCategories) {
          if (!byCat[cat.id]) {
            byCat[cat.id] = { orders: 0, revenue: 0 };
          } else {
            mOrders += byCat[cat.id].orders;
            mRev += byCat[cat.id].revenue;
          }
        }
        monthlyTrendsByYear[yearStr].push({
          month: months[m - 1],
          byCategory: byCat,
          totalOrders: mOrders,
          totalRevenue: mRev
        });
      }
    }

    const categoryAnalytics = {
      topCategories,
      monthlyTrendsByYear
    };

    // 10. Purchase Analytics
    const purchaseAnalytics = (ordersOverviewByYear[String(currentYear)] || []).map((o) => ({
      month: o.month,
      sold: o.orders,
      purchased: Math.round(o.revenue)
    }));

    // 11. Recent Orders (Latest 6 orders)
    const recentOrdersRes = await query<{
      id: string;
      order_number: string;
      customer_name: string;
      product_name: string;
      plan_name: string;
      status: string;
      start_date: string;
      end_date: string;
      price: number;
      currency: string;
      created_at: string;
    }>(
      `SELECT o.id,
              o.order_number,
              o.start_date::text as start_date,
              o.end_date::text as end_date,
              o.price,
              o.currency,
              o.status,
              o.created_at,
              c.name as customer_name,
              p.name as product_name,
              pl.name as plan_name
       FROM orders o
       JOIN customers c ON c.id = o.customer_id
       JOIN products p ON p.id = o.product_id
       JOIN plans pl ON pl.id = o.plan_id
       ORDER BY o.created_at DESC
       LIMIT 6`
    );

    return {
      financial: {
        totalRevenue,
        totalCost,
        grossProfit,
        profitMargin: parseFloat(profitMargin),
        revenueToday: parseFloat(todayRes.rows[0]?.rev || '0'),
        revenueThisMonth: revThisMonth,
        revenuePrevMonth: revPrevMonth,
        revenueGrowth
      },
      customers: {
        total: parseInt(customerStats.rows[0]?.total || '0', 10),
        active: parseInt(customerStats.rows[0]?.active || '0', 10),
        blocked: parseInt(customerStats.rows[0]?.blocked || '0', 10),
        inactive: parseInt(customerStats.rows[0]?.inactive || '0', 10),
        newThisMonth: newThisMonthCust,
        growthRate: customerGrowthRate,
        monthly: customerMonthly
      },
      orders: {
        total: totalOrdersCount,
        active: activeOrdersCount,
        expiring: expiringOrdersCount,
        expired: expiredOrdersCount,
        cancelled: parseInt(orderStatuses.rows[0]?.cancelled || '0', 10),
        activePercent,
        expiringPercent,
        expiredPercent,
        growthRate: revenueGrowth,
        dailyOrders
      },
      inventory: {
        stockStatus,
        turnoverRate,
        productsOrdered,
        serviceAccountsCount: parseInt(accountsCount.rows[0]?.count || '0', 10),
        assignedProfilesPercent,
        unallocatedKeysPercent,
        activeSubsPercent: activePercent,
        totalProfiles,
        availableProfiles,
        assignedProfiles,
        totalLicenses,
        availableLicenses,
        assignedLicenses
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
      topProducts: topProducts.rows,
      recentOrders: recentOrdersRes.rows
    };
  }
}

export const dashboardRepo = new DashboardRepository();
