package com.vectis.erp.feature.dashboard

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.vectis.erp.core.design.*
import com.vectis.erp.data.model.*
import java.util.Locale

@Composable
fun DashboardScreen(
    viewModel: DashboardViewModel,
    onNavigateToOrders: () -> Unit,
    onNavigateToProducts: () -> Unit = {},
    onNavigateToInventory: () -> Unit = {},
    onNavigateToAlerts: () -> Unit = {},
    onNavigateToSettings: () -> Unit = {},
    onOpenSearch: () -> Unit = {}
) {
    val uiState by viewModel.uiState.collectAsState()
    val preferredCurrency by viewModel.preferredCurrency.collectAsState()

    val alertCount = (uiState as? DashboardUiState.Success)?.stats?.let {
        it.orders.expiring + it.orders.expired
    } ?: 0

    Scaffold(
        contentWindowInsets = WindowInsets(0.dp, 0.dp, 0.dp, 0.dp),
        topBar = {
            VectisTopAppBar(
                onRefresh = { viewModel.loadStats() },
                onNavigateToSettings = onNavigateToSettings,
                onNavigateToAlerts = onNavigateToAlerts,
                onOpenSearch = onOpenSearch,
                alertCount = alertCount,
                preferredCurrency = preferredCurrency
            )
        },
        containerColor = Slate50
    ) { paddingValues ->
        val isRefreshing = (uiState as? DashboardUiState.Success)?.isRefreshing == true
        VectisPullToRefreshBox(
            isRefreshing = isRefreshing,
            onRefresh = { viewModel.loadStats(isRefresh = true) },
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            when (val state = uiState) {
                is DashboardUiState.Loading -> {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(color = PrimaryBlue)
                    }
                }
                is DashboardUiState.Error -> {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            modifier = Modifier.padding(24.dp)
                        ) {
                            Icon(
                                Icons.Default.Warning,
                                contentDescription = null,
                                tint = StatusDanger,
                                modifier = Modifier.size(48.dp)
                            )
                            Spacer(modifier = Modifier.height(12.dp))
                            Text(text = state.message, color = Slate700, fontSize = 14.sp)
                            Spacer(modifier = Modifier.height(16.dp))
                            Button(
                                onClick = { viewModel.loadStats() },
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = PrimaryBlue,
                                    contentColor = Color.White
                                )
                            ) {
                                Text("Retry", color = Color.White)
                            }
                        }
                    }
                }
                is DashboardUiState.Success -> {
                    DashboardContent(
                        stats = state.stats,
                        viewModel = viewModel,
                        onNavigateToOrders = onNavigateToOrders,
                        onNavigateToInventory = onNavigateToInventory,
                        onNavigateToAlerts = onNavigateToAlerts
                    )
                }
            }
        }
    }
}

@Composable
private fun DashboardContent(
    stats: DashboardStatsDto,
    viewModel: DashboardViewModel,
    onNavigateToOrders: () -> Unit,
    onNavigateToInventory: () -> Unit,
    onNavigateToAlerts: () -> Unit
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 16.dp, bottom = 80.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            ViewHeader(
                title = "Dashboard",
                description = "Business Overview",
                modifier = Modifier.padding(horizontal = 0.dp, vertical = 0.dp)
            )
        }

        // Card 1: Total Revenue
        item {
            TotalRevenueCard(stats = stats, viewModel = viewModel)
        }

        // Card 2: Order Development (Spline Wave Chart)
        item {
            OrderDevelopmentCard(orders = stats.orders)
        }

        // Card 3: Total Customers (Bar Chart & Metric Pills)
        item {
            TotalCustomersCard(customers = stats.customers, totalOrders = stats.orders.total)
        }

        // Card 4: Subscription Health (Donut Chart & 3-State Legend)
        item {
            SubscriptionHealthCard(orders = stats.orders, onNavigateToAlerts = onNavigateToAlerts)
        }

        // Card 5: Purchase Analytics (Monthly Category Trends)
        item {
            PurchaseAnalyticsCard(
                categoryAnalytics = stats.categoryAnalytics,
                viewModel = viewModel
            )
        }

        // Card 6: Recent Orders
        item {
            RecentOrdersCard(
                recentOrders = stats.recentOrders,
                viewModel = viewModel,
                onNavigateToOrders = onNavigateToOrders
            )
        }

        // Card 7: Top Selling Products (Paginated)
        item {
            TopSellingProductsCard(
                topProducts = stats.topProducts,
                viewModel = viewModel
            )
        }

        // Card 8: Inventory Management
        item {
            InventoryManagementCard(
                inventory = stats.inventory,
                onNavigateToInventory = onNavigateToInventory
            )
        }
    }
}

