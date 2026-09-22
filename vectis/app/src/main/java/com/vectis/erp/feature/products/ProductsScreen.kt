package com.vectis.erp.feature.products

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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.vectis.erp.core.design.*
import com.vectis.erp.data.model.*
import com.vectis.erp.feature.inventory.InventoryUiState
import com.vectis.erp.feature.inventory.InventoryViewModel
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProductsScreen(
    viewModel: InventoryViewModel,
    onProductClick: (String) -> Unit = {}
) {
    val uiState by viewModel.uiState.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }
    val coroutineScope = rememberCoroutineScope()

    var searchQuery by remember { mutableStateOf("") }
    var selectedCapabilityFilter by remember { mutableStateOf("all") }
    var selectedCategoryId by remember { mutableStateOf("all") }

    // Dialog States
    var showCreateProductDialog by remember { mutableStateOf(false) }
    var editingProduct by remember { mutableStateOf<ProductDto?>(null) }
    var productForNewPlan by remember { mutableStateOf<ProductDto?>(null) }
    var showCategoryManagerDialog by remember { mutableStateOf(false) }
    var deletingProduct by remember { mutableStateOf<ProductDto?>(null) }
    var deletingPlan by remember { mutableStateOf<PlanDto?>(null) }

    val canManage = viewModel.permissionManager.canManageProducts()

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("Products & Plans", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = Slate900)
                        Text("Catalog & Subscription Tiers", fontSize = 12.sp, color = Slate500)
                    }
                },
                actions = {
                    if (canManage) {
                        IconButton(onClick = { showCategoryManagerDialog = true }) {
                            Icon(Icons.Default.Folder, contentDescription = "Manage Categories", tint = PrimaryBlue)
                        }
                    }
                    IconButton(onClick = { viewModel.loadData(isRefresh = true) }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Refresh", tint = PrimaryBlue)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Color.White)
            )
        },
        floatingActionButton = {
            if (canManage) {
                ExtendedFloatingActionButton(
                    onClick = { showCreateProductDialog = true },
                    containerColor = PrimaryBlue,
                    contentColor = Color.White,
                    icon = { Icon(Icons.Default.Add, contentDescription = null) },
                    text = { Text("Add Product", fontWeight = FontWeight.SemiBold) }
                )
            }
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

                    val matchesCategory = selectedCategoryId == "all" || prod.categoryId == selectedCategoryId

                    val matchesCapability = when (selectedCapabilityFilter) {
                        "subscription" -> prod.isSubscription
                        "service_account" -> prod.isServiceAccount
                        "license_key" -> prod.isLicenseKey
                        "digital_file" -> prod.isDigitalFile
                        else -> true
                    }
                    matchesQuery && matchesCategory && matchesCapability
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

                    // Category Filter Row
                    if (state.categories.isNotEmpty()) {
                        LazyRow(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 16.dp, vertical = 2.dp),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            item {
                                FilterChip(
                                    selected = selectedCategoryId == "all",
                                    onClick = { selectedCategoryId = "all" },
                                    label = { Text("All Categories", color = if (selectedCategoryId == "all") Color.White else Slate700) },
                                    colors = FilterChipDefaults.filterChipColors(
                                        selectedContainerColor = Slate800,
                                        selectedLabelColor = Color.White
                                    )
                                )
                            }
                            items(state.categories, key = { it.id }) { cat ->
                                FilterChip(
                                    selected = selectedCategoryId == cat.id,
                                    onClick = { selectedCategoryId = cat.id },
                                    label = { Text(cat.name, color = if (selectedCategoryId == cat.id) Color.White else Slate700) },
                                    colors = FilterChipDefaults.filterChipColors(
                                        selectedContainerColor = Slate800,
                                        selectedLabelColor = Color.White
                                    )
                                )
                            }
                        }
                    }

                    // Capability Filter Chips
                    LazyRow(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 4.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        item {
                            FilterChip(
                                selected = selectedCapabilityFilter == "all",
                                onClick = { selectedCapabilityFilter = "all" },
                                label = { Text("All Types", color = if (selectedCapabilityFilter == "all") Color.White else Slate700) },
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = PrimaryBlue,
                                    selectedLabelColor = Color.White
                                )
                            )
                        }
                        item {
                            FilterChip(
                                selected = selectedCapabilityFilter == "subscription",
                                onClick = { selectedCapabilityFilter = "subscription" },
                                label = { Text("Subscriptions", color = if (selectedCapabilityFilter == "subscription") Color.White else Slate700) },
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = PrimaryBlue,
                                    selectedLabelColor = Color.White
                                )
                            )
                        }
                        item {
                            FilterChip(
                                selected = selectedCapabilityFilter == "service_account",
                                onClick = { selectedCapabilityFilter = "service_account" },
                                label = { Text("Service Accounts", color = if (selectedCapabilityFilter == "service_account") Color.White else Slate700) },
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = PrimaryBlue,
                                    selectedLabelColor = Color.White
                                )
                            )
                        }
                        item {
                            FilterChip(
                                selected = selectedCapabilityFilter == "license_key",
                                onClick = { selectedCapabilityFilter = "license_key" },
                                label = { Text("License Keys", color = if (selectedCapabilityFilter == "license_key") Color.White else Slate700) },
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
                                text = if (searchQuery.isBlank()) "No products found in this category." else "No products matching \"$searchQuery\"",
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
                                val categoryName = state.categories.find { it.id == product.categoryId }?.name
                                ProductCard(
                                    product = product,
                                    categoryName = categoryName,
                                    plans = plans,
                                    canManage = canManage,
                                    viewModel = viewModel,
                                    onClick = { onProductClick(product.id) },
                                    onEdit = { editingProduct = product },
                                    onAddPlan = { productForNewPlan = product },
                                    onDeleteProduct = { deletingProduct = product },
                                    onDeletePlan = { deletingPlan = it }
                                )
                            }
                        }
                    }
                }

                // Create Product Dialog
                if (showCreateProductDialog) {
                    ProductFormDialog(
                        initialProduct = null,
                        categories = state.categories,
                        onDismiss = { showCreateProductDialog = false },
                        onSaveProduct = { req ->
                            viewModel.createProduct(
                                req = req,
                                onSuccess = {
                                    showCreateProductDialog = false
                                    coroutineScope.launch { snackbarHostState.showSnackbar("Product created successfully") }
                                },
                                onError = { err ->
                                    coroutineScope.launch { snackbarHostState.showSnackbar(err) }
                                }
                            )
                        },
                        onUpdateProduct = { _, _ -> }
                    )
                }

                // Edit Product Dialog
                editingProduct?.let { prod ->
                    ProductFormDialog(
                        initialProduct = prod,
                        categories = state.categories,
                        onDismiss = { editingProduct = null },
                        onSaveProduct = { _ -> },
                        onUpdateProduct = { id, req ->
                            viewModel.updateProduct(
                                id = id,
                                req = req,
                                onSuccess = {
                                    editingProduct = null
                                    coroutineScope.launch { snackbarHostState.showSnackbar("Product updated successfully") }
                                },
                                onError = { err ->
                                    coroutineScope.launch { snackbarHostState.showSnackbar(err) }
                                }
                            )
                        }
                    )
                }

                // Add Plan Dialog
                productForNewPlan?.let { prod ->
                    PlanFormDialog(
                        product = prod,
                        onDismiss = { productForNewPlan = null },
                        onSavePlan = { req ->
                            viewModel.createPlan(
                                req = req,
                                onSuccess = {
                                    productForNewPlan = null
                                    coroutineScope.launch { snackbarHostState.showSnackbar("Plan added successfully") }
                                },
                                onError = { err ->
                                    coroutineScope.launch { snackbarHostState.showSnackbar(err) }
                                }
                            )
                        }
                    )
                }

                // Category Manager Dialog
                if (showCategoryManagerDialog) {
                    CategoryManagerDialog(
                        categories = state.categories,
                        onDismiss = { showCategoryManagerDialog = false },
                        onCreateCategory = { req ->
                            viewModel.createCategory(
                                req = req,
                                onSuccess = {
                                    coroutineScope.launch { snackbarHostState.showSnackbar("Category created successfully") }
                                },
                                onError = { err ->
                                    coroutineScope.launch { snackbarHostState.showSnackbar(err) }
                                }
                            )
                        }
                    )
                }

                // Delete Product Confirmation
                deletingProduct?.let { prod ->
                    ConfirmDeleteDialog(
                        title = "Delete Product",
                        message = "Are you sure you want to delete \"${prod.name}\"? All associated plans will be removed.",
                        onDismiss = { deletingProduct = null },
                        onConfirm = {
                            viewModel.deleteProduct(
                                id = prod.id,
                                onSuccess = {
                                    deletingProduct = null
                                    coroutineScope.launch { snackbarHostState.showSnackbar("Product deleted") }
                                },
                                onError = { err ->
                                    coroutineScope.launch { snackbarHostState.showSnackbar(err) }
                                }
                            )
                        }
                    )
                }

                // Delete Plan Confirmation
                deletingPlan?.let { pl ->
                    ConfirmDeleteDialog(
                        title = "Delete Plan",
                        message = "Are you sure you want to delete plan \"${pl.name}\"?",
                        onDismiss = { deletingPlan = null },
                        onConfirm = {
                            viewModel.deletePlan(
                                id = pl.id,
                                onSuccess = {
                                    deletingPlan = null
                                    coroutineScope.launch { snackbarHostState.showSnackbar("Plan deleted") }
                                },
                                onError = { err ->
                                    coroutineScope.launch { snackbarHostState.showSnackbar(err) }
                                }
                            )
                        }
                    )
                }
            }
        }
    }
}

