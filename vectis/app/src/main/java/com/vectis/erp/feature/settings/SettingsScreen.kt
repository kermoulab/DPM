package com.vectis.erp.feature.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ExitToApp
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.vectis.erp.core.authorization.UserRole
import com.vectis.erp.core.design.*
import com.vectis.erp.data.model.AuditLogDto
import com.vectis.erp.data.model.UserDto
import com.vectis.erp.feature.products.ConfirmDeleteDialog
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    viewModel: SettingsViewModel,
    onNavigateToLogin: () -> Unit,
    onNavigateToPairing: () -> Unit,
    onNavigateBack: (() -> Unit)? = null
) {
    val uiState by viewModel.uiState.collectAsState()
    val coroutineScope = rememberCoroutineScope()
    val snackbarHostState = remember { SnackbarHostState() }

    var showLogoutDialog by remember { mutableStateOf(false) }
    var showUnpairDialog by remember { mutableStateOf(false) }
    var showEditUrlDialog by remember { mutableStateOf(false) }
    var showChangePasswordDialog by remember { mutableStateOf(false) }
    var showAddUserDialog by remember { mutableStateOf(false) }
    var userToDelete by remember { mutableStateOf<UserDto?>(null) }
    var tempUrl by remember { mutableStateOf("") }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Settings & Preferences", fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    if (onNavigateBack != null) {
                        IconButton(onClick = onNavigateBack) {
                            Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = Slate700)
                        }
                    }
                },
                actions = {
                    IconButton(onClick = { viewModel.loadSettings(isRefresh = true) }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Refresh")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Slate50)
            )
        },
        snackbarHost = { SnackbarHost(snackbarHostState) },
        containerColor = Slate50
    ) { paddingValues ->
        when (val state = uiState) {
            is SettingsUiState.Loading -> {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(paddingValues),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(color = PrimaryBlue)
                }
            }
            is SettingsUiState.Error -> {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(paddingValues),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(text = state.message, color = StatusDanger)
                        Spacer(modifier = Modifier.height(12.dp))
                        Button(onClick = { viewModel.loadSettings() }) {
                            Text("Retry")
                        }
                    }
                }
            }
            is SettingsUiState.Success -> {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(paddingValues)
                ) {
                    // Navigation Tab Row
                    TabRow(
                        selectedTabIndex = state.activeTab.ordinal,
                        containerColor = Color.White,
                        contentColor = PrimaryBlue,
                        divider = { HorizontalDivider(color = Slate200) }
                    ) {
                        SettingsTab.values().forEach { tab ->
                            Tab(
                                selected = state.activeTab == tab,
                                onClick = { viewModel.selectTab(tab) },
                                text = {
                                    Text(
                                        text = when (tab) {
                                            SettingsTab.GENERAL -> "General"
                                            SettingsTab.SECURITY -> "Security"
                                            SettingsTab.TEAM -> "Team"
                                            SettingsTab.AUDIT -> "Audit"
                                        },
                                        fontWeight = if (state.activeTab == tab) FontWeight.Bold else FontWeight.Normal,
                                        fontSize = 12.sp
                                    )
                                },
                                icon = {
                                    Icon(
                                        imageVector = when (tab) {
                                            SettingsTab.GENERAL -> Icons.Default.Tune
                                            SettingsTab.SECURITY -> Icons.Default.Lock
                                            SettingsTab.TEAM -> Icons.Default.Group
                                            SettingsTab.AUDIT -> Icons.Default.History
                                        },
                                        contentDescription = tab.title,
                                        modifier = Modifier.size(18.dp)
                                    )
                                }
                            )
                        }
                    }

                    // Tab Content Body
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(horizontal = 16.dp)
                            .verticalScroll(rememberScrollState()),
                        verticalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        Spacer(modifier = Modifier.height(4.dp))

                        when (state.activeTab) {
                            SettingsTab.GENERAL -> {
                                GeneralSettingsTab(
                                    state = state,
                                    viewModel = viewModel,
                                    onEditUrl = {
                                        tempUrl = state.serverUrl
                                        showEditUrlDialog = true
                                    }
                                )
                            }
                            SettingsTab.SECURITY -> {
                                SecuritySettingsTab(
                                    onChangePassword = { showChangePasswordDialog = true },
                                    onLogout = { showLogoutDialog = true },
                                    onUnpair = { showUnpairDialog = true }
                                )
                            }
                            SettingsTab.TEAM -> {
                                TeamSettingsTab(
                                    state = state,
                                    viewModel = viewModel,
                                    onAddUser = { showAddUserDialog = true },
                                    onDeleteUser = { userToDelete = it }
                                )
                            }
                            SettingsTab.AUDIT -> {
                                AuditSettingsTab(
                                    state = state,
                                    viewModel = viewModel
                                )
                            }
                        }

                        // App Info footer
                        Text(
                            text = "Vectis ERP Mobile Companion v1.0.0\nAuthoritative backend: ${state.companyName}",
                            fontSize = 12.sp,
                            color = Slate400,
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 16.dp),
                            textAlign = TextAlign.Center
                        )
                    }
                }
            }
        }
    }

    // Change Password Dialog
    if (showChangePasswordDialog) {
        ChangePasswordDialog(
            onDismiss = { showChangePasswordDialog = false },
            onSubmit = { currentPw, newPw ->
                viewModel.changePassword(
                    current = currentPw,
                    newPw = newPw,
                    onSuccess = {
                        showChangePasswordDialog = false
                        coroutineScope.launch {
                            snackbarHostState.showSnackbar("Password updated successfully")
                        }
                    },
                    onError = { msg ->
                        coroutineScope.launch {
                            snackbarHostState.showSnackbar("Failed: $msg")
                        }
                    }
                )
            }
        )
    }

    // Add Team Member Dialog
    if (showAddUserDialog) {
        AddUserDialog(
            onDismiss = { showAddUserDialog = false },
            onSubmit = { req ->
                viewModel.createUser(
                    req = req,
                    onSuccess = {
                        showAddUserDialog = false
                        coroutineScope.launch {
                            snackbarHostState.showSnackbar("Team member created successfully")
                        }
                    },
                    onError = { msg ->
                        coroutineScope.launch {
                            snackbarHostState.showSnackbar("Failed: $msg")
                        }
                    }
                )
            }
        )
    }

    // Delete Team Member Confirmation Dialog
    userToDelete?.let { user ->
        ConfirmDeleteDialog(
            title = "Delete Team Member",
            message = "Are you sure you want to remove team member ${user.name} (@${user.username})? This action cannot be undone.",
            onDismiss = { userToDelete = null },
            onConfirm = {
                viewModel.deleteUser(
                    id = user.id,
                    onSuccess = {
                        userToDelete = null
                        coroutineScope.launch {
                            snackbarHostState.showSnackbar("Team member removed")
                        }
                    },
                    onError = { msg ->
                        userToDelete = null
                        coroutineScope.launch {
                            snackbarHostState.showSnackbar("Failed: $msg")
                        }
                    }
                )
            }
        )
    }

    // Change Server URL Dialog
    if (showEditUrlDialog) {
        AlertDialog(
            onDismissRequest = { showEditUrlDialog = false },
            title = { Text("Update Server Base URL") },
            text = {
                Column {
                    Text("Enter the protocol, host, and port of your ERP backend:")
                    Spacer(modifier = Modifier.height(12.dp))
                    OutlinedTextField(
                        value = tempUrl,
                        onValueChange = { tempUrl = it },
                        label = { Text("Server URL") },
                        placeholder = { Text("https://erp.yourcompany.com") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        showEditUrlDialog = false
                        viewModel.updateServerUrl(tempUrl)
                    }
                ) {
                    Text("Save & Reconnect")
                }
            },
            dismissButton = {
                TextButton(onClick = { showEditUrlDialog = false }) {
                    Text("Cancel")
                }
            }
        )
    }

    // Confirm Logout Dialog
    if (showLogoutDialog) {
        AlertDialog(
            onDismissRequest = { showLogoutDialog = false },
            title = { Text("Log Out") },
            text = { Text("Are you sure you want to end your current session? You can log back in using your username and password.") },
            confirmButton = {
                Button(
                    onClick = {
                        showLogoutDialog = false
                        viewModel.logout(onSuccess = onNavigateToLogin)
                    }
                ) {
                    Text("Log Out")
                }
            },
            dismissButton = {
                TextButton(onClick = { showLogoutDialog = false }) {
                    Text("Cancel")
                }
            }
        )
    }

    // Confirm Unpair Dialog
    if (showUnpairDialog) {
        AlertDialog(
            onDismissRequest = { showUnpairDialog = false },
            title = { Text("Unpair This Device?") },
            text = { Text("Unpairing will remove this device's cryptographic identity from the server. You will need to scan a new pairing QR code or enter a new pairing code to connect again.") },
            confirmButton = {
                Button(
                    onClick = {
                        showUnpairDialog = false
                        viewModel.unpairDevice(onSuccess = onNavigateToPairing)
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = StatusDanger)
                ) {
                    Text("Unpair Device")
                }
            },
            dismissButton = {
                TextButton(onClick = { showUnpairDialog = false }) {
                    Text("Cancel")
                }
            }
        )
    }
}