/* =====================================================================
   CARD 1: Total Revenue
   ===================================================================== */
@Composable
private fun TotalRevenueCard(
    stats: DashboardStatsDto,
    viewModel: DashboardViewModel
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(modifier = Modifier.padding(18.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top
            ) {
                Text(
                    text = "Total Revenue",
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Bold,
                    color = Slate900
                )
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(12.dp))
                        .background(Color(0xFFEAF8F5))
                        .padding(horizontal = 8.dp, vertical = 4.dp)
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(2.dp)
                    ) {
                        Icon(
                            Icons.Default.ArrowOutward,
                            contentDescription = null,
                            tint = Color(0xFF047857),
                            modifier = Modifier.size(13.dp)
                        )
                        Text(
                            text = "+${stats.financial.revenueGrowth}%",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = Color(0xFF047857)
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(14.dp))

            Text(
                text = viewModel.formatCurrency(stats.financial.totalRevenue),
                fontSize = 26.sp,
                fontWeight = FontWeight.Bold,
                color = Slate900
            )

            Spacer(modifier = Modifier.height(4.dp))

            Text(
                text = "+${viewModel.formatCurrency(stats.financial.revenueToday)} recorded today",
                fontSize = 11.sp,
                color = Slate400
            )
        }
    }
}

/* =====================================================================
   CARD 2: Order Development (Spline Wave Chart)
   ===================================================================== */
@Composable
private fun OrderDevelopmentCard(orders: OrderStatsDto) {
    val defaultDays = listOf("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")
    val dailyList = if (orders.dailyOrders.size == 7) {
        orders.dailyOrders
    } else {
        defaultDays.map { DailyOrderDto(day = it, count = 0) }
    }

    val counts = dailyList.map { it.count }
    val maxCount = (counts.maxOrNull() ?: 0).coerceAtLeast(4)
    val midCount = maxCount / 2

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(modifier = Modifier.padding(18.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top
            ) {
                Column {
                    Text(
                        text = "Order Development",
                        fontSize = 17.sp,
                        fontWeight = FontWeight.Bold,
                        color = Slate900
                    )
                    Text(
                        text = "Daily orders (real data)",
                        fontSize = 11.sp,
                        color = Slate400
                    )
                }

                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(12.dp))
                        .background(Color(0xFFEAF8F5))
                        .padding(horizontal = 10.dp, vertical = 6.dp)
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Icon(
                            Icons.Default.TrendingUp,
                            contentDescription = null,
                            tint = Color(0xFF059669),
                            modifier = Modifier.size(16.dp)
                        )
                        Column {
                            Text(
                                text = "${orders.total}",
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color(0xFF065F46)
                            )
                            Text(
                                text = "Total",
                                fontSize = 9.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = Color(0xFF059669)
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Chart Container with Y-Axis and Wave Canvas
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(130.dp)
            ) {
                // Y-Axis Labels
                Column(
                    modifier = Modifier
                        .fillMaxHeight()
                        .padding(end = 8.dp, bottom = 20.dp),
                    verticalArrangement = Arrangement.SpaceBetween,
                    horizontalAlignment = Alignment.End
                ) {
                    Text("$maxCount", fontSize = 10.sp, color = Slate400)
                    Text("$midCount", fontSize = 10.sp, color = Slate400)
                    Text("0", fontSize = 10.sp, color = Slate400)
                }

                // Spline Wave Chart + X-Axis Days
                Column(modifier = Modifier.weight(1f)) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .weight(1f)
                    ) {
                        Canvas(modifier = Modifier.fillMaxSize()) {
                            val w = size.width
                            val h = size.height
                            if (dailyList.isEmpty()) return@Canvas

                            val stepX = w / (dailyList.size - 1)
                            val points = dailyList.mapIndexed { i, item ->
                                val px = i * stepX
                                val py = h - ((item.count.toFloat() / maxCount.toFloat()) * (h * 0.85f)) - (h * 0.05f)
                                Offset(px, py)
                            }

                            val splinePath = Path().apply {
                                moveTo(points[0].x, points[0].y)
                                for (i in 1 until points.size) {
                                    val prev = points[i - 1]
                                    val curr = points[i]
                                    val cx1 = prev.x + (curr.x - prev.x) / 2f
                                    val cy1 = prev.y
                                    val cx2 = prev.x + (curr.x - prev.x) / 2f
                                    val cy2 = curr.y
                                    cubicTo(cx1, cy1, cx2, cy2, curr.x, curr.y)
                                }
                            }

                            val fillPath = Path().apply {
                                addPath(splinePath)
                                lineTo(points.last().x, h)
                                lineTo(points.first().x, h)
                                close()
                            }

                            // Gradient Fill
                            drawPath(
                                path = fillPath,
                                brush = Brush.verticalGradient(
                                    colors = listOf(
                                        Color(0xFF10B981).copy(alpha = 0.28f),
                                        Color(0xFF10B981).copy(alpha = 0.06f),
                                        Color.Transparent
                                    )
                                )
                            )

                            // Spline Stroke
                            drawPath(
                                path = splinePath,
                                color = Color(0xFF10B981),
                                style = Stroke(
                                    width = 3.dp.toPx(),
                                    cap = StrokeCap.Round,
                                    join = StrokeJoin.Round
                                )
                            )
                        }
                    }

                    // X-Axis Day labels
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 4.dp),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        dailyList.forEach { item ->
                            Text(
                                text = item.day,
                                fontSize = 10.sp,
                                color = Slate400,
                                textAlign = TextAlign.Center
                            )
                        }
                    }
                }
            }
        }
    }
}

