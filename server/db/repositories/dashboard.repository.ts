import { query } from '../connection/pool.js';

export class DashboardRepository {
  async getStats(): Promise<any> {
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
      `SELECT p.id, p.name, p.brand,
              COUNT(o.id)::int as sales_count,
              COALESCE(SUM(o.price), 0)::float as revenue
       FROM products p
       JOIN orders o ON o.product_id = p.id
       WHERE o.payment_status != 'refunded'
       GROUP BY p.id
       ORDER BY sales_count DESC
       LIMIT 5`
    );

    // 8. Orders overview by month
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentYear = new Date().getFullYear();
    const ordersOverview: any[] = [];

    for (let i = 1; i <= 12; i++) {
      const monthPadded = String(i).padStart(2, '0');
      const yearMonth = `${currentYear}-${monthPadded}`;
      const oRow = await query<{ count: string; rev: string }>(
        `SELECT COUNT(*)::text as count, COALESCE(SUM(price), 0)::text as rev
         FROM orders
         WHERE TO_CHAR(start_date, 'YYYY-MM') = $1 AND payment_status != 'refunded'`,
        [yearMonth]
      );
      ordersOverview.push({
        month: months[i - 1],
        revenue: parseFloat(oRow.rows[0]?.rev || '0'),
        orders: parseInt(oRow.rows[0]?.count || '0', 10)
      });
    }

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
      topProducts: topProducts.rows
    };
  }
}

export const dashboardRepo = new DashboardRepository();