// ---------------------------------------------------------------------------
// 1. GENERAL TAB
// ---------------------------------------------------------------------------
@Composable
private fun GeneralSettingsTab(
    state: SettingsUiState.Success,
    viewModel: SettingsViewModel,
    onEditUrl: () -> Unit
) {
    // 1. User Profile Card
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(54.dp)
                    .clip(CircleShape)
                    .background(PrimaryBlue),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = (state.user?.name ?: state.user?.username ?: "U").take(1).uppercase(),
                    color = Color.White,
                    fontSize = 22.sp,
                    fontWeight = FontWeight.Bold
                )
            }
            Spacer(modifier = Modifier.width(16.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = state.user?.name ?: state.user?.username ?: "Staff User",
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Bold,
                    color = Slate900
                )
                state.user?.email?.let { email ->
                    Text(
                        text = email,
                        fontSize = 13.sp,
                        color = Slate500
                    )
                }
                Spacer(modifier = Modifier.height(4.dp))
                Surface(
                    color = when (state.user?.role?.lowercase()) {
                        "owner", "admin" -> PrimaryBlue.copy(alpha = 0.12f)
                        "manager" -> StatusSuccess.copy(alpha = 0.12f)
                        else -> Slate200
                    },
                    shape = RoundedCornerShape(6.dp)
                ) {
                    Text(
                        text = (state.user?.role ?: "agent").uppercase(),
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        color = when (state.user?.role?.lowercase()) {
                            "owner", "admin" -> PrimaryBlue
                            "manager" -> StatusSuccess
                            else -> Slate700
                        },
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                    )
                }
            }
        }
    }

    // 2. Preferred Currency Card
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = "Display Currency",
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold,
                color = Slate900
            )
            Text(
                text = "Prices and financial metrics will be displayed in this currency.",
                fontSize = 12.sp,
                color = Slate500
            )
            val currenciesToDisplay = if (state.availableCurrencies.isNotEmpty()) {
                state.availableCurrencies
            } else {
                com.vectis.erp.core.currency.CurrencyFormatter.FALLBACK_CURRENCIES
            }
            LazyRow(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(currenciesToDisplay) { curr ->
                    val isSelected = state.preferredCurrency.equals(curr.code, ignoreCase = true)
                    FilterChip(
                        selected = isSelected,
                        onClick = { viewModel.updatePreferredCurrency(curr.code) },
                        label = {
                            Text(
                                text = "${curr.code} (${curr.symbol})",
                                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                                color = if (isSelected) Color.White else Slate700
                            )
                        },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = PrimaryBlue,
                            selectedLabelColor = Color.White
                        )
                    )
                }
            }
            Spacer(modifier = Modifier.height(8.dp))
            val currentCurr = currenciesToDisplay.find { it.code.equals(state.preferredCurrency, ignoreCase = true) }
            Text(
                text = "Active: ${currentCurr?.name ?: state.preferredCurrency} • Rate vs Base: ${currentCurr?.exchangeRate ?: 1.0}",
                fontSize = 11.sp,
                color = Slate500
            )
        }
    }

    // 3. Server Connection & Device Identity Card
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Connected ERP Server",
                    fontSize = 15.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = Slate900
                )
                Surface(
                    color = if (state.isServerOnline) StatusSuccess.copy(alpha = 0.12f) else StatusDanger.copy(alpha = 0.12f),
                    shape = RoundedCornerShape(6.dp)
                ) {
                    Text(
                        text = if (state.isServerOnline) "ONLINE" else "DISCONNECTED",
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        color = if (state.isServerOnline) StatusSuccess else StatusDanger,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = "Server URL:",
                fontSize = 12.sp,
                color = Slate500
            )
            Text(
                text = state.serverUrl,
                fontSize = 14.sp,
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Medium,
                color = Slate800
            )

            Spacer(modifier = Modifier.height(6.dp))

            Text(
                text = "Paired Device ID:",
                fontSize = 12.sp,
                color = Slate500
            )
            Text(
                text = state.deviceId,
                fontSize = 13.sp,
                fontFamily = FontFamily.Monospace,
                color = Slate700
            )

            Spacer(modifier = Modifier.height(12.dp))

            OutlinedButton(
                onClick = onEditUrl,
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(10.dp)
            ) {
                Icon(Icons.Default.Edit, contentDescription = null, modifier = Modifier.size(16.dp))
                Spacer(modifier = Modifier.width(8.dp))
                Text("Change Server URL")
            }
        }
    }

    // 4. System Diagnostics Card
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = "System Diagnostics",
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold,
                color = Slate900
            )
            Spacer(modifier = Modifier.height(12.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("Database Status", fontSize = 13.sp, color = Slate600)
                Surface(
                    color = if (state.health?.database == "connected" || state.isServerOnline) StatusSuccess.copy(alpha = 0.12f) else StatusWarning.copy(alpha = 0.12f),
                    shape = RoundedCornerShape(6.dp)
                ) {
                    Text(
                        text = (state.health?.database ?: if (state.isServerOnline) "connected" else "unknown").uppercase(),
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = if (state.health?.database == "connected" || state.isServerOnline) StatusSuccess else StatusWarning,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(8.dp))
            HorizontalDivider(color = Slate100)
            Spacer(modifier = Modifier.height(8.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("Backend Uptime", fontSize = 13.sp, color = Slate600)
                Text(
                    text = formatUptime(state.serverUptime),
                    fontSize = 13.sp,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.SemiBold,
                    color = Slate800
                )
            }

            Spacer(modifier = Modifier.height(8.dp))
            HorizontalDivider(color = Slate100)
            Spacer(modifier = Modifier.height(8.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("ERP System Name", fontSize = 13.sp, color = Slate600)
                Text(
                    text = state.companyName,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = Slate800
                )
            }
        }
    }
}

// ---------------------------------------------------------------------------
// 2. SECURITY TAB
// ---------------------------------------------------------------------------
@Composable
private fun SecuritySettingsTab(
    onChangePassword: () -> Unit,
    onLogout: () -> Unit,
    onUnpair: () -> Unit
) {
    // Password Management Card
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = "Account Password",
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold,
                color = Slate900
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = "Update your staff password regularly to maintain account security. Passwords must be at least 8 characters long.",
                fontSize = 12.sp,
                color = Slate500
            )
            Spacer(modifier = Modifier.height(14.dp))

            Button(
                onClick = onChangePassword,
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(10.dp),
                colors = ButtonDefaults.buttonColors(containerColor = PrimaryBlue)
            ) {
                Icon(Icons.Default.Lock, contentDescription = null, modifier = Modifier.size(16.dp))
                Spacer(modifier = Modifier.width(8.dp))
                Text("Change Account Password")
            }
        }
    }

    // Session & Device Actions Card
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = "Session & Security Controls",
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold,
                color = Slate900
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = "Manage your active session or disconnect your mobile companion identity.",
                fontSize = 12.sp,
                color = Slate500
            )
            Spacer(modifier = Modifier.height(14.dp))

            Button(
                onClick = onLogout,
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Slate800)
            ) {
                Icon(Icons.AutoMirrored.Filled.ExitToApp, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(modifier = Modifier.width(8.dp))
                Text("Log Out of Session")
            }

            Spacer(modifier = Modifier.height(8.dp))

            OutlinedButton(
                onClick = onUnpair,
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.outlinedButtonColors(contentColor = StatusDanger)
            ) {
                Icon(Icons.Default.PhonelinkErase, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(modifier = Modifier.width(8.dp))
                Text("Unpair & Disconnect Device")
            }
        }
    }

    // Security Notice Card
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Slate100)
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(Icons.Default.Security, contentDescription = null, tint = PrimaryBlue, modifier = Modifier.size(28.dp))
            Spacer(modifier = Modifier.width(12.dp))
            Column {
                Text(
                    text = "Hardware-Secured Pairing",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    color = Slate900
                )
                Text(
                    text = "This device communicates via TLS mutual cryptographic authentication. Sensitive credentials are never stored unencrypted on mobile storage.",
                    fontSize = 11.sp,
                    color = Slate600
                )
            }
        }
    }
}