@Composable
private fun ProductCard(
    product: ProductDto,
    categoryName: String?,
    plans: List<PlanDto>,
    canManage: Boolean,
    viewModel: InventoryViewModel,
    onClick: () -> Unit,
    onEdit: () -> Unit,
    onAddPlan: () -> Unit,
    onDeleteProduct: () -> Unit,
    onDeletePlan: (PlanDto) -> Unit
) {
    var menuExpanded by remember { mutableStateOf(false) }

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            // Header: Icon, Brand, Name, Category & Actions
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
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            product.brand?.let {
                                Text(text = it.uppercase(), fontSize = 10.sp, fontWeight = FontWeight.Bold, color = Slate400, letterSpacing = 1.sp)
                                Spacer(modifier = Modifier.width(6.dp))
                            }
                            categoryName?.let {
                                Surface(
                                    color = Slate100,
                                    shape = RoundedCornerShape(4.dp)
                                ) {
                                    Text(
                                        text = it,
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.Medium,
                                        color = Slate600,
                                        modifier = Modifier.padding(horizontal = 4.dp, vertical = 1.dp)
                                    )
                                }
                            }
                        }
                        Text(text = product.name, fontSize = 16.sp, fontWeight = FontWeight.Bold, color = Slate900, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                }

                // In Stock Badge & Action Menu
                Row(verticalAlignment = Alignment.CenterVertically) {
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

                    if (canManage) {
                        Box {
                            IconButton(onClick = { menuExpanded = true }) {
                                Icon(Icons.Default.MoreVert, contentDescription = "Options", tint = Slate500)
                            }
                            DropdownMenu(
                                expanded = menuExpanded,
                                onDismissRequest = { menuExpanded = false }
                            ) {
                                DropdownMenuItem(
                                    text = { Text("Add Plan") },
                                    leadingIcon = { Icon(Icons.Default.Add, contentDescription = null) },
                                    onClick = {
                                        menuExpanded = false
                                        onAddPlan()
                                    }
                                )
                                DropdownMenuItem(
                                    text = { Text("Edit Product") },
                                    leadingIcon = { Icon(Icons.Default.Edit, contentDescription = null) },
                                    onClick = {
                                        menuExpanded = false
                                        onEdit()
                                    }
                                )
                                HorizontalDivider()
                                DropdownMenuItem(
                                    text = { Text("Delete Product", color = StatusDanger) },
                                    leadingIcon = { Icon(Icons.Default.Delete, contentDescription = null, tint = StatusDanger) },
                                    onClick = {
                                        menuExpanded = false
                                        onDeleteProduct()
                                    }
                                )
                            }
                        }
                    }
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
            Spacer(modifier = Modifier.height(12.dp))
            HorizontalDivider(color = Slate100)
            Spacer(modifier = Modifier.height(8.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(text = "Available Plans (${plans.size})", fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = Slate400)
                if (canManage && plans.isEmpty()) {
                    TextButton(onClick = onAddPlan, contentPadding = PaddingValues(0.dp)) {
                        Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(14.dp), tint = PrimaryBlue)
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Add First Plan", fontSize = 11.sp, color = PrimaryBlue)
                    }
                }
            }
            Spacer(modifier = Modifier.height(6.dp))

            if (plans.isNotEmpty()) {
                LazyRow(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(plans, key = { it.id }) { plan ->
                        Surface(
                            color = Slate50,
                            shape = RoundedCornerShape(8.dp),
                            border = androidx.compose.foundation.BorderStroke(1.dp, Slate200)
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column {
                                    Text(text = plan.name, fontSize = 11.sp, fontWeight = FontWeight.Medium, color = Slate700)
                                    Text(
                                        text = viewModel.formatCurrency(plan.price),
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = PrimaryBlue
                                    )
                                }
                                if (canManage) {
                                    Spacer(modifier = Modifier.width(6.dp))
                                    IconButton(
                                        onClick = { onDeletePlan(plan) },
                                        modifier = Modifier.size(20.dp)
                                    ) {
                                        Icon(Icons.Default.Close, contentDescription = "Delete Plan", tint = Slate400, modifier = Modifier.size(14.dp))
                                    }
                                }
                            }
                        }
                    }
                }
            } else {
                Text("No plans configured yet.", fontSize = 12.sp, color = Slate400)
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
