package com.vectis.erp.feature.customers

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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.vectis.erp.core.authorization.AppPermission
import com.vectis.erp.core.design.*
import com.vectis.erp.data.model.CustomerDto
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CustomerListScreen(
    viewModel: CustomerViewModel,
    onCustomerClick: (String) -> Unit
) {
    val uiState by viewModel.listUiState.collectAsState()
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    val snackbarHostState = remember { SnackbarHostState() }

    var showCreateDialog by remember { mutableStateOf(false) }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("Customers", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = Slate900)
                        Text("Customer Directory & Contacts", fontSize = 12.sp, color = Slate500)
                    }
                },
                actions = {
                    IconButton(onClick = { viewModel.loadCustomers(isRefresh = true) }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Refresh", tint = PrimaryBlue)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Color.White)
            )
        },
        floatingActionButton = {
            if (viewModel.permissionManager.canCreateCustomer()) {
                FloatingActionButton(
                    onClick = { showCreateDialog = true },
                    containerColor = PrimaryBlue,
                    contentColor = Color.White,
                    shape = CircleShape
                ) {
                    Icon(Icons.Default.Add, contentDescription = "Add Customer")
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
                placeholder = { Text("Search by name, WhatsApp, or email...", fontSize = 14.sp, color = Slate400) },
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

            // Filter Chips
            var selectedFilter by remember { mutableStateOf<String?>(null) }
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
                        label = { Text("All") },
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
                        label = { Text("Active") },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = StatusSuccess.copy(alpha = 0.1f),
                            selectedLabelColor = StatusSuccess
                        )
                    )
                }
                item {
                    FilterChip(
                        selected = selectedFilter == "inactive",
                        onClick = {
                            selectedFilter = "inactive"
                            viewModel.onStatusFilterChanged("inactive")
                        },
                        label = { Text("Inactive") },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = Slate200,
                            selectedLabelColor = Slate700
                        )
                    )
                }
            }

            Spacer(modifier = Modifier.height(4.dp))

            // Body content
            when (val state = uiState) {
                is CustomerListUiState.Loading -> {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(color = PrimaryBlue)
                    }
                }
                is CustomerListUiState.Error -> {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.padding(24.dp)) {
                            Icon(Icons.Default.Warning, contentDescription = null, tint = StatusDanger, modifier = Modifier.size(48.dp))
                            Spacer(modifier = Modifier.height(12.dp))
                            Text(text = state.message, color = Slate700, fontSize = 14.sp)
                            Spacer(modifier = Modifier.height(16.dp))
                            Button(onClick = { viewModel.loadCustomers() }) {
                                Text("Retry")
                            }
                        }
                    }
                }
                is CustomerListUiState.Success -> {
                    if (state.customers.isEmpty()) {
                        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.padding(24.dp)) {
                                Icon(Icons.Default.PersonOff, contentDescription = null, tint = Slate300, modifier = Modifier.size(56.dp))
                                Spacer(modifier = Modifier.height(12.dp))
                                Text(
                                    text = if (searchText.isNotBlank()) "No customers found matching \"$searchText\"" else "No customers registered yet.",
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
                            items(state.customers, key = { it.id }) { customer ->
                                CustomerCard(
                                    customer = customer,
                                    viewModel = viewModel,
                                    onClick = { onCustomerClick(customer.id) },
                                    onWhatsAppClick = {
                                        viewModel.openWhatsApp(context, customer.whatsapp, customer.name)
                                    }
                                )
                            }
                        }
                    }
                }
            }
        }
    }

    if (showCreateDialog) {
        CustomerFormDialog(
            customerToEdit = null,
            onDismiss = { showCreateDialog = false },
            onSave = { name, email, whatsapp, notes, _ ->
                viewModel.createCustomer(
                    name = name,
                    email = email,
                    whatsapp = whatsapp,
                    notes = notes,
                    onSuccess = { newId ->
                        showCreateDialog = false
                        coroutineScope.launch {
                            snackbarHostState.showSnackbar("Customer created successfully")
                        }
                        if (newId.isNotBlank()) {
                            onCustomerClick(newId)
                        }
                    },
                    onError = { err ->
                        coroutineScope.launch {
                            snackbarHostState.showSnackbar(err)
                        }
                    }
                )
            }
        )
    }
}

@Composable
private fun CustomerCard(
    customer: CustomerDto,
    viewModel: CustomerViewModel,
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
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Initials Circle
                val initials = customer.name.split(" ")
                    .take(2)
                    .mapNotNull { it.firstOrNull()?.uppercase() }
                    .joinToString("")
                    .ifEmpty { "C" }

                Box(
                    modifier = Modifier
                        .size(44.dp)
                        .clip(CircleShape)
                        .background(PrimaryBlue.copy(alpha = 0.1f)),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = initials,
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                        color = PrimaryBlue
                    )
                }

                Spacer(modifier = Modifier.width(12.dp))

                // Name and Status
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = customer.name,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold,
                        color = Slate900,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    Spacer(modifier = Modifier.height(2.dp))
                    if (!customer.email.isNullOrBlank()) {
                        Text(
                            text = customer.email,
                            fontSize = 12.sp,
                            color = Slate500,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                }

                // WhatsApp Action Button
                if (!customer.whatsapp.isNullOrBlank()) {
                    IconButton(
                        onClick = onWhatsAppClick,
                        modifier = Modifier
                            .size(36.dp)
                            .clip(CircleShape)
                            .background(Color(0xFF25D366).copy(alpha = 0.12f))
                    ) {
                        @Suppress("DEPRECATION")
                        Icon(
                            imageVector = Icons.Default.Chat,
                            contentDescription = "WhatsApp Chat",
                            tint = Color(0xFF128C7E),
                            modifier = Modifier.size(18.dp)
                        )
                    }
                }

                Spacer(modifier = Modifier.width(6.dp))

                // Status Pill
                val isActive = customer.status == "active"
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(8.dp))
                        .background(if (isActive) StatusSuccess.copy(alpha = 0.1f) else Slate200)
                        .padding(horizontal = 8.dp, vertical = 4.dp)
                ) {
                    Text(
                        text = if (isActive) "Active" else "Inactive",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = if (isActive) StatusSuccess else Slate600
                    )
                }
            }

            // WhatsApp phone line if present
            if (!customer.whatsapp.isNullOrBlank()) {
                Spacer(modifier = Modifier.height(8.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Default.Phone,
                        contentDescription = null,
                        tint = Slate400,
                        modifier = Modifier.size(14.dp)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = customer.whatsapp,
                        fontSize = 12.sp,
                        color = Slate600,
                        fontWeight = FontWeight.Medium
                    )
                }
            }

            Spacer(modifier = Modifier.height(10.dp))
            HorizontalDivider(color = Slate100)
            Spacer(modifier = Modifier.height(8.dp))

            // Footer Metrics
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "${customer.totalOrders} ${if (customer.totalOrders == 1) "order" else "orders"}",
                    fontSize = 12.sp,
                    color = Slate500,
                    fontWeight = FontWeight.Medium
                )
                Text(
                    text = "Spent: ${viewModel.formatCurrency(customer.totalSpent)}",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = Slate800
                )
            }
        }
    }
}