/* =====================================================================
   CARD 3: Total Customers (Bar Chart & Metric Pills)
   ===================================================================== */
@Composable
private fun TotalCustomersCard(
    customers: CustomerStatsDto,
    totalOrders: Int
) {
    val months = if (customers.monthly.isNotEmpty()) {
        customers.monthly
    } else {
        listOf("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug").map {
            CustomerMonthlyDto(month = it, count = 0)
        }
    }

    val maxCount = (months.map { it.count }.maxOrNull() ?: 0).coerceAtLeast(8)
    val midCount = maxCount / 2
    val inactiveTotal = customers.inactive + customers.blocked
    val avgOrders = if (customers.total > 0) {
        String.format(Locale.US, "%.1f", totalOrders.toDouble() / customers.total)
    } else {
        "0.0"
    }

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(modifier = Modifier.padding(18.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top
            ) {
                Column {
                    Text(
                        text = "Total Customers",
                        fontSize = 17.sp,
                        fontWeight = FontWeight.Bold,
                        color = Slate900
                    )
                    Text(
                        text = "Real-time growth & customer base",
                        fontSize = 11.sp,
                        color = Slate400
                    )
                }

                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(14.dp))
                        .background(Color(0xFFEFF6FF))
                        .padding(horizontal = 10.dp, vertical = 6.dp)
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(5.dp)
                    ) {
                        Icon(
                            Icons.Default.People,
                            contentDescription = null,
                            tint = PrimaryBlue,
                            modifier = Modifier.size(15.dp)
                        )
                        Text(
                            text = "${customers.total} Registered",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = Slate900
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Bar Chart Container
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(125.dp)
            ) {
                // Y-Axis Labels
                Column(
                    modifier = Modifier
                        .fillMaxHeight()
                        .padding(end = 8.dp, bottom = 20.dp),
                    verticalArrangement = Arrangement.SpaceBetween,
                    horizontalAlignment = Alignment.End
                ) {
                    Text("$maxCount", fontSize = 10.sp, color = Slate400)
                    Text("$midCount", fontSize = 10.sp, color = Slate400)
                    Text("0", fontSize = 10.sp, color = Slate400)
                }

                // Bars
                Row(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxHeight(),
                    horizontalArrangement = Arrangement.SpaceEvenly,
                    verticalAlignment = Alignment.Bottom
                ) {
                    months.take(8).forEach { item ->
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            modifier = Modifier
                                .weight(1f)
                                .fillMaxHeight()
                        ) {
                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .fillMaxWidth(),
                                contentAlignment = Alignment.BottomCenter
                            ) {
                                val barHeightRatio = (item.count.toFloat() / maxCount.toFloat()).coerceIn(0f, 1f)
                                if (item.count > 0) {
                                    Box(
                                        modifier = Modifier
                                            .fillMaxHeight(barHeightRatio.coerceAtLeast(0.08f))
                                            .width(16.dp)
                                            .clip(RoundedCornerShape(topStart = 4.dp, topEnd = 4.dp))
                                            .background(PrimaryBlue)
                                    )
                                }
                            }
                            Spacer(modifier = Modifier.height(6.dp))
                            Text(
                                text = item.month,
                                fontSize = 10.sp,
                                color = Slate400,
                                textAlign = TextAlign.Center
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // 3 Bottom Metric Pills
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                // Active
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(14.dp))
                        .background(Color(0xFFF8FAFC))
                        .padding(vertical = 10.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("Active", fontSize = 11.sp, color = Slate500, fontWeight = FontWeight.Medium)
                        Spacer(modifier = Modifier.height(2.dp))
                        Text("${customers.active}", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = Color(0xFF16A34A))
                    }
                }

                // Inactive
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(14.dp))
                        .background(Color(0xFFF8FAFC))
                        .padding(vertical = 10.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("Inactive", fontSize = 11.sp, color = Slate500, fontWeight = FontWeight.Medium)
                        Spacer(modifier = Modifier.height(2.dp))
                        Text("$inactiveTotal", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = Slate700)
                    }
                }

                // Avg Orders (Dark pill with cyan text)
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(14.dp))
                        .background(Color(0xFF0F172A))
                        .padding(vertical = 10.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("Avg Orders", fontSize = 11.sp, color = Slate300, fontWeight = FontWeight.Medium)
                        Spacer(modifier = Modifier.height(2.dp))
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(2.dp)
                        ) {
                            Text(avgOrders, fontSize = 16.sp, fontWeight = FontWeight.Bold, color = Color(0xFF22D3EE))
                            Icon(
                                Icons.Default.ArrowOutward,
                                contentDescription = null,
                                tint = Color(0xFF22D3EE),
                                modifier = Modifier.size(13.dp)
                            )
                        }
                    }
                }
            }
        }
    }
}