// ---------------------------------------------------------------------------
// 3. TEAM TAB
// ---------------------------------------------------------------------------
@Composable
private fun TeamSettingsTab(
    state: SettingsUiState.Success,
    viewModel: SettingsViewModel,
    onAddUser: () -> Unit,
    onDeleteUser: (UserDto) -> Unit
) {
    val canManageTeam = viewModel.permissionManager.canManageDevices() ||
        viewModel.permissionManager.currentUserRole == UserRole.ADMIN ||
        viewModel.permissionManager.currentUserRole == UserRole.OWNER

    if (!canManageTeam) {
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = Color.White)
        ) {
            Column(
                modifier = Modifier.padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Icon(Icons.Default.Lock, contentDescription = null, tint = Slate400, modifier = Modifier.size(36.dp))
                Spacer(modifier = Modifier.height(12.dp))
                Text(
                    text = "Team Management Restricted",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    color = Slate800
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "Admin privileges are required to view and manage team members.",
                    fontSize = 13.sp,
                    color = Slate500,
                    textAlign = TextAlign.Center
                )
            }
        }
        return
    }

    // Action Header
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = "Staff Members (${state.teamUsers.size})",
            fontSize = 16.sp,
            fontWeight = FontWeight.Bold,
            color = Slate900
        )
        Button(
            onClick = onAddUser,
            shape = RoundedCornerShape(10.dp),
            colors = ButtonDefaults.buttonColors(containerColor = PrimaryBlue),
            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
        ) {
            Icon(Icons.Default.PersonAdd, contentDescription = null, modifier = Modifier.size(16.dp))
            Spacer(modifier = Modifier.width(6.dp))
            Text("Add Member", fontSize = 13.sp)
        }
    }

    if (state.teamUsers.isEmpty()) {
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = Color.White)
        ) {
            Column(
                modifier = Modifier.padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    text = "No team members loaded",
                    fontSize = 14.sp,
                    color = Slate600
                )
                Spacer(modifier = Modifier.height(10.dp))
                OutlinedButton(onClick = { viewModel.loadTeamUsers() }) {
                    Text("Load Members")
                }
            }
        }
    } else {
        state.teamUsers.forEach { user ->
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(14.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White)
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .size(44.dp)
                            .clip(CircleShape)
                            .background(
                                when (user.role.lowercase()) {
                                    "owner", "admin" -> PrimaryBlue
                                    "manager" -> StatusSuccess
                                    else -> Slate400
                                }
                            ),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = (user.name.ifBlank { user.username }).take(1).uppercase(),
                            color = Color.White,
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }

                    Spacer(modifier = Modifier.width(12.dp))

                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = user.name.ifBlank { user.username },
                            fontSize = 15.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = Slate900
                        )
                        Text(
                            text = "@${user.username} • ${user.email}",
                            fontSize = 12.sp,
                            color = Slate500,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            Surface(
                                color = when (user.role.lowercase()) {
                                    "owner", "admin" -> PrimaryBlue.copy(alpha = 0.12f)
                                    "manager" -> StatusSuccess.copy(alpha = 0.12f)
                                    else -> Slate200
                                },
                                shape = RoundedCornerShape(4.dp)
                            ) {
                                Text(
                                    text = user.role.uppercase(),
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = when (user.role.lowercase()) {
                                        "owner", "admin" -> PrimaryBlue
                                        "manager" -> StatusSuccess
                                        else -> Slate700
                                    },
                                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                )
                            }

                            Surface(
                                color = StatusSuccess.copy(alpha = 0.10f),
                                shape = RoundedCornerShape(4.dp)
                            ) {
                                Text(
                                    text = user.status.uppercase(),
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Medium,
                                    color = StatusSuccess,
                                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                )
                            }
                        }
                    }

                    // Delete button (cannot delete own logged in account)
                    if (user.id != state.user?.id) {
                        IconButton(
                            onClick = { onDeleteUser(user) },
                            modifier = Modifier.size(36.dp)
                        ) {
                            Icon(
                                Icons.Default.Delete,
                                contentDescription = "Delete User",
                                tint = StatusDanger,
                                modifier = Modifier.size(18.dp)
                            )
                        }
                    }
                }
            }
        }
    }
}

