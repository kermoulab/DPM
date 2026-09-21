package com.vectis.erp.feature.inventory

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.vectis.erp.core.design.*
import com.vectis.erp.data.model.*
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InventoryScreen(
    viewModel: InventoryViewModel
) {
    val uiState by viewModel.uiState.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }
    val coroutineScope = rememberCoroutineScope()

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("Inventory Bank", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = Slate900)
                        Text("Catalog, Accounts & License Pools", fontSize = 12.sp, color = Slate500)
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
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            when (val state = uiState) {
                is InventoryUiState.Loading -> {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(color = PrimaryBlue)
                    }
                }
                is InventoryUiState.Error -> {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
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
                    // Tab Row
                    TabRow(
                        selectedTabIndex = state.activeTab.ordinal,
                        containerColor = Color.White,
                        contentColor = PrimaryBlue
                    ) {
                        InventoryTab.entries.forEach { tab ->
                            Tab(
                                selected = state.activeTab == tab,
                                onClick = { viewModel.selectTab(tab) },
                                text = {
                                    Text(
                                        text = tab.title,
                                        fontSize = 13.sp,
                                        fontWeight = if (state.activeTab == tab) FontWeight.Bold else FontWeight.Normal
                                    )
                                }
                            )
                        }
                    }

                    when (state.activeTab) {
                        InventoryTab.PRODUCTS -> ProductsTabContent(state.products)
                        InventoryTab.ACCOUNTS -> ServiceAccountsTabContent(
                            accounts = state.accounts,
                            expandedAccountId = state.expandedAccountId,
                            accountProfiles = state.accountProfiles,
                            revealedCredentials = state.revealedCredentials,
                            onToggleExpand = { viewModel.toggleAccountExpansion(it) },
                            onReveal = { accountId ->
                                viewModel.revealCredential(accountId) { err ->
                                    coroutineScope.launch {
                                        snackbarHostState.showSnackbar(err)
                                    }
                                }
                            },
                            onHide = { viewModel.hideCredential(it) }
                        )
                        InventoryTab.LICENSES -> LicenseKeysTabContent(state.licenses)
                    }
                }
            }
        }
    }
}

@Composable
private fun ProductsTabContent(products: List<ProductDto>) {
    if (products.isEmpty()) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text("No products configured in catalog.", color = Slate400, fontSize = 14.sp)
        }
    } else {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            items(products, key = { it.id }) { product ->
                ProductCard(product)
            }
        }
    }
}

@Composable
private fun ProductCard(product: ProductDto) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    modifier = Modifier
                        .size(42.dp)
                        .clip(RoundedCornerShape(10.dp))
                        .background(PrimaryBlue.copy(alpha = 0.1f)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.Default.Inventory2, contentDescription = null, tint = PrimaryBlue, modifier = Modifier.size(22.dp))
                }

                Spacer(modifier = Modifier.width(12.dp))

                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = product.name,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold,
                        color = Slate900,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    Spacer(modifier = Modifier.height(2.dp))
                    Text(
                        text = product.brand ?: (product.fulfillmentType.replaceFirstChar { it.uppercase() } + " Fulfillment"),
                        fontSize = 12.sp,
                        color = Slate500
                    )
                }

                val inStock = product.inStock
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(8.dp))
                        .background(if (inStock) StatusSuccess.copy(alpha = 0.1f) else StatusDanger.copy(alpha = 0.1f))
                        .padding(horizontal = 8.dp, vertical = 4.dp)
                ) {
                    Text(
                        text = if (inStock) "In Stock (${product.availableInventory})" else "Out of Stock",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = if (inStock) StatusSuccess else StatusDanger
                    )
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Capabilities chips
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                product.capabilities.forEach { cap ->
                    val label = when (cap) {
                        "subscription" -> "Subscription"
                        "service_account" -> "Account Pool"
                        "profiles" -> "Profile Slot"
                        "license_key" -> "License Key"
                        "digital_file" -> "Digital File"
                        else -> cap.replace('_', ' ').replaceFirstChar { it.uppercase() }
                    }
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(6.dp))
                            .background(Slate100)
                            .padding(horizontal = 6.dp, vertical = 2.dp)
                    ) {
                        Text(text = label, fontSize = 10.sp, color = Slate700, fontWeight = FontWeight.Medium)
                    }
                }
            }

            Spacer(modifier = Modifier.height(10.dp))
            HorizontalDivider(color = Slate100)
            Spacer(modifier = Modifier.height(8.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "${product.planCount} Pricing Plans",
                    fontSize = 12.sp,
                    color = Slate500,
                    fontWeight = FontWeight.Medium
                )
                Text(
                    text = "ID: ${product.id}",
                    fontSize = 11.sp,
                    color = Slate400,
                    fontFamily = FontFamily.Monospace
                )
            }
        }
    }
}