/* =====================================================================
   CARD 4: Subscription Health (Donut Chart & 3-State Legend)
   ===================================================================== */
@Composable
private fun SubscriptionHealthCard(
    orders: OrderStatsDto,
    onNavigateToAlerts: () -> Unit
) {
    val total = orders.total
    val activePct = orders.activePercent.toInt().coerceIn(0, 100)
    val expiringPct = orders.expiringPercent.toInt().coerceIn(0, 100)
    val expiredPct = if (total > 0) {
        (100 - activePct - expiringPct).coerceAtLeast(0)
    } else {
        0
    }

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(modifier = Modifier.padding(18.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Subscription Health",
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Bold,
                    color = Slate900
                )
                Text(
                    text = "View Alerts",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PrimaryBlue,
                    modifier = Modifier
                        .clickable { onNavigateToAlerts() }
                        .padding(vertical = 4.dp, horizontal = 4.dp)
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Donut Chart with center text
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(150.dp),
                contentAlignment = Alignment.Center
            ) {
                Canvas(modifier = Modifier.size(130.dp)) {
                    val strokeWidth = 14.dp.toPx()
                    val diameter = size.minDimension - strokeWidth
                    val topLeft = Offset(strokeWidth / 2f, strokeWidth / 2f)
                    val arcSize = androidx.compose.ui.geometry.Size(diameter, diameter)

                    // Track
                    drawArc(
                        color = Color(0xFFF1F5F9),
                        startAngle = 0f,
                        sweepAngle = 360f,
                        useCenter = false,
                        topLeft = topLeft,
                        size = arcSize,
                        style = Stroke(width = strokeWidth)
                    )

                    val activeAngle = (activePct / 100f) * 360f
                    val expiringAngle = (expiringPct / 100f) * 360f
                    val expiredAngle = (expiredPct / 100f) * 360f

                    // Active Arc (Blue)
                    if (activePct > 0) {
                        drawArc(
                            color = Color(0xFF3B82F6),
                            startAngle = -90f,
                            sweepAngle = activeAngle,
                            useCenter = false,
                            topLeft = topLeft,
                            size = arcSize,
                            style = Stroke(width = strokeWidth, cap = StrokeCap.Round)
                        )
                    }

                    // Expiring Arc (Pink)
                    if (expiringPct > 0) {
                        drawArc(
                            color = Color(0xFFF498CE),
                            startAngle = -90f + activeAngle,
                            sweepAngle = expiringAngle,
                            useCenter = false,
                            topLeft = topLeft,
                            size = arcSize,
                            style = Stroke(width = strokeWidth, cap = StrokeCap.Round)
                        )
                    }

                    // Expired Arc (Red)
                    if (expiredPct > 0) {
                        drawArc(
                            color = Color(0xFFFF5C5C),
                            startAngle = -90f + activeAngle + expiringAngle,
                            sweepAngle = expiredAngle,
                            useCenter = false,
                            topLeft = topLeft,
                            size = arcSize,
                            style = Stroke(width = strokeWidth, cap = StrokeCap.Round)
                        )
                    }
                }

                // Center Text
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = "ACTIVE",
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        color = Slate400,
                        letterSpacing = 1.sp
                    )
                    Text(
                        text = "$activePct%",
                        fontSize = 22.sp,
                        fontWeight = FontWeight.Bold,
                        color = Slate900
                    )
                }
            }

            Spacer(modifier = Modifier.height(12.dp))
            HorizontalDivider(color = Slate100)
            Spacer(modifier = Modifier.height(12.dp))

            // 3-State Legend
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                // Active
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(10.dp))
                        .background(Color(0xFFEFF6FF))
                        .padding(horizontal = 8.dp, vertical = 6.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                            Box(modifier = Modifier.size(6.dp).clip(CircleShape).background(Color(0xFF3B82F6)))
                            Text("Active", fontSize = 11.sp, color = Slate600)
                        }
                        Text("$activePct%", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Slate900)
                    }
                }

                // Expiring 3d
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(10.dp))
                        .background(Color(0xFFFDF2F8))
                        .padding(horizontal = 8.dp, vertical = 6.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                            Box(modifier = Modifier.size(6.dp).clip(CircleShape).background(Color(0xFFF498CE)))
                            Text("Expiring 3d", fontSize = 10.sp, color = Slate600)
                        }
                        Text("$expiringPct%", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Slate900)
                    }
                }

                // Expired
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(10.dp))
                        .background(Color(0xFFFFF1F2))
                        .padding(horizontal = 8.dp, vertical = 6.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                            Box(modifier = Modifier.size(6.dp).clip(CircleShape).background(Color(0xFFFF5C5C)))
                            Text("Expired", fontSize = 11.sp, color = Slate600)
                        }
                        Text("$expiredPct%", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Slate900)
                    }
                }
            }
        }
    }
}

