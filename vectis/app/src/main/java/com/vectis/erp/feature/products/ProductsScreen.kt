package com.vectis.erp.feature.products

import androidx.compose.foundation.background
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.vectis.erp.core.design.*
import com.vectis.erp.data.model.ProductDto
import com.vectis.erp.feature.inventory.InventoryUiState
import com.vectis.erp.feature.inventory.InventoryViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProductsScreen(
    viewModel: InventoryViewModel,
    onProductClick: (String) -> Unit = {}
) {
    val uiState by viewModel.uiState.collectAsState()
    var searchQuery by remember { mutableStateOf("") }
    var selectedFilter by remember { mutableStateOf("all") }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("Products & Plans", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = Slate900)
                        Text("Catalog & Subscription Tiers", fontSize = 12.sp, color = Slate500)
                    }
                },
                actions = {
                    IconButton(onClick = { viewModel.loadData(isRefresh = true) }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Refresh", tint = PrimaryBlue)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Color.White)
            )
        },
        containerColor = Slate50
    ) { paddingValues ->
        when (val state = uiState) {
            is InventoryUiState.Loading -> {
                Box(modifier = Modifier.fillMaxSize().padding(paddingValues), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = PrimaryBlue)
                }
            }
            is InventoryUiState.Error -> {
                Box(modifier = Modifier.fillMaxSize().padding(paddingValues), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.padding(24.dp)) {
                        Icon(Icons.Default.Warning, contentDescription = null, tint = StatusDanger, modifier = Modifier.size(48.dp))
                        Spacer(modifier = Modifier.height(12.dp))
                        Text(text = state.message, color = Slate700, fontSize = 14.sp)
                        Spacer(modifier = Modifier.height(16.dp))
                        Button(onClick = { viewModel.loadData() }) {
                            Text("Retry")
                        }
                    }
                }
            }
            is InventoryUiState.Success -> {
                val filteredProducts = state.products.filter { prod ->
                    val matchesQuery = searchQuery.isBlank() ||
                            prod.name.contains(searchQuery, ignoreCase = true) ||
                            (prod.brand?.contains(searchQuery, ignoreCase = true) == true)
                    val matchesFilter = when (selectedFilter) {
                        "subscription" -> prod.isSubscription
                        "service_account" -> prod.isServiceAccount
                        "license_key" -> prod.isLicenseKey
                        else -> true
                    }
                    matchesQuery && matchesFilter
                }

                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(paddingValues)
                ) {
                    // Search Bar
                    OutlinedTextField(
                        value = searchQuery,
                        onValueChange = { searchQuery = it },
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 8.dp),
                        placeholder = { Text("Search products by name or brand...", fontSize = 14.sp) },
                        leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, tint = Slate400) },
                        trailingIcon = {
                            if (searchQuery.isNotEmpty()) {
                                IconButton(onClick = { searchQuery = "" }) {
                                    Icon(Icons.Default.Clear, contentDescription = "Clear")
                                }
                            }
                        },
                        singleLine = true,
                        shape = RoundedCornerShape(12.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedContainerColor = Color.White,
                            unfocusedContainerColor = Color.White
                        )
                    )

                    // Filter Chips
                    LazyRow(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 4.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        item {
                            FilterChip(
                                selected = selectedFilter == "all",
                                onClick = { selectedFilter = "all" },
                                label = { Text("All", color = if (selectedFilter == "all") Color.White else Slate700) },
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = PrimaryBlue,
                                    selectedLabelColor = Color.White
                                )
                            )
                        }
                        item {
                            FilterChip(
                                selected = selectedFilter == "subscription",
                                onClick = { selectedFilter = "subscription" },
                                label = { Text("Subscriptions", color = if (selectedFilter == "subscription") Color.White else Slate700) },
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = PrimaryBlue,
                                    selectedLabelColor = Color.White
                                )
                            )
                        }
                        item {
                            FilterChip(
                                selected = selectedFilter == "service_account",
                                onClick = { selectedFilter = "service_account" },
                                label = { Text("Service Accounts", color = if (selectedFilter == "service_account") Color.White else Slate700) },
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = PrimaryBlue,
                                    selectedLabelColor = Color.White
                                )
                            )
                        }
                        item {
                            FilterChip(
                                selected = selectedFilter == "license_key",
                                onClick = { selectedFilter = "license_key" },
                                label = { Text("License Keys", color = if (selectedFilter == "license_key") Color.White else Slate700) },
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = PrimaryBlue,
                                    selectedLabelColor = Color.White
                                )
                            )
                        }
                    }

                    // Products List
                    if (filteredProducts.isEmpty()) {
                        Box(
                            modifier = Modifier.fillMaxSize(),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = if (searchQuery.isBlank()) "No products in catalog." else "No products matching \"$searchQuery\"",
                                color = Slate400,
                                fontSize = 14.sp
                            )
                        }
                    } else {
                        LazyColumn(
                            modifier = Modifier.fillMaxSize(),
                            contentPadding = PaddingValues(16.dp),
                            verticalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            items(filteredProducts, key = { it.id }) { product ->
                                val plans = state.plans[product.id] ?: emptyList()
                                ProductCard(
                                    product = product,
                                    plans = plans,
                                    viewModel = viewModel,
                                    onClick = { onProductClick(product.id) }
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
private fun ProductCard(
    product: ProductDto,
    plans: List<com.vectis.erp.data.model.PlanDto>,
    viewModel: InventoryViewModel,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            // Header: Brand, Name & Status
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top
            ) {
                Row(
                    modifier = Modifier.weight(1f),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .size(42.dp)
                            .clip(RoundedCornerShape(10.dp))
                            .background(
                                when {
                                    product.isServiceAccount -> PrimaryBlue.copy(alpha = 0.12f)
                                    product.isLicenseKey -> StatusSuccess.copy(alpha = 0.12f)
                                    else -> Slate200
                                }
                            ),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = when {
                                product.isServiceAccount -> Icons.Default.Tv
                                product.isLicenseKey -> Icons.Default.VpnKey
                                else -> Icons.Default.Inventory2
                            },
                            contentDescription = null,
                            tint = when {
                                product.isServiceAccount -> PrimaryBlue
                                product.isLicenseKey -> StatusSuccess
                                else -> Slate700
                            },
                            modifier = Modifier.size(22.dp)
                        )
                    }
                    Spacer(modifier = Modifier.width(12.dp))
                    Column {
                        product.brand?.let {
                            Text(text = it.uppercase(), fontSize = 10.sp, fontWeight = FontWeight.Bold, color = Slate400, letterSpacing = 1.sp)
                        }
                        Text(text = product.name, fontSize = 16.sp, fontWeight = FontWeight.Bold, color = Slate900, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                }

                // In Stock / Out of Stock Badge
                Surface(
                    color = if (product.availableInventory > 0) StatusSuccess.copy(alpha = 0.12f) else StatusDanger.copy(alpha = 0.12f),
                    shape = RoundedCornerShape(6.dp)
                ) {
                    Text(
                        text = if (product.availableInventory > 0) "${product.availableInventory} in stock" else "Out of stock",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = if (product.availableInventory > 0) StatusSuccess else StatusDanger,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                    )
                }
            }

            // Description
            if (!product.description.isNullOrBlank()) {
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = product.description,
                    fontSize = 13.sp,
                    color = Slate500,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )
            }

            // Capability Tags
            Spacer(modifier = Modifier.height(10.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                if (product.isSubscription) {
                    CapabilityBadge("Subscription", Icons.Default.Repeat, PrimaryBlue)
                }
                if (product.isServiceAccount) {
                    CapabilityBadge("Profiles", Icons.Default.People, Color(0xFF0891B2))
                }
                if (product.isLicenseKey) {
                    CapabilityBadge("License Key", Icons.Default.Key, StatusSuccess)
                }
                if (product.isDigitalFile) {
                    CapabilityBadge("File", Icons.Default.FileDownload, Color(0xFF7C3AED))
                }
            }

            // Plans Section
            if (plans.isNotEmpty()) {
                Spacer(modifier = Modifier.height(12.dp))
                HorizontalDivider(color = Slate100)
                Spacer(modifier = Modifier.height(8.dp))

                Text(text = "Available Plans", fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = Slate400)
                Spacer(modifier = Modifier.height(6.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    plans.take(3).forEach { plan ->
                        Surface(
                            color = Slate50,
                            shape = RoundedCornerShape(8.dp),
                            border = androidx.compose.foundation.BorderStroke(1.dp, Slate200)
                        ) {
                            Column(modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)) {
                                Text(text = plan.name, fontSize = 11.sp, fontWeight = FontWeight.Medium, color = Slate700)
                                Text(
                                    text = viewModel.formatCurrency(plan.price),
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = PrimaryBlue
                                )
                            }
                        }
                    }
                    if (plans.size > 3) {
                        Surface(
                            color = Slate50,
                            shape = RoundedCornerShape(8.dp),
                            modifier = Modifier.align(Alignment.CenterVertically)
                        ) {
                            Text(
                                text = "+${plans.size - 3} more",
                                fontSize = 11.sp,
                                color = Slate500,
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun CapabilityBadge(text: String, icon: androidx.compose.ui.graphics.vector.ImageVector, color: Color) {
    Surface(
        color = color.copy(alpha = 0.08f),
        shape = RoundedCornerShape(6.dp)
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(imageVector = icon, contentDescription = null, tint = color, modifier = Modifier.size(12.dp))
            Spacer(modifier = Modifier.width(4.dp))
            Text(text = text, fontSize = 10.sp, fontWeight = FontWeight.Medium, color = color)
        }
    }
}
