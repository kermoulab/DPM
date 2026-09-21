package com.vectis.erp.feature.alerts

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.vectis.erp.core.design.*
import com.vectis.erp.data.model.AlertOrderDto
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AlertsScreen(
    viewModel: AlertsViewModel,
    onOrderClick: (String) -> Unit
) {
    val uiState by viewModel.uiState.collectAsState()
    val context = LocalContext.current
    val snackbarHostState = remember { SnackbarHostState() }
    val coroutineScope = rememberCoroutineScope()

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("Subscription Alerts", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = Slate900)
                        Text("Expiring & Expired Accounts", fontSize = 12.sp, color = Slate500)
                    }
                },
                actions = {
                    IconButton(onClick = { viewModel.loadAlerts(isRefresh = true) }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Refresh", tint = PrimaryBlue)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Color.White)
            )
        },
        containerColor = Slate50
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            when (val state = uiState) {
                is AlertsUiState.Loading -> {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(color = PrimaryBlue)
                    }
                }
                is AlertsUiState.Error -> {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.padding(24.dp)) {
                            Icon(Icons.Default.Warning, contentDescription = null, tint = StatusDanger, modifier = Modifier.size(48.dp))
                            Spacer(modifier = Modifier.height(12.dp))
                            Text(text = state.message, color = Slate700, fontSize = 14.sp)
                            Spacer(modifier = Modifier.height(16.dp))
                            Button(onClick = { viewModel.loadAlerts() }) {
                                Text("Retry")
                            }
                        }
                    }
                }
                is AlertsUiState.Success -> {
                    // Language bar for WhatsApp templates
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(Color.White)
                            .padding(horizontal = 16.dp, vertical = 8.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("Template Language:", fontSize = 12.sp, fontWeight = FontWeight.Medium, color = Slate600)
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            listOf("en" to "EN", "fr" to "FR", "ar" to "AR", "ru" to "RU").forEach { (code, label) ->
                                val isSel = state.selectedLanguage == code
                                Box(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(8.dp))
                                        .background(if (isSel) PrimaryBlue else Slate100)
                                        .clickable { viewModel.setLanguage(code) }
                                        .padding(horizontal = 10.dp, vertical = 4.dp)
                                ) {
                                    Text(
                                        text = label,
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = if (isSel) Color.White else Slate700
                                    )
                                }
                            }
                        }
                    }

                    HorizontalDivider(color = Slate100)

                    // Filter tabs
                    TabRow(
                        selectedTabIndex = state.activeFilter.ordinal,
                        containerColor = Color.White,
                        contentColor = PrimaryBlue
                    ) {
                        AlertsFilter.entries.forEach { filter ->
                            val count = when (filter) {
                                AlertsFilter.EXPIRING -> state.expiringOrders.size
                                AlertsFilter.EXPIRED -> state.expiredOrders.size
                                AlertsFilter.LOW_STOCK -> state.lowStockAccounts.size + state.lowInventory.size
                            }
                            Tab(
                                selected = state.activeFilter == filter,
                                onClick = { viewModel.setFilter(filter) },
                                text = {
                                    Text(
                                        text = "${filter.title} ($count)",
                                        fontSize = 12.sp,
                                        fontWeight = if (state.activeFilter == filter) FontWeight.Bold else FontWeight.Normal
                                    )
                                }
                            )
                        }
                    }

                    // Content
                    when (state.activeFilter) {
                        AlertsFilter.EXPIRING -> {
                            if (state.expiringOrders.isEmpty()) {
                                EmptyAlertsState("No subscriptions expiring in the next 7 days.")
                            } else {
                                LazyColumn(
                                    modifier = Modifier.fillMaxSize(),
                                    contentPadding = PaddingValues(16.dp),
                                    verticalArrangement = Arrangement.spacedBy(10.dp)
                                ) {
                                    items(state.expiringOrders, key = { it.id }) { order ->
                                        AlertOrderCard(
                                            order = order,
                                            viewModel = viewModel,
                                            isExpired = false,
                                            onClick = { onOrderClick(order.id) },
                                            onWhatsAppClick = {
                                                viewModel.sendWhatsAppAlert(context, order, "order_expiring") { err ->
                                                    coroutineScope.launch {
                                                        snackbarHostState.showSnackbar(err)
                                                    }
                                                }
                                            }
                                        )
                                    }
                                }
                            }
                        }
                        AlertsFilter.EXPIRED -> {
                            if (state.expiredOrders.isEmpty()) {
                                EmptyAlertsState("No expired subscriptions.")
                            } else {
                                LazyColumn(
                                    modifier = Modifier.fillMaxSize(),
                                    contentPadding = PaddingValues(16.dp),
                                    verticalArrangement = Arrangement.spacedBy(10.dp)
                                ) {
                                    items(state.expiredOrders, key = { it.id }) { order ->
                                        AlertOrderCard(
                                            order = order,
                                            viewModel = viewModel,
                                            isExpired = true,
                                            onClick = { onOrderClick(order.id) },
                                            onWhatsAppClick = {
                                                viewModel.sendWhatsAppAlert(context, order, "order_expired") { err ->
                                                    coroutineScope.launch {
                                                        snackbarHostState.showSnackbar(err)
                                                    }
                                                }
                                            }
                                        )
                                    }
                                }
                            }
                        }
                        AlertsFilter.LOW_STOCK -> {
                            LowStockTabContent(state.lowStockAccounts, state.lowInventory)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun AlertOrderCard(
    order: AlertOrderDto,
    viewModel: AlertsViewModel,
    isExpired: Boolean,
    onClick: () -> Unit,
    onWhatsAppClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() },
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = order.orderNumber,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.Monospace,
                    color = PrimaryBlue
                )

                val badgeText = if (isExpired) {
                    val days = order.daysExpired ?: 0
                    if (days == 0) "Expired today" else "Expired $days d ago"
                } else {
                    val days = order.daysRemaining ?: 0
                    if (days == 0) "Expires today" else "Expires in $days d"
                }

                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(6.dp))
                        .background(if (isExpired) StatusDanger.copy(alpha = 0.1f) else StatusWarning.copy(alpha = 0.1f))
                        .padding(horizontal = 8.dp, vertical = 3.dp)
                ) {
                    Text(
                        text = badgeText,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = if (isExpired) StatusDanger else StatusWarning
                    )
                }
            }

            Spacer(modifier = Modifier.height(6.dp))

            // Customer Name & Product
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = order.customerName ?: "Customer",
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold,
                        color = Slate900,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    Spacer(modifier = Modifier.height(2.dp))
                    Text(
                        text = "${order.productName} • ${order.planName}",
                        fontSize = 12.sp,
                        color = Slate600,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }

                Text(
                    text = viewModel.formatCurrency(order.price),
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    color = Slate900
                )
            }

            Spacer(modifier = Modifier.height(10.dp))
            HorizontalDivider(color = Slate100)
            Spacer(modifier = Modifier.height(8.dp))

            // WhatsApp action button
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Expiry: ${order.endDate ?: "N/A"}",
                    fontSize = 11.sp,
                    color = Slate500
                )

                if (!order.customerWhatsapp.isNullOrBlank()) {
                    Button(
                        onClick = onWhatsAppClick,
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF25D366)),
                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp),
                        shape = RoundedCornerShape(8.dp),
                        modifier = Modifier.height(32.dp)
                    ) {
                        @Suppress("DEPRECATION")
                        Icon(
                            Icons.Default.Chat,
                            contentDescription = null,
                            tint = Color.White,
                            modifier = Modifier.size(14.dp)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Notify WhatsApp", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color.White)
                    }
                }
            }
        }
    }
}

