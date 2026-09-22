package com.vectis.erp.feature.dashboard

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.vectis.erp.core.design.*
import com.vectis.erp.data.model.DashboardStatsDto
import com.vectis.erp.data.model.RecentOrderDto
import com.vectis.erp.data.model.TopProductDto

@OptIn(ExperimentalMaterial3Api::class)
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

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("Vectis ERP", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = Slate900)
                        Text("Business Overview", fontSize = 12.sp, color = Slate500)
                    }
                },
                actions = {
                    IconButton(onClick = onOpenSearch) {
                        Icon(Icons.Default.Search, contentDescription = "Global Search", tint = Slate700)
                    }
                    IconButton(onClick = onNavigateToAlerts) {
                        Icon(Icons.Default.Notifications, contentDescription = "Alerts", tint = PrimaryBlue)
                    }
                    IconButton(onClick = onNavigateToSettings) {
                        Icon(Icons.Default.Settings, contentDescription = "Settings", tint = Slate700)
                    }
                    IconButton(onClick = { viewModel.loadStats() }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Refresh", tint = Slate500)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Color.White)
            )
        },
        containerColor = Slate50
    ) { paddingValues ->
        Box(
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
                        Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.padding(24.dp)) {
                            Icon(Icons.Default.Warning, contentDescription = null, tint = StatusDanger, modifier = Modifier.size(48.dp))
                            Spacer(modifier = Modifier.height(12.dp))
                            Text(text = state.message, color = Slate700, fontSize = 14.sp)
                            Spacer(modifier = Modifier.height(16.dp))
                            Button(onClick = { viewModel.loadStats() }) {
                                Text("Retry")
                            }
                        }
                    }
                }
                is DashboardUiState.Success -> {
                    DashboardContent(
                        stats = state.stats,
                        viewModel = viewModel,
                        onNavigateToOrders = onNavigateToOrders,
                        onNavigateToInventory = onNavigateToInventory
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
    onNavigateToInventory: () -> Unit
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Row 1: KPI Summary Cards
        item {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    KpiCard(
                        title = "Total Revenue",
                        value = viewModel.formatCurrency(stats.financial.totalRevenue),
                        subtext = "Profit: ${viewModel.formatCurrency(stats.financial.grossProfit)}",
                        icon = Icons.Default.AttachMoney,
                        iconBg = StatusSuccess.copy(alpha = 0.1f),
                        iconTint = StatusSuccess,
                        modifier = Modifier.weight(1f)
                    )
                    KpiCard(
                        title = "Active Subscriptions",
                        value = "${stats.orders.active}",
                        subtext = "${stats.orders.expiring} expiring soon",
                        icon = Icons.Default.CheckCircle,
                        iconBg = PrimaryBlue.copy(alpha = 0.1f),
                        iconTint = PrimaryBlue,
                        modifier = Modifier.weight(1f)
                    )
                }
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    KpiCard(
                        title = "Total Customers",
                        value = "${stats.customers.total}",
                        subtext = "${stats.customers.active} active accounts",
                        icon = Icons.Default.People,
                        iconBg = StatusPurple.copy(alpha = 0.1f),
                        iconTint = StatusPurple,
                        modifier = Modifier.weight(1f)
                    )
                    KpiCard(
                        title = "Inventory Slots",
                        value = "${stats.inventory.availableProfiles} Avail",
                        subtext = "${stats.inventory.totalProfiles} total profiles",
                        icon = Icons.Default.Inventory2,
                        iconBg = StatusWarning.copy(alpha = 0.1f),
                        iconTint = StatusWarning,
                        modifier = Modifier.weight(1f)
                    )
                }
            }
        }

        // Row 2: Recent Orders (Streamlined: Product name, term, price, text link on right)
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(20.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "Recent Orders",
                            fontSize = 15.sp,
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
                                .padding(vertical = 4.dp, horizontal = 8.dp)
                        )
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    if (stats.recentOrders.isEmpty()) {
                        Text(
                            text = "No recent orders found.",
                            fontSize = 13.sp,
                            color = Slate400,
                            modifier = Modifier.padding(vertical = 16.dp)
                        )
                    } else {
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            stats.recentOrders.take(5).forEach { order ->
                                RecentOrderRow(order = order, viewModel = viewModel)
                                HorizontalDivider(color = Slate100)
                            }
                        }
                    }
                }
            }
        }

        // Row 3: Top Selling Products
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(20.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = "Top Selling Products",
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold,
                        color = Slate900
                    )

                    Spacer(modifier = Modifier.height(12.dp))

                    if (stats.topProducts.isEmpty()) {
                        Text(
                            text = "No sales recorded yet.",
                            fontSize = 13.sp,
                            color = Slate400,
                            modifier = Modifier.padding(vertical = 12.dp)
                        )
                    } else {
                        stats.topProducts.take(4).forEach { product ->
                            TopProductRow(product = product, viewModel = viewModel)
                            HorizontalDivider(color = Slate100)
                        }
                    }
                }
            }
        }

        // Row 4: Inventory Health Card
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(20.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "Inventory Management",
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Bold,
                            color = Slate900
                        )
                        Text(
                            text = "View Bank",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = PrimaryBlue,
                            modifier = Modifier.clickable { onNavigateToInventory() }
                        )
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(12.dp))
                            .background(Slate50)
                            .padding(12.dp),
                        horizontalArrangement = Arrangement.SpaceAround
                    ) {
                        InventoryMetricItem(label = "Stock Status", value = "${stats.inventory.stockStatus}%")
                        InventoryMetricItem(label = "Turnover", value = "${stats.inventory.turnoverRate}%")
                        InventoryMetricItem(label = "Ordered", value = "${stats.inventory.productsOrdered}%")
                    }
                }
            }
        }
    }
}

