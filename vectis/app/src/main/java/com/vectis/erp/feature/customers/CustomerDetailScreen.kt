package com.vectis.erp.feature.customers

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.vectis.erp.core.authorization.AppPermission
import com.vectis.erp.core.design.*
import com.vectis.erp.data.model.CustomerDto
import com.vectis.erp.data.model.CustomerOrderDto
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CustomerDetailScreen(
    customerId: String,
    viewModel: CustomerViewModel,
    onNavigateBack: () -> Unit,
    onOrderClick: (String) -> Unit
) {
    val uiState by viewModel.detailUiState.collectAsState()
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    val snackbarHostState = remember { SnackbarHostState() }

    var showEditDialog by remember { mutableStateOf(false) }
    var showDeleteConfirmDialog by remember { mutableStateOf(false) }

    LaunchedEffect(customerId) {
        viewModel.loadCustomerDetail(customerId)
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            TopAppBar(
                title = { Text("Customer Profile", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = Slate900) },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = Slate700)
                    }
                },
                actions = {
                    if (viewModel.permissionManager.canEditCustomer()) {
                        IconButton(onClick = { showEditDialog = true }) {
                            Icon(Icons.Default.Edit, contentDescription = "Edit", tint = Slate700)
                        }
                    }
                    if (viewModel.permissionManager.canDeleteCustomer()) {
                        IconButton(onClick = { showDeleteConfirmDialog = true }) {
                            Icon(Icons.Default.Delete, contentDescription = "Delete", tint = StatusDanger)
                        }
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
                is CustomerDetailUiState.Loading -> {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(color = PrimaryBlue)
                    }
                }
                is CustomerDetailUiState.Error -> {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.padding(24.dp)) {
                            Icon(Icons.Default.Warning, contentDescription = null, tint = StatusDanger, modifier = Modifier.size(48.dp))
                            Spacer(modifier = Modifier.height(12.dp))
                            Text(text = state.message, color = Slate700, fontSize = 14.sp)
                            Spacer(modifier = Modifier.height(16.dp))
                            Button(onClick = { viewModel.loadCustomerDetail(customerId) }) {
                                Text("Retry")
                            }
                        }
                    }
                }
                is CustomerDetailUiState.Success -> {
                    CustomerDetailContent(
                        customer = state.customer,
                        orders = state.orders,
                        viewModel = viewModel,
                        onOrderClick = onOrderClick,
                        onWhatsAppClick = {
                            viewModel.openWhatsApp(context, state.customer.whatsapp, state.customer.name)
                        },
                        onCallClick = {
                            state.customer.whatsapp?.let { phone ->
                                val intent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:$phone")).apply {
                                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                                }
                                context.startActivity(intent)
                            }
                        },
                        onEmailClick = {
                            state.customer.email?.let { email ->
                                val intent = Intent(Intent.ACTION_SENDTO, Uri.parse("mailto:$email")).apply {
                                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                                }
                                context.startActivity(intent)
                            }
                        }
                    )

                    if (showEditDialog) {
                        CustomerFormDialog(
                            customerToEdit = state.customer,
                            onDismiss = { showEditDialog = false },
                            onSave = { name, email, whatsapp, notes, status ->
                                viewModel.updateCustomer(
                                    id = customerId,
                                    name = name,
                                    email = email,
                                    whatsapp = whatsapp,
                                    notes = notes,
                                    status = status,
                                    onSuccess = {
                                        showEditDialog = false
                                        coroutineScope.launch {
                                            snackbarHostState.showSnackbar("Customer updated successfully")
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

                    if (showDeleteConfirmDialog) {
                        AlertDialog(
                            onDismissRequest = { showDeleteConfirmDialog = false },
                            title = { Text("Delete Customer") },
                            text = {
                                Text("Are you sure you want to permanently delete \"${state.customer.name}\"? Customers with existing orders cannot be deleted.")
                            },
                            confirmButton = {
                                Button(
                                    onClick = {
                                        showDeleteConfirmDialog = false
                                        viewModel.deleteCustomer(
                                            id = customerId,
                                            onSuccess = {
                                                onNavigateBack()
                                            },
                                            onError = { err ->
                                                coroutineScope.launch {
                                                    snackbarHostState.showSnackbar(err)
                                                }
                                            }
                                        )
                                    },
                                    colors = ButtonDefaults.buttonColors(containerColor = StatusDanger)
                                ) {
                                    Text("Delete")
                                }
                            },
                            dismissButton = {
                                TextButton(onClick = { showDeleteConfirmDialog = false }) {
                                    Text("Cancel")
                                }
                            }
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun CustomerDetailContent(
    customer: CustomerDto,
    orders: List<CustomerOrderDto>,
    viewModel: CustomerViewModel,
    onOrderClick: (String) -> Unit,
    onWhatsAppClick: () -> Unit,
    onCallClick: () -> Unit,
    onEmailClick: () -> Unit
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Card 1: Profile Summary & Actions
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(20.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
            ) {
                Column(
                    modifier = Modifier.padding(20.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    val initials = customer.name.split(" ")
                        .take(2)
                        .mapNotNull { it.firstOrNull()?.uppercase() }
                        .joinToString("")
                        .ifEmpty { "C" }

                    Box(
                        modifier = Modifier
                            .size(64.dp)
                            .clip(CircleShape)
                            .background(PrimaryBlue.copy(alpha = 0.1f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = initials,
                            fontSize = 24.sp,
                            fontWeight = FontWeight.Bold,
                            color = PrimaryBlue
                        )
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    Text(
                        text = customer.name,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        color = Slate900
                    )

                    Spacer(modifier = Modifier.height(4.dp))

                    val isActive = customer.status == "active"
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(8.dp))
                            .background(if (isActive) StatusSuccess.copy(alpha = 0.1f) else Slate200)
                            .padding(horizontal = 10.dp, vertical = 4.dp)
                    ) {
                        Text(
                            text = if (isActive) "Active Customer" else "Inactive",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = if (isActive) StatusSuccess else Slate600
                        )
                    }

                    Spacer(modifier = Modifier.height(18.dp))

                    // Quick Action Buttons Row
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceEvenly
                    ) {
                        // WhatsApp
                        @Suppress("DEPRECATION")
                        ActionButtonItem(
                            icon = Icons.Default.Chat,
                            label = "WhatsApp",
                            color = Color(0xFF25D366),
                            enabled = !customer.whatsapp.isNullOrBlank(),
                            onClick = onWhatsAppClick
                        )

                        // Call
                        ActionButtonItem(
                            icon = Icons.Default.Phone,
                            label = "Call",
                            color = PrimaryBlue,
                            enabled = !customer.whatsapp.isNullOrBlank(),
                            onClick = onCallClick
                        )

                        // Email
                        ActionButtonItem(
                            icon = Icons.Default.Email,
                            label = "Email",
                            color = StatusPurple,
                            enabled = !customer.email.isNullOrBlank(),
                            onClick = onEmailClick
                        )
                    }
                }
            }
        }

        // Card 2: Lifetime KPI Cards
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Card(
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text("Total Orders", fontSize = 12.sp, color = Slate500)
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = "${customer.totalOrders}",
                            fontSize = 20.sp,
                            fontWeight = FontWeight.Bold,
                            color = Slate900
                        )
                    }
                }

                Card(
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text("Total Spent", fontSize = 12.sp, color = Slate500)
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = viewModel.formatCurrency(customer.totalSpent),
                            fontSize = 20.sp,
                            fontWeight = FontWeight.Bold,
                            color = Slate900
                        )
                    }
                }
            }
        }

        // Card 3: Notes (if present)
        if (!customer.notes.isNullOrBlank()) {
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text("Customer Notes", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = Slate900)
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            text = customer.notes,
                            fontSize = 13.sp,
                            color = Slate700,
                            lineHeight = 18.sp
                        )
                    }
                }
            }
        }

        // Card 4: Order History
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(20.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = "Order History (${orders.size})",
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold,
                        color = Slate900
                    )

                    Spacer(modifier = Modifier.height(12.dp))

                    if (orders.isEmpty()) {
                        Text(
                            text = "No orders found for this customer.",
                            fontSize = 13.sp,
                            color = Slate400,
                            modifier = Modifier.padding(vertical = 12.dp)
                        )
                    } else {
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            orders.forEach { order ->
                                CustomerOrderRow(order = order, viewModel = viewModel, onClick = { onOrderClick(order.id) })
                                HorizontalDivider(color = Slate100)
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ActionButtonItem(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    color: Color,
    enabled: Boolean,
    onClick: () -> Unit
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.clickable(enabled = enabled) { onClick() }
    ) {
        Box(
            modifier = Modifier
                .size(48.dp)
                .clip(CircleShape)
                .background(if (enabled) color.copy(alpha = 0.12f) else Slate100),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = icon,
                contentDescription = label,
                tint = if (enabled) color else Slate400,
                modifier = Modifier.size(22.dp)
            )
        }
        Spacer(modifier = Modifier.height(6.dp))
        Text(
            text = label,
            fontSize = 12.sp,
            fontWeight = FontWeight.Medium,
            color = if (enabled) Slate800 else Slate400
        )
    }
}

@Composable
private fun CustomerOrderRow(
    order: CustomerOrderDto,
    viewModel: CustomerViewModel,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() }
            .padding(vertical = 8.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = order.productName ?: "Product",
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                color = Slate900
            )
            Spacer(modifier = Modifier.height(2.dp))
            Text(
                text = order.planName ?: "Plan",
                fontSize = 12.sp,
                color = Slate500
            )
        }

        Column(horizontalAlignment = Alignment.End) {
            Text(
                text = viewModel.formatCurrency(order.price),
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                color = Slate900
            )
            Spacer(modifier = Modifier.height(2.dp))

            val (statusBg, statusFg) = when (order.status.lowercase()) {
                "active" -> StatusSuccess.copy(alpha = 0.1f) to StatusSuccess
                "expiring" -> StatusWarning.copy(alpha = 0.1f) to StatusWarning
                "expired" -> StatusDanger.copy(alpha = 0.1f) to StatusDanger
                else -> Slate100 to Slate600
            }

            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(6.dp))
                    .background(statusBg)
                    .padding(horizontal = 6.dp, vertical = 2.dp)
            ) {
                Text(
                    text = order.status.replaceFirstChar { it.uppercase() },
                    fontSize = 10.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = statusFg
                )
            }
        }
    }
}