/* =====================================================================
   CARD 5: Purchase Analytics (Monthly Category Trends)
   ===================================================================== */
@Composable
private fun PurchaseAnalyticsCard(
    categoryAnalytics: CategoryAnalyticsDto?,
    viewModel: DashboardViewModel
) {
    var activeMetric by remember { mutableStateOf("orders") } // "orders" or "revenue"
    val currentYear = java.util.Calendar.getInstance().get(java.util.Calendar.YEAR).toString()
    val prevYear = (currentYear.toInt() - 1).toString()
    var activeYear by remember { mutableStateOf(currentYear) }

    val topCategories = categoryAnalytics?.topCategories ?: emptyList()
    val trends = categoryAnalytics?.monthlyTrendsByYear?.get(activeYear) ?: emptyList()

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(modifier = Modifier.padding(18.dp)) {
            // Header Row
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Text(
                            text = "Purchase Analytics",
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold,
                            color = Slate900
                        )
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(8.dp))
                                .background(Color(0xFFEFF6FF))
                                .padding(horizontal = 6.dp, vertical = 2.dp)
                        ) {
                            Text(
                                text = "Monthly Category Trends",
                                fontSize = 10.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = PrimaryBlue
                            )
                        }
                    }
                    Text(
                        text = "Category volume comparison",
                        fontSize = 11.sp,
                        color = Slate400
                    )
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Switchers Row: Orders vs Revenue & Year Selector
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Metric toggle: Orders / Revenue
                Row(
                    modifier = Modifier
                        .clip(RoundedCornerShape(10.dp))
                        .background(Slate100)
                        .padding(2.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(8.dp))
                            .background(if (activeMetric == "orders") Color.White else Color.Transparent)
                            .clickable { activeMetric = "orders" }
                            .padding(horizontal = 10.dp, vertical = 4.dp)
                    ) {
                        Text(
                            text = "Orders",
                            fontSize = 11.sp,
                            fontWeight = if (activeMetric == "orders") FontWeight.Bold else FontWeight.Medium,
                            color = if (activeMetric == "orders") Slate900 else Slate500
                        )
                    }
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(8.dp))
                            .background(if (activeMetric == "revenue") Color.White else Color.Transparent)
                            .clickable { activeMetric = "revenue" }
                            .padding(horizontal = 10.dp, vertical = 4.dp)
                    ) {
                        Text(
                            text = "Revenue",
                            fontSize = 11.sp,
                            fontWeight = if (activeMetric == "revenue") FontWeight.Bold else FontWeight.Medium,
                            color = if (activeMetric == "revenue") Slate900 else Slate500
                        )
                    }
                }

                // Year selector: PrevYear / CurrentYear
                Row(
                    modifier = Modifier
                        .clip(RoundedCornerShape(10.dp))
                        .background(Slate100)
                        .padding(2.dp)
                ) {
                    listOf(prevYear, currentYear).forEach { yr ->
                        val isSelected = activeYear == yr
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(8.dp))
                                .background(if (isSelected) Color.White else Color.Transparent)
                                .clickable { activeYear = yr }
                                .padding(horizontal = 8.dp, vertical = 4.dp)
                        ) {
                            Text(
                                text = yr,
                                fontSize = 11.sp,
                                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                                color = if (isSelected) Slate900 else Slate500
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(14.dp))

            // Category Legend
            val displayedCats = topCategories.take(5)
            if (displayedCats.isNotEmpty()) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    displayedCats.forEach { cat ->
                        val parsedColor = try {
                            Color(android.graphics.Color.parseColor(cat.color))
                        } catch (_: Exception) {
                            PrimaryBlue
                        }
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(10.dp))
                                .background(Slate50)
                                .padding(horizontal = 8.dp, vertical = 4.dp)
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(4.dp)
                            ) {
                                Box(modifier = Modifier.size(6.dp).clip(CircleShape).background(parsedColor))
                                Text(
                                    text = if (cat.name.length > 5) "${cat.name.take(4)}.." else cat.name,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Medium,
                                    color = Slate700
                                )
                                Text(
                                    text = if (activeMetric == "orders") "${cat.totalOrders} (${cat.percentage}%)"
                                    else "${viewModel.formatCurrency(cat.totalRevenue)} (${cat.percentage}%)",
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = Slate900
                                )
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(14.dp))
            }

            // Monthly Clustered Bars Chart (Jan - Dec)
            if (trends.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(100.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text("No category records for $activeYear", fontSize = 12.sp, color = Slate400)
                }
            } else {
                val maxVal = trends.maxOfOrNull { m ->
                    displayedCats.maxOfOrNull { cat ->
                        val metric = m.byCategory[cat.id]
                        if (activeMetric == "orders") (metric?.orders?.toDouble() ?: 0.0)
                        else (metric?.revenue ?: 0.0)
                    } ?: 0.0
                }?.coerceAtLeast(if (activeMetric == "orders") 4.0 else 50.0) ?: 4.0

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(130.dp)
                        .horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalAlignment = Alignment.Bottom
                ) {
                    trends.forEach { mTrend ->
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            modifier = Modifier
                                .width(28.dp)
                                .fillMaxHeight()
                        ) {
                            Row(
                                modifier = Modifier
                                    .weight(1f)
                                    .fillMaxWidth(),
                                horizontalArrangement = Arrangement.Center,
                                verticalAlignment = Alignment.Bottom
                            ) {
                                displayedCats.forEach { cat ->
                                    val catMetric = mTrend.byCategory[cat.id]
                                    val valNum = if (activeMetric == "orders") {
                                        catMetric?.orders?.toDouble() ?: 0.0
                                    } else {
                                        catMetric?.revenue ?: 0.0
                                    }
                                    val heightRatio = (valNum / maxVal).toFloat().coerceIn(0f, 1f)
                                    val parsedColor = try {
                                        Color(android.graphics.Color.parseColor(cat.color))
                                    } catch (_: Exception) {
                                        PrimaryBlue
                                    }

                                    if (valNum > 0) {
                                        Box(
                                            modifier = Modifier
                                                .fillMaxHeight(heightRatio.coerceAtLeast(0.1f))
                                                .width(4.dp)
                                                .clip(RoundedCornerShape(topStart = 2.dp, topEnd = 2.dp))
                                                .background(parsedColor)
                                        )
                                        Spacer(modifier = Modifier.width(1.dp))
                                    }
                                }
                            }
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = mTrend.month,
                                fontSize = 9.sp,
                                color = Slate400,
                                textAlign = TextAlign.Center
                            )
                        }
                    }
                }
            }
        }
    }
}

