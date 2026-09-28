package com.vectis.erp.feature.orders

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.vectis.erp.core.design.*
import com.vectis.erp.data.model.OrderDto
import com.vectis.erp.data.model.OrderRenewalDto
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OrderDetailScreen(
    orderId: String,
    viewModel: OrderViewModel,
    onNavigateBack: () -> Unit
) {
    val uiState by viewModel.detailUiState.collectAsState()
    val preferredCurrency by viewModel.preferredCurrency.collectAsState()
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    val snackbarHostState = remember { SnackbarHostState() }

    var showRenewDialog by remember { mutableStateOf(false) }
    var showCancelDialog by remember { mutableStateOf(false) }
    var showDeleteConfirmDialog by remember { mutableStateOf(false) }
    var showEditDialog by remember { mutableStateOf(false) }
    var showReceiptDialog by remember { mutableStateOf(false) }
    var isRefreshing by remember { mutableStateOf(false) }

    LaunchedEffect(orderId) {
        viewModel.loadOrderDetail(orderId)
    }

    Scaffold(
        snackbarHost = { VectisSnackbarHost(snackbarHostState) },
        topBar = {
            TopAppBar(
                title = { Text("Order Details", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = Slate900) },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = Slate700)
                    }
                },
                actions = {
                    if (viewModel.permissionManager.canEditOrder()) {
                        IconButton(onClick = { showEditDialog = true }) {
                            Icon(Icons.Default.Edit, contentDescription = "Edit Order", tint = PrimaryBlue)
                        }
                    }
                    if (viewModel.permissionManager.canRenewOrder()) {
                        IconButton(onClick = { showRenewDialog = true }) {
                            Icon(Icons.Default.Autorenew, contentDescription = "Renew Order", tint = PrimaryBlue)
                        }
                    }
                    if (viewModel.permissionManager.canDeleteOrder()) {
                        IconButton(onClick = { showDeleteConfirmDialog = true }) {
                            Icon(Icons.Default.Delete, contentDescription = "Delete Order", tint = StatusDanger)
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Color.White)
            )
        },
        containerColor = Slate50
    ) { paddingValues ->
        VectisPullToRefreshBox(
            isRefreshing = isRefreshing,
            onRefresh = {
                coroutineScope.launch {
                    isRefreshing = true
                    viewModel.loadOrderDetail(orderId)
                    delay(500)
                    isRefreshing = false
                }
            },
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            when (val state = uiState) {
                is OrderDetailUiState.Loading -> {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(color = PrimaryBlue)
                    }
                }
                is OrderDetailUiState.Error -> {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.padding(24.dp)) {
                            Icon(Icons.Default.Warning, contentDescription = null, tint = StatusDanger, modifier = Modifier.size(48.dp))
                            Spacer(modifier = Modifier.height(12.dp))
                            Text(text = state.message, color = Slate700, fontSize = 14.sp)
                            Spacer(modifier = Modifier.height(16.dp))
                            Button(
                                onClick = { viewModel.loadOrderDetail(orderId) },
                                colors = ButtonDefaults.buttonColors(containerColor = PrimaryBlue, contentColor = Color.White)
                            ) {
                                Text("Retry", color = Color.White)
                            }
                        }
                    }
                }
                is OrderDetailUiState.Success -> {
                    var revealedPassword by remember(state.order.id) { mutableStateOf<String?>(null) }

                    LaunchedEffect(state.order.id, state.order.assignedServiceAccountId) {
                        if (state.order.accountPassword.isNullOrBlank() && !state.order.assignedServiceAccountId.isNullOrBlank()) {
                            revealedPassword = viewModel.revealServiceAccountPassword(state.order.assignedServiceAccountId)
                        }
                    }

                    OrderDetailContent(
                        order = state.order,
                        renewals = state.renewals,
                        viewModel = viewModel,
                        revealedPassword = revealedPassword,
                        onWhatsAppReceiptClick = {
                            showReceiptDialog = true
                        },
                        onCancelClick = { showCancelDialog = true }
                    )

                    if (showRenewDialog) {
                        RenewOrderDialog(
                            order = state.order,
                            onDismiss = { showRenewDialog = false },
                            onConfirm = { extendFrom, price ->
                                viewModel.renewOrder(
                                    id = orderId,
                                    extendFrom = extendFrom,
                                    customPrice = price,
                                    onSuccess = {
                                        showRenewDialog = false
                                        coroutineScope.launch {
                                            snackbarHostState.showSnackbar("Subscription renewed successfully!")
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

                    if (showCancelDialog) {
                        AlertDialog(
                            onDismissRequest = { showCancelDialog = false },
                            containerColor = Color.White,
                            title = { Text("Cancel Order") },
                            text = { Text("Are you sure you want to cancel this order? Allocated inventory (service profiles or license keys) will be released back to the available pool.") },
                            confirmButton = {
                                Button(
                                    onClick = {
                                        showCancelDialog = false
                                        viewModel.cancelOrder(
                                            id = orderId,
                                            reason = "User requested cancellation via mobile companion",
                                            onSuccess = {
                                                coroutineScope.launch {
                                                    snackbarHostState.showSnackbar("Order cancelled and inventory released.")
                                                }
                                            },
                                            onError = { err ->
                                                coroutineScope.launch {
                                                    snackbarHostState.showSnackbar(err)
                                                }
                                            }
                                        )
                                    },
                                    colors = ButtonDefaults.buttonColors(containerColor = StatusWarning)
                                ) {
                                    Text("Cancel Order")
                                }
                            },
                            dismissButton = {
                                TextButton(onClick = { showCancelDialog = false }) {
                                    Text("Dismiss")
                                }
                            }
                        )
                    }

                    if (showDeleteConfirmDialog) {
                        AlertDialog(
                            onDismissRequest = { showDeleteConfirmDialog = false },
                            containerColor = Color.White,
                            title = { Text("Delete Order Permanently") },
                            text = { Text("Are you sure you want to permanently delete order ${state.order.orderNumber}? This action is restricted to Admins and cannot be undone.") },
                            confirmButton = {
                                Button(
                                    onClick = {
                                        showDeleteConfirmDialog = false
                                        viewModel.deleteOrder(
                                            id = orderId,
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
                                    Text("Dismiss")
                                }
                            }
                        )
                    }

                    if (showEditDialog) {
                        EditOrderDialog(
                            order = state.order,
                            viewModel = viewModel,
                            onDismiss = { showEditDialog = false },
                            onSave = { req ->
                                viewModel.updateOrder(
                                    id = state.order.id,
                                    request = req,
                                    onSuccess = {
                                        showEditDialog = false
                                        coroutineScope.launch {
                                            snackbarHostState.showSnackbar("Order updated successfully.")
                                        }
                                    },
                                    onError = { err ->
                                        coroutineScope.launch {
                                            snackbarHostState.showSnackbar("Failed to update: $err")
                                        }
                                    }
                                )
                            }
                        )
                    }

                    if (showReceiptDialog) {
                        DeliveryReceiptDialog(
                            order = state.order,
                            viewModel = viewModel,
                            revealedPassword = revealedPassword,
                            onDismiss = { showReceiptDialog = false }
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun OrderDetailContent(
    order: OrderDto,
    renewals: List<OrderRenewalDto>,
    viewModel: OrderViewModel,
    revealedPassword: String? = null,
    onWhatsAppReceiptClick: () -> Unit,
    onCancelClick: () -> Unit
) {
    val clipboardManager = LocalClipboardManager.current

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Card 1: Header Summary
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(20.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
            ) {
                Column(modifier = Modifier.padding(18.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text(
                                text = order.orderNumber,
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Bold,
                                fontFamily = FontFamily.Monospace,
                                color = PrimaryBlue
                            )
                            Text(
                                text = "Created: ${order.createdAt?.take(10) ?: "Recent"}",
                                fontSize = 11.sp,
                                color = Slate400
                            )
                        }

                        val (statusBg, statusFg) = when (order.effectiveStatus) {
                            "active" -> StatusSuccess.copy(alpha = 0.1f) to StatusSuccess
                            "expiring" -> StatusWarning.copy(alpha = 0.1f) to StatusWarning
                            "expired" -> StatusDanger.copy(alpha = 0.1f) to StatusDanger
                            else -> Slate100 to Slate600
                        }

                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(8.dp))
                                .background(statusBg)
                                .padding(horizontal = 10.dp, vertical = 4.dp)
                        ) {
                            Text(
                                text = order.effectiveStatus.replaceFirstChar { it.uppercase() },
                                fontSize = 12.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = statusFg
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(14.dp))
                    HorizontalDivider(color = Slate100)
                    Spacer(modifier = Modifier.height(14.dp))

                    // Customer & Price
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text("Customer", fontSize = 11.sp, color = Slate400)
                            Text(order.customerName ?: "Unknown", fontSize = 15.sp, fontWeight = FontWeight.Bold, color = Slate900)
                            if (!order.customerWhatsapp.isNullOrBlank()) {
                                Text(order.customerWhatsapp, fontSize = 12.sp, color = Slate600)
                            }
                        }

                        Column(horizontalAlignment = Alignment.End) {
                            Text("Total Price", fontSize = 11.sp, color = Slate400)
                            Text(viewModel.formatCurrency(order.price), fontSize = 18.sp, fontWeight = FontWeight.Bold, color = Slate900)
                        }
                    }

                    Spacer(modifier = Modifier.height(14.dp))

                    // WhatsApp Delivery Receipt Button
                    if (!order.customerWhatsapp.isNullOrBlank()) {
                        Button(
                            onClick = onWhatsAppReceiptClick,
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF25D366)),
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            @Suppress("DEPRECATION")
                            Icon(Icons.Default.Chat, contentDescription = null, tint = Color.White, modifier = Modifier.size(18.dp))
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Send WhatsApp Delivery Receipt", fontWeight = FontWeight.SemiBold, color = Color.White)
                        }
                    }
                }
            }
        }

        // Card 2: Universal Fulfillment & Digital Inventory Delivered
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(20.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
            ) {
                Column(modifier = Modifier.padding(18.dp)) {
                    Text(
                        text = "Fulfillment Details",
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold,
                        color = Slate900
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "${order.productName} • ${order.planName}",
                        fontSize = 13.sp,
                        color = Slate600
                    )

                    Spacer(modifier = Modifier.height(12.dp))

                    if (order.isServiceAccount) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(12.dp))
                                .background(Slate50)
                                .padding(12.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            order.accountLogin?.let { login ->
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text("Login:", fontSize = 12.sp, color = Slate500)
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Text(login, fontSize = 12.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace)
                                        IconButton(onClick = { clipboardManager.setText(AnnotatedString(login)) }, modifier = Modifier.size(24.dp)) {
                                            Icon(Icons.Default.ContentCopy, contentDescription = "Copy", tint = PrimaryBlue, modifier = Modifier.size(14.dp))
                                        }
                                    }
                                }
                            }
                            val password = order.accountPassword ?: revealedPassword
                            if (!password.isNullOrBlank()) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text("Password:", fontSize = 12.sp, color = Slate500)
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Text(password, fontSize = 12.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace, color = Slate900)
                                        IconButton(onClick = { clipboardManager.setText(AnnotatedString(password)) }, modifier = Modifier.size(24.dp)) {
                                            Icon(Icons.Default.ContentCopy, contentDescription = "Copy", tint = PrimaryBlue, modifier = Modifier.size(14.dp))
                                        }
                                    }
                                }
                            }
                            order.profileName?.let { profile ->
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text("Profile Slot:", fontSize = 12.sp, color = Slate500)
                                    Text(profile, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                }
                            }
                            order.profilePin?.let { pin ->
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text("Profile PIN:", fontSize = 12.sp, color = Slate500)
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Text(pin, fontSize = 12.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace)
                                        IconButton(onClick = { clipboardManager.setText(AnnotatedString(pin)) }, modifier = Modifier.size(24.dp)) {
                                            Icon(Icons.Default.ContentCopy, contentDescription = "Copy", tint = PrimaryBlue, modifier = Modifier.size(14.dp))
                                        }
                                    }
                                }
                            }
                        }
                    } else if (order.isLicenseKey && !order.licenseKeyString.isNullOrBlank()) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(12.dp))
                                .background(Slate50)
                                .padding(12.dp)
                        ) {
                            Text("License Key:", fontSize = 12.sp, color = Slate500)
                            Spacer(modifier = Modifier.height(4.dp))
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    order.licenseKeyString ?: "",
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Bold,
                                    fontFamily = FontFamily.Monospace,
                                    color = Slate900
                                )
                                IconButton(onClick = { clipboardManager.setText(AnnotatedString(order.licenseKeyString ?: "")) }, modifier = Modifier.size(24.dp)) {
                                    Icon(Icons.Default.ContentCopy, contentDescription = "Copy Key", tint = PrimaryBlue, modifier = Modifier.size(16.dp))
                                }
                            }
                        }
                    } else {
                        Text(
                            text = "Automatic digital allocation fulfilled.",
                            fontSize = 13.sp,
                            color = Slate600
                        )
                    }

                    Spacer(modifier = Modifier.height(10.dp))
                    Text(
                        text = "Duration: ${order.startDate ?: "N/A"} → ${order.endDate ?: "N/A"}",
                        fontSize = 12.sp,
                        color = Slate500
                    )
                }
            }
        }

        // Card 3: Renewals History
        if (renewals.isNotEmpty()) {
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(20.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
                ) {
                    Column(modifier = Modifier.padding(18.dp)) {
                        Text("Renewal History (${renewals.size})", fontSize = 15.sp, fontWeight = FontWeight.Bold, color = Slate900)
                        Spacer(modifier = Modifier.height(10.dp))
                        renewals.forEach { ren ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 10.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                val renewalDate = ren.createdAt?.take(10) ?: ren.previousEndDate
                                Text(
                                    text = renewalDate,
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    color = Slate800
                                )
                                Text(
                                    text = viewModel.formatCurrency(ren.price),
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = Slate900
                                )
                            }
                            HorizontalDivider(color = Slate100)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun RenewOrderDialog(
    order: OrderDto,
    onDismiss: () -> Unit,
    onConfirm: (extendFrom: String, customPrice: Double?) -> Unit
) {
    var extendFrom by remember { mutableStateOf("end_date") }
    var priceText by remember { mutableStateOf(order.price.toString()) }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = Color.White,
        title = { Text("Renew Subscription") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("Extend subscription for order ${order.orderNumber}.")
                Row(verticalAlignment = Alignment.CenterVertically) {
                    RadioButton(
                        selected = extendFrom == "end_date",
                        onClick = { extendFrom = "end_date" }
                    )
                    Text("Extend from current expiry date (${order.endDate})", fontSize = 13.sp)
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    RadioButton(
                        selected = extendFrom == "current_date",
                        onClick = { extendFrom = "current_date" }
                    )
                    Text("Extend from today", fontSize = 13.sp)
                }
                OutlinedTextField(
                    value = priceText,
                    onValueChange = { priceText = it },
                    label = { Text("Renewal Price") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.fillMaxWidth()
                )
            }
        },
        confirmButton = {
            VectisPillButton(
                text = "Renew",
                icon = Icons.Default.Autorenew,
                onClick = {
                    onConfirm(extendFrom, priceText.toDoubleOrNull())
                }
            )
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel")
            }
        }
    )
}

@Composable
private fun DeliveryReceiptDialog(
    order: OrderDto,
    viewModel: OrderViewModel,
    revealedPassword: String? = null,
    onDismiss: () -> Unit
) {
    val context = LocalContext.current
    val clipboardManager = LocalClipboardManager.current
    var selectedLang by remember { mutableStateOf("en") }
    var copied by remember { mutableStateOf(false) }

    val languages = listOf("en" to "EN", "fr" to "FR", "ar" to "AR", "ru" to "RU")
    val messageText = viewModel.buildWhatsAppReceiptText(order, selectedLang, revealedPassword)

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = Color.White,
        title = {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("WhatsApp Delivery Receipt", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = Slate900)
            }
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                // Language selection bar
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Language:", fontSize = 12.sp, color = Slate600, fontWeight = FontWeight.Medium)
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        languages.forEach { (code, label) ->
                            val isSel = selectedLang == code
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(if (isSel) PrimaryBlue else Slate100)
                                    .clickable {
                                        selectedLang = code
                                        copied = false
                                    }
                                    .padding(horizontal = 8.dp, vertical = 4.dp)
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

                // WhatsApp Phone
                if (!order.customerWhatsapp.isNullOrBlank()) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Icon(
                            Icons.Default.Phone,
                            contentDescription = null,
                            tint = Color(0xFF25D366),
                            modifier = Modifier.size(14.dp)
                        )
                        Text(order.customerWhatsapp, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = Slate700)
                    }
                }

                // Message Preview Box
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(Slate50)
                        .padding(12.dp)
                ) {
                    Text(
                        text = messageText,
                        fontSize = 11.sp,
                        fontFamily = FontFamily.Monospace,
                        color = Slate800,
                        lineHeight = 16.sp
                    )
                }

                // Copy to Clipboard button
                OutlinedButton(
                    onClick = {
                        clipboardManager.setText(AnnotatedString(messageText))
                        copied = true
                    },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(10.dp)
                ) {
                    Icon(
                        if (copied) Icons.Default.Check else Icons.Default.ContentCopy,
                        contentDescription = null,
                        modifier = Modifier.size(16.dp),
                        tint = if (copied) StatusSuccess else PrimaryBlue
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = if (copied) "Copied to Clipboard!" else "Copy Message",
                        fontSize = 12.sp,
                        color = if (copied) StatusSuccess else PrimaryBlue
                    )
                }
            }
        },
        confirmButton = {
            VectisPillButton(
                text = "Send WhatsApp",
                icon = Icons.Default.Share,
                containerColor = Color(0xFF25D366),
                onClick = {
                    viewModel.sendWhatsAppReceipt(context, order, selectedLang, revealedPassword)
                    onDismiss()
                }
            )
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Close", color = Slate600)
            }
        }
    )
}