// ---------------------------------------------------------------------------
// 4. AUDIT TRAIL TAB
// ---------------------------------------------------------------------------
@Composable
private fun AuditSettingsTab(
    state: SettingsUiState.Success,
    viewModel: SettingsViewModel
) {
    val canViewAudit = viewModel.permissionManager.canViewAuditLogs()

    if (!canViewAudit) {
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = Color.White)
        ) {
            Column(
                modifier = Modifier.padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Icon(Icons.Default.Lock, contentDescription = null, tint = Slate400, modifier = Modifier.size(36.dp))
                Spacer(modifier = Modifier.height(12.dp))
                Text(
                    text = "Audit Log Access Restricted",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    color = Slate800
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "Admin privileges are required to view security audit trails.",
                    fontSize = 13.sp,
                    color = Slate500,
                    textAlign = TextAlign.Center
                )
            }
        }
        return
    }

    // 30-Day Retention Notice Banner (Web app parity)
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = PrimaryBlue.copy(alpha = 0.08f))
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(Icons.Default.Info, contentDescription = null, tint = PrimaryBlue, modifier = Modifier.size(20.dp))
            Spacer(modifier = Modifier.width(10.dp))
            Text(
                text = "Retention Policy: Audit logs are automatically retained for 30 days and purged by backend schedule.",
                fontSize = 12.sp,
                color = Slate700
            )
        }
    }

    // Audit Event Cards
    if (state.auditLogs.isEmpty()) {
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = Color.White)
        ) {
            Column(
                modifier = Modifier.padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text("No audit log events found", fontSize = 14.sp, color = Slate600)
                Spacer(modifier = Modifier.height(10.dp))
                OutlinedButton(onClick = { viewModel.loadAuditLogs(1) }) {
                    Text("Refresh Audit Trail")
                }
            }
        }
    } else {
        state.auditLogs.forEach { log ->
            AuditLogCard(log = log)
        }

        // Pagination Controls
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp),
            colors = CardDefaults.cardColors(containerColor = Color.White)
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(12.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Page ${state.auditPage} of ${state.auditTotalPages} (${state.auditTotal} events)",
                    fontSize = 12.sp,
                    color = Slate600
                )

                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(
                        onClick = { viewModel.loadAuditLogs(state.auditPage - 1) },
                        enabled = state.auditPage > 1,
                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Text("Prev", fontSize = 12.sp)
                    }

                    OutlinedButton(
                        onClick = { viewModel.loadAuditLogs(state.auditPage + 1) },
                        enabled = state.auditPage < state.auditTotalPages,
                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Text("Next", fontSize = 12.sp)
                    }
                }
            }
        }
    }
}