@Composable
private fun ServiceAccountsTabContent(
    accounts: List<ServiceAccountDto>,
    expandedAccountId: String?,
    accountProfiles: Map<String, List<ServiceProfileDto>>,
    revealedCredentials: Map<String, RevealCredentialResponse>,
    onToggleExpand: (String) -> Unit,
    onReveal: (String) -> Unit,
    onHide: (String) -> Unit
) {
    if (accounts.isEmpty()) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text("No service accounts registered.", color = Slate400, fontSize = 14.sp)
        }
    } else {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            items(accounts, key = { it.id }) { account ->
                ServiceAccountCard(
                    account = account,
                    isExpanded = expandedAccountId == account.id,
                    profiles = accountProfiles[account.id] ?: emptyList(),
                    revealed = revealedCredentials[account.id],
                    onToggleExpand = { onToggleExpand(account.id) },
                    onReveal = { onReveal(account.id) },
                    onHide = { onHide(account.id) }
                )
            }
        }
    }
}

@Composable
private fun ServiceAccountCard(
    account: ServiceAccountDto,
    isExpanded: Boolean,
    profiles: List<ServiceProfileDto>,
    revealed: RevealCredentialResponse?,
    onToggleExpand: () -> Unit,
    onReveal: () -> Unit,
    onHide: () -> Unit
) {
    val clipboardManager = LocalClipboardManager.current

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            // Header
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(36.dp)
                            .clip(CircleShape)
                            .background(PrimaryBlue.copy(alpha = 0.1f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(Icons.Default.VpnKey, contentDescription = null, tint = PrimaryBlue, modifier = Modifier.size(18.dp))
                    }
                    Spacer(modifier = Modifier.width(10.dp))
                    Column {
                        Text(
                            text = account.provider,
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Bold,
                            color = Slate900
                        )
                        Text(
                            text = "Capacity: ${account.capacity} slots",
                            fontSize = 11.sp,
                            color = Slate500
                        )
                    }
                }

                val isActive = account.status == "active"
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(8.dp))
                        .background(if (isActive) StatusSuccess.copy(alpha = 0.1f) else Slate200)
                        .padding(horizontal = 8.dp, vertical = 4.dp)
                ) {
                    Text(
                        text = if (isActive) "Active" else "Suspended",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = if (isActive) StatusSuccess else Slate600
                    )
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Login / Credential Block
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(10.dp))
                    .background(Slate50)
                    .padding(12.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Login:", fontSize = 12.sp, color = Slate500)
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = account.login,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = Slate800,
                            fontFamily = FontFamily.Monospace
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        IconButton(
                            onClick = { clipboardManager.setText(AnnotatedString(account.login)) },
                            modifier = Modifier.size(24.dp)
                        ) {
                            Icon(Icons.Default.ContentCopy, contentDescription = "Copy", tint = Slate400, modifier = Modifier.size(14.dp))
                        }
                    }
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Password:", fontSize = 12.sp, color = Slate500)
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = revealed?.password ?: account.maskedCredential ?: "••••••••",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = if (revealed != null) PrimaryBlue else Slate700,
                            fontFamily = FontFamily.Monospace
                        )
                        Spacer(modifier = Modifier.width(6.dp))

                        if (revealed != null) {
                            IconButton(
                                onClick = { clipboardManager.setText(AnnotatedString(revealed.password)) },
                                modifier = Modifier.size(24.dp)
                            ) {
                                Icon(Icons.Default.ContentCopy, contentDescription = "Copy password", tint = PrimaryBlue, modifier = Modifier.size(14.dp))
                            }
                            IconButton(onClick = onHide, modifier = Modifier.size(24.dp)) {
                                Icon(Icons.Default.VisibilityOff, contentDescription = "Hide password", tint = Slate500, modifier = Modifier.size(16.dp))
                            }
                        } else {
                            IconButton(onClick = onReveal, modifier = Modifier.size(24.dp)) {
                                Icon(Icons.Default.Visibility, contentDescription = "Reveal password", tint = PrimaryBlue, modifier = Modifier.size(16.dp))
                            }
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            // Expand Profiles Trigger
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { onToggleExpand() }
                    .padding(vertical = 4.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Profile Slots (${account.activeProfilesCount}/${account.capacity} in use)",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PrimaryBlue
                )
                Icon(
                    imageVector = if (isExpanded) Icons.Default.KeyboardArrowDown else Icons.AutoMirrored.Filled.KeyboardArrowRight,
                    contentDescription = null,
                    tint = PrimaryBlue,
                    modifier = Modifier.size(20.dp)
                )
            }

            AnimatedVisibility(visible = isExpanded) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    if (profiles.isEmpty()) {
                        Text(
                            text = "Loading profile slots...",
                            fontSize = 12.sp,
                            color = Slate400,
                            modifier = Modifier.padding(vertical = 6.dp)
                        )
                    } else {
                        profiles.forEach { profile ->
                            ProfileSlotRow(profile)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ProfileSlotRow(profile: ServiceProfileDto) {
    val isAssigned = profile.status == "assigned"
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .background(Slate100)
            .padding(horizontal = 10.dp, vertical = 6.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column {
            Text(
                text = profile.profileName,
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                color = Slate900
            )
            if (!profile.pin.isNullOrBlank()) {
                Text(
                    text = "PIN: ${profile.pin}",
                    fontSize = 11.sp,
                    color = Slate600,
                    fontFamily = FontFamily.Monospace
                )
            }
            if (isAssigned && !profile.assignedCustomerName.isNullOrBlank()) {
                Text(
                    text = "Customer: ${profile.assignedCustomerName}",
                    fontSize = 10.sp,
                    color = PrimaryBlue
                )
            }
        }

        Box(
            modifier = Modifier
                .clip(RoundedCornerShape(6.dp))
                .background(if (isAssigned) PrimaryBlue.copy(alpha = 0.1f) else StatusSuccess.copy(alpha = 0.1f))
                .padding(horizontal = 6.dp, vertical = 2.dp)
        ) {
            Text(
                text = if (isAssigned) "Assigned" else "Available",
                fontSize = 10.sp,
                fontWeight = FontWeight.SemiBold,
                color = if (isAssigned) PrimaryBlue else StatusSuccess
            )
        }
    }
}

@Composable
private fun LicenseKeysTabContent(licenses: List<LicenseKeyDto>) {
    if (licenses.isEmpty()) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text("No digital license keys registered.", color = Slate400, fontSize = 14.sp)
        }
    } else {
        val clipboardManager = LocalClipboardManager.current

        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            items(licenses, key = { it.id }) { license ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(14.dp),
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
                                text = license.productName ?: "License Key",
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Bold,
                                color = Slate900
                            )

                            val isAvail = license.status == "available"
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(6.dp))
                                    .background(if (isAvail) StatusSuccess.copy(alpha = 0.1f) else Slate200)
                                    .padding(horizontal = 8.dp, vertical = 3.dp)
                            ) {
                                Text(
                                    text = license.status.replaceFirstChar { it.uppercase() },
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    color = if (isAvail) StatusSuccess else Slate700
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(8.dp))

                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(8.dp))
                                .background(Slate50)
                                .padding(horizontal = 10.dp, vertical = 6.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = license.licenseKey,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.SemiBold,
                                fontFamily = FontFamily.Monospace,
                                color = Slate800
                            )
                            IconButton(
                                onClick = { clipboardManager.setText(AnnotatedString(license.licenseKey)) },
                                modifier = Modifier.size(24.dp)
                            ) {
                                Icon(Icons.Default.ContentCopy, contentDescription = "Copy key", tint = Slate400, modifier = Modifier.size(14.dp))
                            }
                        }

                        if (!license.assignedCustomerName.isNullOrBlank()) {
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = "Assigned to: ${license.assignedCustomerName}",
                                fontSize = 11.sp,
                                color = PrimaryBlue,
                                fontWeight = FontWeight.Medium
                            )
                        }
                    }
                }
            }
        }
    }
}
