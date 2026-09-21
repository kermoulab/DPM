package com.vectis.erp.feature.orders

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
import com.vectis.erp.data.model.OrderDto

@Suppress("DEPRECATION")
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OrderListScreen(
    viewModel: OrderViewModel,
    onOrderClick: (String) -> Unit,
    onCreateOrderClick: () -> Unit
) {
    val uiState by viewModel.listUiState.collectAsState()
    val context = LocalContext.current

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("Orders", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = Slate900)
                        Text("Subscriptions & Product Sales", fontSize = 12.sp, color = Slate500)
                    }
                },
                actions = {
                    IconButton(onClick = { viewModel.loadOrders(isRefresh = true) }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Refresh", tint = PrimaryBlue)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Color.White)
            )
        },
        floatingActionButton = {
            if (viewModel.permissionManager.canCreateOrder()) {
                FloatingActionButton(
                    onClick = onCreateOrderClick,
                    containerColor = PrimaryBlue,
                    contentColor = Color.White,
                    shape = CircleShape
                ) {
                    Icon(Icons.Default.Add, contentDescription = "Create Order")
                }
            }
        },
        containerColor = Slate50
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            // Search Input
            var searchText by remember { mutableStateOf("") }
            OutlinedTextField(
                value = searchText,
                onValueChange = {
                    searchText = it
                    viewModel.onSearchQueryChanged(it)
                },
                placeholder = { Text("Search by order #, customer, or product...", fontSize = 14.sp, color = Slate400) },
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, tint = Slate400) },
                trailingIcon = {
                    if (searchText.isNotEmpty()) {
                        IconButton(onClick = {
                            searchText = ""
                            viewModel.onSearchQueryChanged("")
                        }) {
                            Icon(Icons.Default.Close, contentDescription = "Clear", tint = Slate400)
                        }
                    }
                },
                singleLine = true,
                shape = RoundedCornerShape(16.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedContainerColor = Color.White,
                    unfocusedContainerColor = Color.White,
                    focusedBorderColor = PrimaryBlue,
                    unfocusedBorderColor = Slate200
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp)
            )

            // Status Filter Chips
            var selectedFilter by remember { mutableStateOf<String?>(null) }
            val counts = (uiState as? OrderListUiState.Success)?.counts ?: emptyMap()

            LazyRow(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 4.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                item {
                    FilterChip(
                        selected = selectedFilter == null,
                        onClick = {
                            selectedFilter = null
                            viewModel.onStatusFilterChanged(null)
                        },
                        label = { Text("All (${counts["all"] ?: counts.values.sum()})") },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = PrimaryBlue.copy(alpha = 0.1f),
                            selectedLabelColor = PrimaryBlue
                        )
                    )
                }
                item {
                    FilterChip(
                        selected = selectedFilter == "active",
                        onClick = {
                            selectedFilter = "active"
                            viewModel.onStatusFilterChanged("active")
                        },
                        label = { Text("Active (${counts["active"] ?: 0})") },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = StatusSuccess.copy(alpha = 0.1f),
                            selectedLabelColor = StatusSuccess
                        )
                    )
                }
                item {
                    FilterChip(
                        selected = selectedFilter == "expiring",
                        onClick = {
                            selectedFilter = "expiring"
                            viewModel.onStatusFilterChanged("expiring")
                        },
                        label = { Text("Expiring (${counts["expiring"] ?: 0})") },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = StatusWarning.copy(alpha = 0.1f),
                            selectedLabelColor = StatusWarning
                        )
                    )
                }
                item {
                    FilterChip(
                        selected = selectedFilter == "expired",
                        onClick = {
                            selectedFilter = "expired"
                            viewModel.onStatusFilterChanged("expired")
                        },
                        label = { Text("Expired (${counts["expired"] ?: 0})") },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = StatusDanger.copy(alpha = 0.1f),
                            selectedLabelColor = StatusDanger
                        )
                    )
                }
            }

            Spacer(modifier = Modifier.height(4.dp))

            when (val state = uiState) {
                is OrderListUiState.Loading -> {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(color = PrimaryBlue)
                    }
                }
                is OrderListUiState.Error -> {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.padding(24.dp)) {
                            Icon(Icons.Default.Warning, contentDescription = null, tint = StatusDanger, modifier = Modifier.size(48.dp))
                            Spacer(modifier = Modifier.height(12.dp))
                            Text(text = state.message, color = Slate700, fontSize = 14.sp)
                            Spacer(modifier = Modifier.height(16.dp))
                            Button(onClick = { viewModel.loadOrders() }) {
                                Text("Retry")
                            }
                        }
                    }
                }
                is OrderListUiState.Success -> {
                    if (state.orders.isEmpty()) {
                        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.padding(24.dp)) {
                                Icon(Icons.Default.ReceiptLong, contentDescription = null, tint = Slate300, modifier = Modifier.size(56.dp))
                                Spacer(modifier = Modifier.height(12.dp))
                                Text(
                                    text = if (searchText.isNotBlank()) "No orders match \"$searchText\"" else "No orders registered yet.",
                                    color = Slate500,
                                    fontSize = 15.sp,
                                    fontWeight = FontWeight.Medium
                                )
                            }
                        }
                    } else {
                        LazyColumn(
                            modifier = Modifier.fillMaxSize(),
                            contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 8.dp, bottom = 80.dp),
                            verticalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            items(state.orders, key = { it.id }) { order ->
                                OrderCard(
                                    order = order,
                                    viewModel = viewModel,
                                    onClick = { onOrderClick(order.id) },
                                    onWhatsAppClick = {
                                        viewModel.sendWhatsAppReceipt(context, order)
                                    }
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
private fun OrderCard(
    order: OrderDto,
    viewModel: OrderViewModel,
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
            // Row 1: Order number & Status chip
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = order.orderNumber,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.Monospace,
                    color = PrimaryBlue
                )

                val (statusBg, statusFg) = when (order.status.lowercase()) {
                    "active" -> StatusSuccess.copy(alpha = 0.1f) to StatusSuccess
                    "expiring" -> StatusWarning.copy(alpha = 0.1f) to StatusWarning
                    "expired" -> StatusDanger.copy(alpha = 0.1f) to StatusDanger
                    "cancelled" -> Slate200 to Slate600
                    else -> Slate100 to Slate600
                }

                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(6.dp))
                        .background(statusBg)
                        .padding(horizontal = 8.dp, vertical = 3.dp)
                ) {
                    Text(
                        text = order.status.replaceFirstChar { it.uppercase() },
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = statusFg
                    )
                }
            }

            Spacer(modifier = Modifier.height(6.dp))

            // Row 2: Customer name & Price
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = order.customerName ?: "Customer",
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold,
                    color = Slate900,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Text(
                    text = viewModel.formatCurrency(order.price),
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold,
                    color = Slate900
                )
            }

            Spacer(modifier = Modifier.height(4.dp))

            // Row 3: Product + Plan
            Text(
                text = "${order.productName ?: "Product"} • ${order.planName ?: "Plan"}",
                fontSize = 13.sp,
                color = Slate600,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )

            Spacer(modifier = Modifier.height(8.dp))
            HorizontalDivider(color = Slate100)
            Spacer(modifier = Modifier.height(8.dp))

            // Row 4: Validity & WhatsApp receipt trigger
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = if (!order.endDate.isNullOrBlank()) "Valid: ${order.startDate ?: ""} → ${order.endDate}" else "One-time Purchase",
                    fontSize = 11.sp,
                    color = Slate500
                )

                if (!order.customerWhatsapp.isNullOrBlank()) {
                    IconButton(
                        onClick = onWhatsAppClick,
                        modifier = Modifier.size(28.dp)
                    ) {
                        @Suppress("DEPRECATION")
                        Icon(
                            imageVector = Icons.Default.Chat,
                            contentDescription = "WhatsApp Receipt",
                            tint = Color(0xFF128C7E),
                            modifier = Modifier.size(16.dp)
                        )
                    }
                }
            }
        }
    }
}