@Composable
private fun AuditLogCard(log: AuditLogDto) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White)
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                val actionUpper = log.action.uppercase()
                val badgeColor = when {
                    actionUpper.contains("DELETE") -> StatusDanger
                    actionUpper.contains("CREATE") -> StatusSuccess
                    actionUpper.contains("UPDATE") -> Color(0xFFD97706)
                    actionUpper.contains("LOGIN") || actionUpper.contains("AUTH") -> PrimaryBlue
                    else -> Slate700
                }

                Surface(
                    color = badgeColor.copy(alpha = 0.12f),
                    shape = RoundedCornerShape(6.dp)
                ) {
                    Text(
                        text = actionUpper,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = badgeColor,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                    )
                }

                Text(
                    text = log.createdAt.take(19).replace('T', ' '),
                    fontSize = 11.sp,
                    fontFamily = FontFamily.Monospace,
                    color = Slate500
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            val entityName = log.entity ?: "System"
            val entitySnippet = if (!log.entityId.isNullOrBlank()) " #${log.entityId.take(8)}" else ""
            Text(
                text = "$entityName$entitySnippet",
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                color = Slate900
            )

            val actor = log.userName ?: log.userId ?: "System"
            Text(
                text = "by $actor",
                fontSize = 12.sp,
                color = Slate600
            )

            if (!log.ipAddress.isNullOrBlank()) {
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "IP: ${log.ipAddress}",
                    fontSize = 11.sp,
                    fontFamily = FontFamily.Monospace,
                    color = Slate400
                )
            }
        }
    }
}

private fun formatUptime(seconds: Long): String {
    if (seconds <= 0L) return "N/A"
    val days = seconds / 86400
    val hours = (seconds % 86400) / 3600
    val minutes = (seconds % 3600) / 60
    return buildString {
        if (days > 0) append("${days}d ")
        if (hours > 0 || days > 0) append("${hours}h ")
        append("${minutes}m")
    }
}