@Composable
private fun LowStockTabContent(
    accounts: List<com.vectis.erp.data.model.LowStockAccountDto>,
    licenses: List<com.vectis.erp.data.model.LowInventoryDto>
) {
    if (accounts.isEmpty() && licenses.isEmpty()) {
        EmptyAlertsState("All inventory pools are healthy and stocked.")
    } else {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            if (accounts.isNotEmpty()) {
                item {
                    Text("Low Stock Accounts (<= 1 slot free)", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = Slate700)
                }
                items(accounts) { acc ->
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                        colors = CardDefaults.cardColors(containerColor = Color.White),
                        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(12.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text(acc.provider, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                                Text(acc.productName ?: "", fontSize = 12.sp, color = Slate500)
                            }
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(6.dp))
                                    .background(StatusDanger.copy(alpha = 0.1f))
                                    .padding(horizontal = 8.dp, vertical = 3.dp)
                            ) {
                                Text(
                                    "${acc.availableProfiles} / ${acc.totalProfiles} avail",
                                    color = StatusDanger,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 11.sp
                                )
                            }
                        }
                    }
                }
            }

            if (licenses.isNotEmpty()) {
                item {
                    Spacer(modifier = Modifier.height(6.dp))
                    Text("Low License Key Pools (< 3 keys)", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = Slate700)
                }
                items(licenses) { lic ->
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                        colors = CardDefaults.cardColors(containerColor = Color.White),
                        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(12.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(lic.name, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(6.dp))
                                    .background(StatusWarning.copy(alpha = 0.1f))
                                    .padding(horizontal = 8.dp, vertical = 3.dp)
                            ) {
                                Text(
                                    "${lic.availableCount} keys left",
                                    color = StatusWarning,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 11.sp
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun EmptyAlertsState(message: String) {
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.padding(24.dp)) {
            Icon(Icons.Default.CheckCircle, contentDescription = null, tint = StatusSuccess, modifier = Modifier.size(48.dp))
            Spacer(modifier = Modifier.height(12.dp))
            Text(text = message, color = Slate600, fontSize = 14.sp, fontWeight = FontWeight.Medium)
        }
    }
}