@Composable
private fun KpiCard(
    title: String,
    value: String,
    subtext: String,
    icon: ImageVector,
    iconBg: Color,
    iconTint: Color,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Box(
                modifier = Modifier
                    .size(36.dp)
                    .clip(RoundedCornerShape(10.dp))
                    .background(iconBg),
                contentAlignment = Alignment.Center
            ) {
                Icon(icon, contentDescription = null, tint = iconTint, modifier = Modifier.size(20.dp))
            }
            Spacer(modifier = Modifier.height(10.dp))
            Text(title, fontSize = 11.sp, fontWeight = FontWeight.Medium, color = Slate500)
            Spacer(modifier = Modifier.height(2.dp))
            Text(value, fontSize = 18.sp, fontWeight = FontWeight.Bold, color = Slate900)
            Spacer(modifier = Modifier.height(2.dp))
            Text(subtext, fontSize = 10.sp, color = Slate400)
        }
    }
}

@Composable
private fun RecentOrderRow(
    order: RecentOrderDto,
    viewModel: DashboardViewModel
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp),
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
                Icon(Icons.Default.CalendarToday, contentDescription = null, tint = Slate400, modifier = Modifier.size(12.dp))
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
}

@Composable
private fun TopProductRow(
    product: TopProductDto,
    viewModel: DashboardViewModel
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.weight(1f)) {
            Box(
                modifier = Modifier
                    .size(32.dp)
                    .clip(CircleShape)
                    .background(PrimaryBlue.copy(alpha = 0.1f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(Icons.Default.ShoppingBag, contentDescription = null, tint = PrimaryBlue, modifier = Modifier.size(16.dp))
            }
            Spacer(modifier = Modifier.width(10.dp))
            Column {
                Text(product.name, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = Slate900)
                Text("${product.orderCount} orders", fontSize = 11.sp, color = Slate400)
            }
        }
        Text(
            text = viewModel.formatCurrency(product.totalRevenue),
            fontSize = 13.sp,
            fontWeight = FontWeight.Bold,
            color = Slate900
        )
    }
}

@Composable
private fun InventoryMetricItem(label: String, value: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(label.uppercase(), fontSize = 9.sp, fontWeight = FontWeight.SemiBold, color = Slate400)
        Spacer(modifier = Modifier.height(2.dp))
        Text(value, fontSize = 15.sp, fontWeight = FontWeight.Bold, color = Slate800)
    }
}
