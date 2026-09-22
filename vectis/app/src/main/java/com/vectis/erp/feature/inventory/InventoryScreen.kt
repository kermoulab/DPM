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
import com.vectis.erp.feature.products.ConfirmDeleteDialog
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InventoryScreen(
    viewModel: InventoryViewModel
) {
    val uiState by viewModel.uiState.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }
    val coroutineScope = rememberCoroutineScope()

    val canManage = viewModel.permissionManager.canManageInventory()

    // Dialog states
    var showAddAccountDialog by remember { mutableStateOf(false) }
    var editingAccount by remember { mutableStateOf<ServiceAccountDto?>(null) }
    var deletingAccount by remember { mutableStateOf<ServiceAccountDto?>(null) }

    var editingProfileData by remember { mutableStateOf<Pair<String, ServiceProfileDto>?>(null) } // accountId to profile

    var showAddLicensesDialog by remember { mutableStateOf(false) }
    var deletingLicense by remember { mutableStateOf<LicenseKeyDto?>(null) }

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
        floatingActionButton = {
            val state = uiState
            if (canManage && state is InventoryUiState.Success) {
                when (state.activeTab) {
                    InventoryTab.ACCOUNTS -> {
                        ExtendedFloatingActionButton(
                            onClick = { showAddAccountDialog = true },
                            containerColor = PrimaryBlue,
                            contentColor = Color.White,
                            icon = { Icon(Icons.Default.Add, contentDescription = null) },
                            text = { Text("Add Account", fontWeight = FontWeight.SemiBold) }
                        )
                    }
                    InventoryTab.LICENSES -> {
                        ExtendedFloatingActionButton(
                            onClick = { showAddLicensesDialog = true },
                            containerColor = StatusSuccess,
                            contentColor = Color.White,
                            icon = { Icon(Icons.Default.Add, contentDescription = null) },
                            text = { Text("Import Keys", fontWeight = FontWeight.SemiBold) }
                        )
                    }
                    else -> {}
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
                            canManage = canManage,
                            onToggleExpand = { viewModel.toggleAccountExpansion(it) },
                            onReveal = { accountId ->
                                viewModel.revealCredential(accountId) { err ->
                                    coroutineScope.launch {
                                        snackbarHostState.showSnackbar(err)
                                    }
                                }
                            },
                            onHide = { viewModel.hideCredential(it) },
                            onEditAccount = { editingAccount = it },
                            onDeleteAccount = { deletingAccount = it },
                            onEditProfile = { accId, prof -> editingProfileData = Pair(accId, prof) }
                        )
                        InventoryTab.LICENSES -> LicenseKeysTabContent(
                            licenses = state.licenses,
                            canManage = canManage,
                            onDeleteLicense = { deletingLicense = it }
                        )
                    }

                    // Add Service Account Dialog
                    if (showAddAccountDialog) {
                        ServiceAccountFormDialog(
                            initialAccount = null,
                            products = state.products,
                            onDismiss = { showAddAccountDialog = false },
                            onSaveAccount = { req ->
                                viewModel.createServiceAccount(
                                    req = req,
                                    onSuccess = {
                                        showAddAccountDialog = false
                                        coroutineScope.launch { snackbarHostState.showSnackbar("Service account created") }
                                    },
                                    onError = { err -> coroutineScope.launch { snackbarHostState.showSnackbar(err) } }
                                )
                            },
                            onUpdateAccount = { _, _ -> }
                        )
                    }

                    // Edit Service Account Dialog
                    editingAccount?.let { acc ->
                        ServiceAccountFormDialog(
                            initialAccount = acc,
                            products = state.products,
                            onDismiss = { editingAccount = null },
                            onSaveAccount = { _ -> },
                            onUpdateAccount = { id, req ->
                                viewModel.updateServiceAccount(
                                    id = id,
                                    req = req,
                                    onSuccess = {
                                        editingAccount = null
                                        coroutineScope.launch { snackbarHostState.showSnackbar("Account updated") }
                                    },
                                    onError = { err -> coroutineScope.launch { snackbarHostState.showSnackbar(err) } }
                                )
                            }
                        )
                    }

                    // Delete Service Account Confirmation Dialog
                    deletingAccount?.let { acc ->
                        ConfirmDeleteDialog(
                            title = "Delete Service Account",
                            message = "Are you sure you want to delete ${acc.provider} (${acc.login})? Active assigned profiles must be released first.",
                            onDismiss = { deletingAccount = null },
                            onConfirm = {
                                viewModel.deleteServiceAccount(
                                    id = acc.id,
                                    onSuccess = {
                                        deletingAccount = null
                                        coroutineScope.launch { snackbarHostState.showSnackbar("Account deleted") }
                                    },
                                    onError = { err -> coroutineScope.launch { snackbarHostState.showSnackbar(err) } }
                                )
                            }
                        )
                    }

                    // Edit Profile Dialog
                    editingProfileData?.let { (accId, prof) ->
                        ProfileEditDialog(
                            profile = prof,
                            onDismiss = { editingProfileData = null },
                            onSave = { req ->
                                viewModel.updateServiceProfile(
                                    id = prof.id,
                                    accountId = accId,
                                    req = req,
                                    onSuccess = {
                                        editingProfileData = null
                                        coroutineScope.launch { snackbarHostState.showSnackbar("Profile updated") }
                                    },
                                    onError = { err -> coroutineScope.launch { snackbarHostState.showSnackbar(err) } }
                                )
                            }
                        )
                    }

                    // Bulk Add Licenses Dialog
                    if (showAddLicensesDialog) {
                        BulkLicenseDialog(
                            products = state.products,
                            onDismiss = { showAddLicensesDialog = false },
                            onSaveLicenses = { req ->
                                viewModel.addLicenseKeys(
                                    req = req,
                                    onSuccess = { res ->
                                        showAddLicensesDialog = false
                                        coroutineScope.launch {
                                            snackbarHostState.showSnackbar("Imported ${res.added} keys (${res.duplicate} duplicates skipped)")
                                        }
                                    },
                                    onError = { err -> coroutineScope.launch { snackbarHostState.showSnackbar(err) } }
                                )
                            }
                        )
                    }

                    // Delete License Confirmation Dialog
                    deletingLicense?.let { lic ->
                        ConfirmDeleteDialog(
                            title = "Delete License Key",
                            message = "Are you sure you want to delete license key \"${lic.licenseKey}\"?",
                            onDismiss = { deletingLicense = null },
                            onConfirm = {
                                viewModel.deleteLicenseKey(
                                    id = lic.id,
                                    onSuccess = {
                                        deletingLicense = null
                                        coroutineScope.launch { snackbarHostState.showSnackbar("License key deleted") }
                                    },
                                    onError = { err -> coroutineScope.launch { snackbarHostState.showSnackbar(err) } }
                                )
                            }
                        )
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
    canManage: Boolean,
    onToggleExpand: (String) -> Unit,
    onReveal: (String) -> Unit,
    onHide: (String) -> Unit,
    onEditAccount: (ServiceAccountDto) -> Unit,
    onDeleteAccount: (ServiceAccountDto) -> Unit,
    onEditProfile: (String, ServiceProfileDto) -> Unit
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
                    canManage = canManage,
                    onToggleExpand = { onToggleExpand(account.id) },
                    onReveal = { onReveal(account.id) },
                    onHide = { onHide(account.id) },
                    onEditAccount = { onEditAccount(account) },
                    onDeleteAccount = { onDeleteAccount(account) },
                    onEditProfile = { prof -> onEditProfile(account.id, prof) }
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
    canManage: Boolean,
    onToggleExpand: () -> Unit,
    onReveal: () -> Unit,
    onHide: () -> Unit,
    onEditAccount: () -> Unit,
    onDeleteAccount: () -> Unit,
    onEditProfile: (ServiceProfileDto) -> Unit
) {
    val clipboardManager = LocalClipboardManager.current
    var menuExpanded by remember { mutableStateOf(false) }

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

                Row(verticalAlignment = Alignment.CenterVertically) {
                    val isActive = account.status == "active"
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(8.dp))
                            .background(if (isActive) StatusSuccess.copy(alpha = 0.1f) else Slate200)
                            .padding(horizontal = 8.dp, vertical = 4.dp)
                    ) {
                        Text(
                            text = if (isActive) "Active" else account.status.replaceFirstChar { it.uppercase() },
                            fontSize = 11.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = if (isActive) StatusSuccess else Slate600
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
                                    text = { Text("Edit Account") },
                                    leadingIcon = { Icon(Icons.Default.Edit, contentDescription = null) },
                                    onClick = {
                                        menuExpanded = false
                                        onEditAccount()
                                    }
                                )
                                HorizontalDivider()
                                DropdownMenuItem(
                                    text = { Text("Delete Account", color = StatusDanger) },
                                    leadingIcon = { Icon(Icons.Default.Delete, contentDescription = null, tint = StatusDanger) },
                                    onClick = {
                                        menuExpanded = false
                                        onDeleteAccount()
                                    }
                                )
                            }
                        }
                    }
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
                            ProfileSlotRow(
                                profile = profile,
                                canManage = canManage,
                                onEditProfile = { onEditProfile(profile) }
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ProfileSlotRow(
    profile: ServiceProfileDto,
    canManage: Boolean,
    onEditProfile: () -> Unit
) {
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
        Column(modifier = Modifier.weight(1f)) {
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

        Row(verticalAlignment = Alignment.CenterVertically) {
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

            if (canManage) {
                Spacer(modifier = Modifier.width(6.dp))
                IconButton(
                    onClick = onEditProfile,
                    modifier = Modifier.size(24.dp)
                ) {
                    Icon(Icons.Default.Edit, contentDescription = "Edit Profile", tint = Slate500, modifier = Modifier.size(14.dp))
                }
            }
        }
    }
}

@Composable
private fun LicenseKeysTabContent(
    licenses: List<LicenseKeyDto>,
    canManage: Boolean,
    onDeleteLicense: (LicenseKeyDto) -> Unit
) {
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

                            Row(verticalAlignment = Alignment.CenterVertically) {
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

                                if (canManage) {
                                    Spacer(modifier = Modifier.width(4.dp))
                                    IconButton(
                                        onClick = { onDeleteLicense(license) },
                                        modifier = Modifier.size(24.dp)
                                    ) {
                                        Icon(Icons.Default.Delete, contentDescription = "Delete License", tint = StatusDanger, modifier = Modifier.size(16.dp))
                                    }
                                }
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