/* =====================================================================
   CARD 6: Recent Orders
   ===================================================================== */
@Composable
private fun RecentOrdersCard(
    recentOrders: List<RecentOrderDto>,
    viewModel: DashboardViewModel,
    onNavigateToOrders: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(modifier = Modifier.padding(18.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Recent Orders",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    color = Slate900
                )
                Text(
                    text = "View Orders",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PrimaryBlue,
                    modifier = Modifier
                        .clickable { onNavigateToOrders() }
                        .padding(vertical = 4.dp, horizontal = 4.dp)
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            if (recentOrders.isEmpty()) {
                Text(
                    text = "No recent orders found.",
                    fontSize = 13.sp,
                    color = Slate400,
                    modifier = Modifier.padding(vertical = 12.dp)
                )
            } else {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    recentOrders.take(5).forEach { order ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 6.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = order.productName + if (!order.planName.isNullOrBlank()) " (${order.planName})" else "",
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    color = Slate900,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                                Spacer(modifier = Modifier.height(2.dp))
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(
                                        Icons.Default.CalendarToday,
                                        contentDescription = null,
                                        tint = Slate400,
                                        modifier = Modifier.size(11.dp)
                                    )
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text(
                                        text = "${order.startDate} → ${order.endDate}",
                                        fontSize = 11.sp,
                                        color = Slate500
                                    )
                                }
                            }
                            Text(
                                text = viewModel.formatCurrency(order.price, order.currency),
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Bold,
                                color = Slate900
                            )
                        }
                        HorizontalDivider(color = Slate100)
                    }
                }
            }
        }
    }
}

