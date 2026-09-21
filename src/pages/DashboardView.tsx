import React from 'react';
import {
  ClipboardList,
  Users,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Package,
  Calendar,
  Sparkles,
  BarChart3
} from 'lucide-react';
import type { DashboardStats } from '../types';
import { useCurrency } from '../context/CurrencyContext';

interface DashboardViewProps {
  stats: DashboardStats | null;
  onOpenOrderBuilder: () => void;
  onNavigate: (tab: string) => void;
}

const formatDateOnly = (d?: string | null) => {
  if (!d) return '—';
  return String(d).split('T')[0].split(' ')[0];
};

export const DashboardView: React.FC<DashboardViewProps> = ({
  stats,
  onOpenOrderBuilder,
  onNavigate
}) => {
  const { format: formatMoney } = useCurrency();
  const currentYearNum = new Date().getFullYear();
  const last2Years = [String(currentYearNum - 1), String(currentYearNum)]; // e.g. ['2025', '2026']
  const [activeYear, setActiveYear] = React.useState(String(currentYearNum));
  const [topProductPage, setTopProductPage] = React.useState(0);
  const [purchaseMetric, setPurchaseMetric] = React.useState<'orders' | 'revenue'>('orders');
  const [hoveredCategoryMonth, setHoveredCategoryMonth] = React.useState<number | null>(null);

  if (!stats) {
    return (
      <div className="p-12 text-center text-xs text-slate-400">
        Loading analytics engine and ACID metrics...
      </div>
    );
  }

  const { financial, customers, orders, inventory, categoryAnalytics, topProducts, recentOrders = [] } = stats;

  const topCategories = categoryAnalytics?.topCategories || [];
  const monthlyCategoryTrends = (categoryAnalytics?.monthlyTrendsByYear && categoryAnalytics.monthlyTrendsByYear[activeYear]) || [];

  // Real Database Subscription Health percentages
  const subTotal = orders.total || 0;
  const activePct = orders.activePercent ?? (subTotal > 0 ? Math.round((orders.active / subTotal) * 100) : 0);
  const expiringPct = orders.expiringPercent ?? (subTotal > 0 ? Math.round((orders.expiring / subTotal) * 100) : 0);
  const expiredPct = orders.expiredPercent ?? (subTotal > 0 ? Math.max(0, 100 - activePct - expiringPct) : 0);

  // SVG Donut circumference: 2 * PI * 46 = ~289.03
  const donutCircumference = 289.03;
  const activeArcLen = (activePct / 100) * donutCircumference;
  const expiringArcLen = (expiringPct / 100) * donutCircumference;
  const expiredArcLen = (expiredPct / 100) * donutCircumference;

  const pageSize = 4;
  const paginatedTopProducts = topProducts.slice(topProductPage * pageSize, (topProductPage + 1) * pageSize);
  const maxPages = Math.ceil(topProducts.length / pageSize) || 1;

  // Render Purchase Analytics Monthly Category Trends Chart (Max 5 categories from high to low)
  const renderPurchaseCategoryChart = () => {
    const data = monthlyCategoryTrends || [];
    const categories = topCategories.slice(0, 5);

    if (categories.length === 0 || data.length === 0) {
      return (
        <div className="p-8 text-center text-xs text-slate-400">
          No category purchase records found for {activeYear}.
        </div>
      );
    }

    // Determine max value for vertical scaling
    const maxVal = Math.max(
      ...data.map((m) =>
        Math.max(...categories.map((c) => m.byCategory?.[c.id]?.[purchaseMetric] || 0), 0)
      ),
      purchaseMetric === 'orders' ? 4 : 50
    );

    return (
      <div className="space-y-4">
        {/* Bars Container */}
        <div className="relative pt-4 pb-2">
          {/* Background grid lines */}
          <div className="absolute inset-x-0 top-4 bottom-8 flex flex-col justify-between pointer-events-none opacity-40">
            <div className="border-b border-slate-100 border-dashed w-full" />
            <div className="border-b border-slate-100 border-dashed w-full" />
            <div className="border-b border-slate-100 border-dashed w-full" />
          </div>

          <div className="grid grid-cols-12 gap-1 sm:gap-2.5 relative z-10">
            {data.map((item, idx) => {
              const isHovered = hoveredCategoryMonth === idx;
              const hasActivity = item.totalOrders > 0;

              return (
                <div
                  key={idx}
                  className="flex flex-col items-center group relative cursor-pointer"
                  onMouseEnter={() => setHoveredCategoryMonth(idx)}
                  onMouseLeave={() => setHoveredCategoryMonth(null)}
                >
                  {/* Tooltip on hover */}
                  {isHovered && (
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-52 sm:w-60 bg-slate-900/95 text-white text-xs rounded-xl p-3 shadow-xl backdrop-blur-sm z-50 pointer-events-none border border-slate-700/60">
                      <div className="flex items-center justify-between border-b border-slate-700/60 pb-1.5 mb-2">
                        <span className="font-bold text-slate-100">{item.month} {activeYear}</span>
                        <span className="text-[10px] font-semibold text-emerald-400">
                          {item.totalOrders} {item.totalOrders === 1 ? 'order' : 'orders'} ({formatMoney(item.totalRevenue)})
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        {categories.map((cat) => {
                          const catOrders = item.byCategory?.[cat.id]?.orders || 0;
                          const catRev = item.byCategory?.[cat.id]?.revenue || 0;
                          const shortName = `${cat.name.slice(0, 4)}...`;
                          return (
                            <div key={cat.id} className="flex items-center justify-between text-[11px]">
                              <div className="flex items-center gap-1.5 min-w-0 pr-1">
                                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                                <span className="truncate text-slate-300" title={cat.name}>{shortName}</span>
                              </div>
                              <span className="font-semibold text-slate-100 shrink-0">
                                {purchaseMetric === 'orders' ? `${catOrders} ord` : formatMoney(catRev)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Bars Cluster */}
                  <div
                    className={`w-full h-44 rounded-xl flex items-end justify-center gap-0.5 sm:gap-1 p-1 transition-colors ${
                      isHovered ? 'bg-slate-100/80 shadow-2xs' : 'hover:bg-slate-50/50'
                    }`}
                  >
                    {categories.map((cat) => {
                      const val = item.byCategory?.[cat.id]?.[purchaseMetric] || 0;
                      const heightPercent = val > 0 ? Math.min(100, Math.max(12, (val / maxVal) * 100)) : 3;
                      const shortName = `${cat.name.slice(0, 4)}...`;

                      return (
                        <div
                          key={cat.id}
                          className="flex-1 max-w-[10px] sm:max-w-[13px] rounded-t-sm transition-all duration-200"
                          style={{
                            height: `${heightPercent}%`,
                            backgroundColor: cat.color,
                            opacity: val > 0 ? (isHovered ? 1 : 0.88) : 0.16
                          }}
                          title={`${shortName}: ${val}`}
                        />
                      );
                    })}
                  </div>

                  {/* Month Label */}
                  <span
                    className={`mt-2 text-[10px] sm:text-[11px] font-medium transition-colors ${
                      isHovered
                        ? 'text-slate-900 font-bold'
                        : (hasActivity ? 'text-slate-700 font-semibold' : 'text-slate-400')
                    }`}
                  >
                    {item.month}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Row 1: 4 Metric Cards (Matching dashdoard.png) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Total Revenue */}
        <div className="bg-white text-slate-800 rounded-3xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight leading-snug">
              Total Revenue
            </h4>
            <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-[#EAF8F5] border border-emerald-100/60 px-2.5 py-0.5 rounded-full shrink-0">
              <ArrowUpRight size={13} />
              <span>+{financial.revenueGrowth}%</span>
            </span>
          </div>
          <div className="mt-5">
            <p className="text-2xl font-bold tracking-tight text-slate-900">
              {formatMoney(financial.totalRevenue, 'USD')}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              +{formatMoney(financial.revenueToday, 'USD')} recorded today
            </p>
          </div>
        </div>

        {/* Card 2: Order Development (Exact match with attached screenshot) */}
        <div className="bg-white text-slate-800 rounded-3xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight leading-snug">
                Order<br />Development
              </h4>
              <p className="text-xs text-slate-400 mt-1 font-normal">Daily orders (real data)</p>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-[#EAF8F5] border border-emerald-100/60 text-emerald-700 shrink-0">
              <TrendingUp size={15} className="text-emerald-600 stroke-[2.2]" />
              <div className="flex flex-col leading-none">
                <span className="text-xs font-bold text-emerald-800">{orders.total ?? 0}</span>
                <span className="text-[10px] font-semibold text-emerald-700 mt-0.5">Total</span>
              </div>
            </div>
          </div>

          {/* Spline Wave Chart dynamically computed from real DB daily orders */}
          <div className="py-2.5 my-auto">
            {(() => {
              const days = orders.dailyOrders && orders.dailyOrders.length === 7
                ? orders.dailyOrders
                : [
                    { day: 'Mon', count: 0 },
                    { day: 'Tue', count: 0 },
                    { day: 'Wed', count: 0 },
                    { day: 'Thu', count: 0 },
                    { day: 'Fri', count: 0 },
                    { day: 'Sat', count: 0 },
                    { day: 'Sun', count: 0 }
                  ];

              const counts = days.map((d) => d.count);
              const maxCount = Math.max(...counts, 0);
              const yMax = Math.max(maxCount, 4);
              const yMid = Math.round(yMax / 2);

              const xs = [50, 89, 128, 167, 206, 245, 284];
              const getY = (count: number) => 96 - (count / yMax) * 76;
              const points = xs.map((x, i) => ({ x, y: getY(counts[i]) }));

              const linePath = points.reduce((acc, p, i, arr) => {
                if (i === 0) return `M ${p.x} ${p.y}`;
                const prev = arr[i - 1];
                const cx1 = prev.x + (p.x - prev.x) / 2;
                const cy1 = prev.y;
                const cx2 = prev.x + (p.x - prev.x) / 2;
                const cy2 = p.y;
                return `${acc} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${p.x} ${p.y}`;
              }, '');

              const areaPath = `${linePath} L ${xs[xs.length - 1]} 98 L ${xs[0]} 98 Z`;

              return (
                <svg viewBox="0 0 310 120" className="w-full h-28 overflow-visible select-none">
                  <defs>
                    <linearGradient id="orderDevelopmentGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10B981" stopOpacity="0.28" />
                      <stop offset="70%" stopColor="#10B981" stopOpacity="0.08" />
                      <stop offset="100%" stopColor="#10B981" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Y-axis labels */}
                  <text x="14" y="20" textAnchor="end" className="text-[11px] fill-slate-400 font-normal">{yMax}</text>
                  <text x="14" y="58" textAnchor="end" className="text-[11px] fill-slate-400 font-normal">{yMid}</text>
                  <text x="14" y="96" textAnchor="end" className="text-[11px] fill-slate-400 font-normal">0</text>

                  {/* Area Gradient Fill */}
                  <path d={areaPath} fill="url(#orderDevelopmentGradient)" />

                  {/* Spline Line */}
                  <path
                    d={linePath}
                    fill="none"
                    stroke="#10B981"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {/* X-axis days */}
                  {days.map((d, i) => (
                    <text key={d.day} x={xs[i]} y="112" textAnchor="middle" className="text-[10px] fill-slate-400 font-normal">
                      {d.day}
                    </text>
                  ))}
                </svg>
              );
            })()}
          </div>
        </div>

        {/* Card 3: Total Customers (Exact match with attached screenshot) */}
        <div className="bg-white text-slate-800 rounded-3xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className="text-base font-bold text-slate-900 tracking-tight">Total Customers</h4>
              <p className="text-[11px] text-slate-400 mt-0.5">Real-time growth &amp; customer base</p>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50/80 border border-blue-100 text-blue-600 shrink-0">
              <Users size={14} className="text-blue-600" />
              <span className="text-xs font-bold text-slate-900">{customers.total} Registered</span>
            </div>
          </div>

          {/* Bar Chart matching screenshot, driven by real DB data */}
          <div className="py-2.5 my-auto">
            {(() => {
              const months = customers.monthly && customers.monthly.length > 0
                ? customers.monthly
                : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'].map((m) => ({ month: m, count: 0 }));

              const counts = months.map((m) => m.count);
              const maxCount = Math.max(...counts, 0);
              const yMax = Math.max(maxCount, 8);
              const yMid = Math.round(yMax / 2);
              const xs = [45, 78, 111, 144, 177, 210, 243, 276];
              const barWidth = 18;

              return (
                <svg viewBox="0 0 310 115" className="w-full h-28 overflow-visible select-none">
                  {/* Y-axis labels */}
                  <text x="14" y="20" textAnchor="end" className="text-[11px] fill-slate-300 font-normal">{yMax}</text>
                  <text x="14" y="58" textAnchor="end" className="text-[11px] fill-slate-300 font-normal">{yMid}</text>
                  <text x="14" y="96" textAnchor="end" className="text-[11px] fill-slate-300 font-normal">0</text>

                  {months.map((m, i) => {
                    const x = xs[i];
                    const barHeight = m.count > 0 ? Math.max(4, Math.round((m.count / yMax) * 60)) : 0;
                    const y = 96 - barHeight;
                    return (
                      <g key={m.month}>
                        {barHeight > 0 && (
                          <rect
                            x={x - barWidth / 2}
                            y={y}
                            width={barWidth}
                            height={barHeight}
                            rx={4}
                            fill="#3B82F6"
                          />
                        )}
                        <text x={x} y="112" textAnchor="middle" className="text-[10.5px] fill-slate-400 font-normal">
                          {m.month}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              );
            })()}
          </div>

          {/* Bottom 3 Metric Pills */}
          <div className="grid grid-cols-3 gap-2 sm:gap-2.5 pt-1">
            {/* Active */}
            <div className="bg-[#F8FAFC] border border-slate-200/70 rounded-2xl py-2.5 px-1 text-center">
              <p className="text-xs text-slate-500 font-medium">Active</p>
              <p className="text-base font-bold text-[#16A34A] mt-0.5">{customers.active}</p>
            </div>

            {/* Inactive / Blocked */}
            <div className="bg-[#F8FAFC] border border-slate-200/70 rounded-2xl py-2.5 px-1 text-center">
              <p className="text-xs text-slate-500 font-medium">Inactive</p>
              <p className="text-base font-bold text-slate-700 mt-0.5">
                {customers.inactiveOrBlocked ?? ((customers.inactive ?? 0) + (customers.blocked ?? 0))}
              </p>
            </div>

            {/* Avg Orders (Dark pill) */}
            <div className="bg-[#0F172A] rounded-2xl py-2.5 px-1 text-center shadow-xs">
              <p className="text-xs text-slate-200 font-medium">Avg Orders</p>
              <p className="text-base font-bold text-cyan-400 mt-0.5 flex items-center justify-center gap-0.5">
                <span>{customers.total > 0 ? (orders.total / customers.total).toFixed(1) : '0.0'}</span>
                <ArrowUpRight size={13} className="text-cyan-400 stroke-[2.5]" />
              </p>
            </div>
          </div>
        </div>

        {/* Card 4: Subscription Health (Real DB Data) */}
        <div className="bg-white text-slate-800 rounded-3xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h4 className="text-base font-bold text-slate-900 tracking-tight">Subscription Health</h4>
            <button
              onClick={() => onNavigate('alerts')}
              className="text-xs sm:text-sm font-semibold text-blue-600 hover:text-blue-700 hover:underline transition"
            >
              View Alerts
            </button>
          </div>

          {/* Donut Chart with real database percentages */}
          <div className="flex items-center justify-center py-2 my-auto">
            <svg viewBox="0 0 140 140" className="w-32 h-32 sm:w-36 sm:h-36 select-none overflow-visible">
              {/* Background ring */}
              <circle
                cx="70"
                cy="70"
                r="46"
                stroke="#F1F5F9"
                strokeWidth="13"
                fill="transparent"
              />

              {/* Active Segment (Blue) */}
              {activePct > 0 && (
                <circle
                  cx="70"
                  cy="70"
                  r="46"
                  stroke="#3B82F6"
                  strokeWidth="13"
                  fill="transparent"
                  strokeDasharray={`${activeArcLen} ${donutCircumference}`}
                  strokeDashoffset={0}
                  strokeLinecap={activePct === 100 ? 'butt' : 'round'}
                  transform="rotate(-90 70 70)"
                  className="transition-all duration-500"
                />
              )}

              {/* Expiring 3d Segment (Pink) */}
              {expiringPct > 0 && (
                <circle
                  cx="70"
                  cy="70"
                  r="46"
                  stroke="#F498CE"
                  strokeWidth="13"
                  fill="transparent"
                  strokeDasharray={`${expiringArcLen} ${donutCircumference}`}
                  strokeDashoffset={-activeArcLen}
                  strokeLinecap="round"
                  transform="rotate(-90 70 70)"
                  className="transition-all duration-500"
                />
              )}

              {/* Expired Segment (Coral Red) */}
              {expiredPct > 0 && (
                <circle
                  cx="70"
                  cy="70"
                  r="46"
                  stroke="#FF5C5C"
                  strokeWidth="13"
                  fill="transparent"
                  strokeDasharray={`${expiredArcLen} ${donutCircumference}`}
                  strokeDashoffset={-(activeArcLen + expiringArcLen)}
                  strokeLinecap="round"
                  transform="rotate(-90 70 70)"
                  className="transition-all duration-500"
                />
              )}

              {/* Center Text */}
              <text
                x="70"
                y="63"
                textAnchor="middle"
                className="text-[10px] font-bold fill-slate-400 tracking-wider"
              >
                ACTIVE
              </text>
              <text
                x="70"
                y="84"
                textAnchor="middle"
                className="text-xl font-bold fill-slate-900 tracking-tight"
              >
                {activePct}%
              </text>
            </svg>
          </div>

          {/* Divider and 3-State Legend with Real Percentages (Expiring 7d removed) */}
          <div className="border-t border-slate-100 pt-3">
            <div className="grid grid-cols-3 gap-1.5 text-xs">
              {/* Active */}
              <div className="flex items-center justify-between px-2 py-1.5 rounded-xl bg-blue-50/60 border border-blue-100/70">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="w-2 h-2 rounded-full bg-[#3B82F6] shrink-0" />
                  <span className="text-slate-600 font-medium text-[11px] truncate">Active</span>
                </div>
                <span className="font-bold text-slate-900 text-[11px] ml-1 shrink-0">{activePct}%</span>
              </div>

              {/* Expiring 3d */}
              <div className="flex items-center justify-between px-2 py-1.5 rounded-xl bg-pink-50/60 border border-pink-100/70">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="w-2 h-2 rounded-full bg-[#F498CE] shrink-0" />
                  <span className="text-slate-600 font-medium text-[11px] truncate">Expiring 3d</span>
                </div>
                <span className="font-bold text-slate-900 text-[11px] ml-1 shrink-0">{expiringPct}%</span>
              </div>

              {/* Expired */}
              <div className="flex items-center justify-between px-2 py-1.5 rounded-xl bg-rose-50/60 border border-rose-100/70">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="w-2 h-2 rounded-full bg-[#FF5C5C] shrink-0" />
                  <span className="text-slate-600 font-medium text-[11px] truncate">Expired</span>
                </div>
                <span className="font-bold text-slate-900 text-[11px] ml-1 shrink-0">{expiredPct}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Recent Orders */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-bold text-slate-800">Recent Orders</h3>
            <a
              href="#orders"
              onClick={(e) => {
                e.preventDefault();
                onNavigate('orders');
              }}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline transition cursor-pointer"
            >
              View Orders
            </a>
          </div>
        </div>

        {/* Recent Orders Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50/60 border-b border-slate-100 text-slate-400 uppercase text-[10px] tracking-wider">
                <th className="py-3 px-4 font-semibold">Name of Order</th>
                <th className="py-3 px-4 font-semibold">Subscription Term</th>
                <th className="py-3 px-4 font-semibold text-right">Price</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentOrders.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-8 text-center text-slate-400 text-xs">
                    No recent orders found.
                  </td>
                </tr>
              ) : (
                recentOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-800">#{order.order_number}</span>
                        <span className="text-slate-300">·</span>
                        <span className="font-semibold text-slate-800">{order.product_name}</span>
                        {order.plan_name && (
                          <span className="text-[11px] text-slate-400">({order.plan_name})</span>
                        )}
                      </div>
                      {order.customer_name && (
                        <p className="text-[11px] text-slate-400 mt-0.5">{order.customer_name}</p>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Calendar size={13} className="text-slate-400 shrink-0" />
                        <span>
                          {formatDateOnly(order.start_date)} → {formatDateOnly(order.end_date)}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900 text-right whitespace-nowrap">
                      {formatMoney(order.price, order.currency || 'USD')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Row 3: Purchase Analytics - Monthly Category Trends (Customer Growth removed, max 5 categories high to low) */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-800">Purchase Analytics</h3>
              <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-100/80">
                Monthly Category Trends
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Category volume comparison
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Metric Switcher (Orders vs Revenue) */}
            <div className="flex items-center p-1 bg-slate-100/90 rounded-xl border border-slate-200/80 gap-1 select-none">
              <button
                type="button"
                onClick={() => setPurchaseMetric('orders')}
                className={`px-3 py-1 text-xs rounded-lg transition-all ${
                  purchaseMetric === 'orders'
                    ? 'bg-white text-slate-900 font-bold shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900 font-medium'
                }`}
              >
                Orders
              </button>
              <button
                type="button"
                onClick={() => setPurchaseMetric('revenue')}
                className={`px-3 py-1 text-xs rounded-lg transition-all ${
                  purchaseMetric === 'revenue'
                    ? 'bg-white text-slate-900 font-bold shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900 font-medium'
                }`}
              >
                Revenue
              </button>
            </div>

            {/* Year Selector */}
            <div className="flex items-center p-1 bg-slate-100/90 rounded-xl border border-slate-200/80 gap-1 select-none">
              {last2Years.map((yr) => {
                const isSelected = activeYear === yr;
                return (
                  <button
                    key={yr}
                    type="button"
                    onClick={() => setActiveYear(yr)}
                    className={`px-3 py-1 text-xs rounded-lg transition-all ${
                      isSelected
                        ? 'bg-white text-slate-900 font-bold shadow-2xs'
                        : 'text-slate-500 hover:text-slate-900 font-medium'
                    }`}
                  >
                    {yr}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Categories Legend (Top 5 from high to low with distinct colors) */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
          {topCategories.slice(0, 5).map((cat) => (
            <div
              key={cat.id}
              className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-50 border border-slate-200/70 text-xs"
              title={cat.name}
            >
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
              <span className="font-semibold text-slate-700">{cat.name.slice(0, 4)}...</span>
              <span className="text-[11px] font-bold text-slate-900 bg-white px-1.5 py-0.5 rounded-md border border-slate-200/60 ml-1">
                {purchaseMetric === 'orders'
                  ? `${cat.totalOrders} (${cat.percentage}%)`
                  : `${formatMoney(cat.totalRevenue)} (${cat.percentage}%)`}
              </span>
            </div>
          ))}
        </div>

        {/* Monthly Trend Categories Chart */}
        <div className="pt-2">{renderPurchaseCategoryChart()}</div>
      </div>

      {/* Row 4: Inventory Management & Top Selling Products (Matching dashdoard.png) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Inventory Management Breakdown (5 cols) */}
        <div className="lg:col-span-5 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800">Inventory Management</h3>
            <span className="text-xs text-blue-600 font-semibold cursor-pointer hover:underline" onClick={() => onNavigate('inventory')}>
              View Bank
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center py-2 bg-slate-50 rounded-2xl border border-slate-150">
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-medium">Stock Status</p>
              <p className="text-sm font-bold text-slate-800">{inventory.stockStatus ?? 0}%</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-medium">Turnover</p>
              <p className="text-sm font-bold text-slate-800">{inventory.turnoverRate ?? 0}%</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-medium">Ordered</p>
              <p className="text-sm font-bold text-slate-800">{inventory.productsOrdered ?? 0}%</p>
            </div>
          </div>

          {/* Multi-month stacked progress bars computed from real DB data */}
          <div className="space-y-3 pt-2">
            {[
              {
                label: 'Active Subscriptions',
                pct: inventory.activeSubsPercent ?? activePct,
                color: 'bg-blue-600'
              },
              {
                label: 'Assigned Profiles',
                pct: inventory.assignedProfilesPercent ?? 0,
                color: 'bg-emerald-500'
              },
              {
                label: 'Unallocated Keys',
                pct: inventory.unallocatedKeysPercent ?? 0,
                color: 'bg-purple-500'
              }
            ].map((item) => (
              <div key={item.label} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600 font-medium">{item.label}</span>
                  <span className="font-semibold text-slate-800">{item.pct}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${item.color}`}
                    style={{ width: `${item.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Top Selling Products (7 cols) */}
        <div className="lg:col-span-7 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800">Top Selling Products</h3>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">
                Page {topProductPage + 1} of {maxPages}
              </span>
              <div className="flex items-center gap-1">
                <button
                  disabled={topProductPage === 0}
                  onClick={() => setTopProductPage((p) => Math.max(0, p - 1))}
                  className="p-1 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 text-slate-600"
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  disabled={topProductPage >= maxPages - 1}
                  onClick={() => setTopProductPage((p) => Math.min(maxPages - 1, p + 1))}
                  className="p-1 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 text-slate-600"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 uppercase text-[10px] tracking-wider">
                  <th className="pb-3 font-semibold">Product</th>
                  <th className="pb-3 font-semibold">Brand / Type</th>
                  <th className="pb-3 font-semibold text-right">Orders</th>
                  <th className="pb-3 font-semibold text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedTopProducts.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-xs text-slate-400">
                      No products recorded yet.
                    </td>
                  </tr>
                ) : (
                  paginatedTopProducts.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm shrink-0">
                            {p.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800">{p.name}</p>
                            <p className="text-[10px] text-slate-400 font-mono">#{p.slug || p.name.toLowerCase().replace(/\s+/g, '-')}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 text-slate-600">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-[10px] font-medium">
                          {p.brand || 'Digital'}
                        </span>
                      </td>
                      <td className="py-3 text-right font-bold text-slate-800">{p.orderCount ?? (p as any).sales_count ?? 0}</td>
                      <td className="py-3 text-right font-bold text-emerald-600">
                        {formatMoney(p.totalRevenue ?? (p as any).revenue ?? 0)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