/* =====================================================================
   CARD 7: Top Selling Products (Paginated)
   ===================================================================== */
@Composable
private fun TopSellingProductsCard(
    topProducts: List<TopProductDto>,
    viewModel: DashboardViewModel
) {
    var currentPage by remember { mutableStateOf(0) }
    val pageSize = 4
    val maxPages = ((topProducts.size + pageSize - 1) / pageSize).coerceAtLeast(1)
    val pageItems = topProducts.drop(currentPage * pageSize).take(pageSize)

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(modifier = Modifier.padding(18.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Top Selling Products",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    color = Slate900
                )

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    Text(
                        text = "Page ${currentPage + 1} of $maxPages",
                        fontSize = 11.sp,
                        color = Slate400
                    )
                    IconButton(
                        onClick = { if (currentPage > 0) currentPage-- },
                        enabled = currentPage > 0,
                        modifier = Modifier.size(24.dp)
                    ) {
                        Icon(
                            Icons.Default.ChevronLeft,
                            contentDescription = "Prev",
                            tint = if (currentPage > 0) Slate700 else Slate300
                        )
                    }
                    IconButton(
                        onClick = { if (currentPage < maxPages - 1) currentPage++ },
                        enabled = currentPage < maxPages - 1,
                        modifier = Modifier.size(24.dp)
                    ) {
                        Icon(
                            Icons.Default.ChevronRight,
                            contentDescription = "Next",
                            tint = if (currentPage < maxPages - 1) Slate700 else Slate300
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            if (topProducts.isEmpty()) {
                Text(
                    text = "No sales recorded yet.",
                    fontSize = 13.sp,
                    color = Slate400,
                    modifier = Modifier.padding(vertical = 12.dp)
                )
            } else {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    pageItems.forEach { product ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 6.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier.weight(1f)
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(34.dp)
                                        .clip(CircleShape)
                                        .background(PrimaryBlue.copy(alpha = 0.1f)),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text(
                                        text = product.name.take(1).uppercase(),
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 14.sp,
                                        color = PrimaryBlue
                                    )
                                }
                                Spacer(modifier = Modifier.width(10.dp))
                                Column {
                                    Text(
                                        text = product.name,
                                        fontSize = 13.sp,
                                        fontWeight = FontWeight.SemiBold,
                                        color = Slate900,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                                    ) {
                                        Text(
                                            text = "${product.orderCount} orders",
                                            fontSize = 11.sp,
                                            color = Slate400
                                        )
                                        if (!product.brand.isNullOrBlank()) {
                                            Box(
                                                modifier = Modifier
                                                    .clip(RoundedCornerShape(4.dp))
                                                    .background(Slate100)
                                                    .padding(horizontal = 4.dp, vertical = 1.dp)
                                            ) {
                                                Text(
                                                    text = product.brand,
                                                    fontSize = 9.sp,
                                                    color = Slate600
                                                )
                                            }
                                        }
                                    }
                                }
                            }
                            Text(
                                text = viewModel.formatCurrency(product.totalRevenue),
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Bold,
                                color = Slate900
                            )
                        }
                        HorizontalDivider(color = Slate100)
                    }
                }
            }
        }
    }
}

/* =====================================================================
   CARD 8: Inventory Management
   ===================================================================== */
@Composable
private fun InventoryManagementCard(
    inventory: InventoryStatsDto,
    onNavigateToInventory: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(modifier = Modifier.padding(18.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Inventory Management",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    color = Slate900
                )
                Text(
                    text = "View Bank",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PrimaryBlue,
                    modifier = Modifier
                        .clickable { onNavigateToInventory() }
                        .padding(vertical = 4.dp, horizontal = 4.dp)
                )
            }

            Spacer(modifier = Modifier.height(14.dp))

            // 3-Metric Summary Box
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(14.dp))
                    .background(Color(0xFFF8FAFC))
                    .padding(12.dp),
                horizontalArrangement = Arrangement.SpaceAround
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("STOCK STATUS", fontSize = 9.sp, fontWeight = FontWeight.SemiBold, color = Slate400)
                    Spacer(modifier = Modifier.height(2.dp))
                    Text("${inventory.stockStatus}%", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = Slate800)
                }
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("TURNOVER", fontSize = 9.sp, fontWeight = FontWeight.SemiBold, color = Slate400)
                    Spacer(modifier = Modifier.height(2.dp))
                    Text("${inventory.turnoverRate}%", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = Slate800)
                }
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("ORDERED", fontSize = 9.sp, fontWeight = FontWeight.SemiBold, color = Slate400)
                    Spacer(modifier = Modifier.height(2.dp))
                    Text("${inventory.productsOrdered}%", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = Slate800)
                }
            }

            Spacer(modifier = Modifier.height(14.dp))

            // Progress Bars
            val progressItems = listOf(
                Triple("Active Subscriptions", inventory.activeSubsPercent.toInt().coerceIn(0, 100), PrimaryBlue),
                Triple("Assigned Profiles", inventory.assignedProfilesPercent.toInt().coerceIn(0, 100), Color(0xFF10B981)),
                Triple("Unallocated Keys", inventory.unallocatedKeysPercent.toInt().coerceIn(0, 100), Color(0xFF8B5CF6))
            )

            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                progressItems.forEach { (label, pct, barColor) ->
                    Column {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(label, fontSize = 12.sp, color = Slate600)
                            Text("$pct%", fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = Slate800)
                        }
                        Spacer(modifier = Modifier.height(4.dp))
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(6.dp)
                                .clip(RoundedCornerShape(3.dp))
                                .background(Slate100)
                        ) {
                            Box(
                                modifier = Modifier
                                    .fillMaxHeight()
                                    .fillMaxWidth(pct.toFloat() / 100f)
                                    .clip(RoundedCornerShape(3.dp))
                                    .background(barColor)
                            )
                        }
                    }
                }
            }
        }
    }
}
