package com.vectis.erp.feature.alerts

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
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
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.vectis.erp.core.design.*
import com.vectis.erp.data.model.AlertOrderDto
import com.vectis.erp.data.model.UpsertTemplateRequest
import com.vectis.erp.data.model.WhatsAppTemplateDto
import com.vectis.erp.feature.products.ConfirmDeleteDialog
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AlertsScreen(
    viewModel: AlertsViewModel,
    onOrderClick: (String) -> Unit,
    onNavigateBack: (() -> Unit)? = null
) {
    val uiState by viewModel.uiState.collectAsState()
    val context = LocalContext.current
    val snackbarHostState = remember { SnackbarHostState() }
    val coroutineScope = rememberCoroutineScope()

    var showTemplateEditor by remember { mutableStateOf(false) }
    var templateToEdit by remember { mutableStateOf<WhatsAppTemplateDto?>(null) }
    var templateToDelete by remember { mutableStateOf<WhatsAppTemplateDto?>(null) }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("Subscription Alerts", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = Slate900)
                        Text("Expiring, Expired & WhatsApp Templates", fontSize = 12.sp, color = Slate500)
                    }
                },
                navigationIcon = {
                    if (onNavigateBack != null) {
                        IconButton(onClick = onNavigateBack) {
                            Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = Slate700)
                        }
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
                        Text("Active Language:", fontSize = 12.sp, fontWeight = FontWeight.Medium, color = Slate600)
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
                        AlertsFilter.values().forEach { filter ->
                            val count = when (filter) {
                                AlertsFilter.EXPIRING -> state.expiringOrders.size
                                AlertsFilter.EXPIRED -> state.expiredOrders.size
                                AlertsFilter.LOW_STOCK -> state.lowStockAccounts.size + state.lowInventory.size
                                AlertsFilter.TEMPLATES -> state.templates.size
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
                        AlertsFilter.TEMPLATES -> {
                            TemplatesTabContent(
                                templates = state.templates,
                                onAddClick = {
                                    templateToEdit = null
                                    showTemplateEditor = true
                                },
                                onEditClick = { tmpl ->
                                    templateToEdit = tmpl
                                    showTemplateEditor = true
                                },
                                onDeleteClick = { tmpl ->
                                    templateToDelete = tmpl
                                },
                                onRefreshClick = {
                                    viewModel.loadTemplates()
                                }
                            )
                        }
                    }
                }
            }
        }
    }

    // Template Editor Dialog
    if (showTemplateEditor) {
        TemplateEditorDialog(
            template = templateToEdit,
            onDismiss = { showTemplateEditor = false },
            onSubmit = { req ->
                viewModel.upsertTemplate(
                    req = req,
                    onSuccess = {
                        showTemplateEditor = false
                        coroutineScope.launch {
                            snackbarHostState.showSnackbar("Template saved successfully")
                        }
                    },
                    onError = { err ->
                        coroutineScope.launch {
                            snackbarHostState.showSnackbar("Failed: $err")
                        }
                    }
                )
            }
        )
    }

    // Confirm Delete Template Dialog
    templateToDelete?.let { tmpl ->
        ConfirmDeleteDialog(
            title = "Delete WhatsApp Template",
            message = "Are you sure you want to delete template \"${tmpl.name}\"? This action cannot be undone.",
            onDismiss = { templateToDelete = null },
            onConfirm = {
                viewModel.deleteTemplate(
                    id = tmpl.id,
                    onSuccess = {
                        templateToDelete = null
                        coroutineScope.launch {
                            snackbarHostState.showSnackbar("Template deleted")
                        }
                    },
                    onError = { err ->
                        templateToDelete = null
                        coroutineScope.launch {
                            snackbarHostState.showSnackbar("Failed: $err")
                        }
                    }
                )
            }
        )
    }
}

@Composable
private fun TemplatesTabContent(
    templates: List<WhatsAppTemplateDto>,
    onAddClick: () -> Unit,
    onEditClick: (WhatsAppTemplateDto) -> Unit,
    onDeleteClick: (WhatsAppTemplateDto) -> Unit,
    onRefreshClick: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "Notification Templates (${templates.size})",
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                color = Slate900
            )

            Button(
                onClick = onAddClick,
                shape = RoundedCornerShape(10.dp),
                colors = ButtonDefaults.buttonColors(containerColor = PrimaryBlue),
                contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
            ) {
                Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(16.dp))
                Spacer(modifier = Modifier.width(4.dp))
                Text("New Template", fontSize = 12.sp)
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        if (templates.isEmpty()) {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White)
            ) {
                Column(
                    modifier = Modifier.padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text("No custom templates loaded", color = Slate600, fontSize = 14.sp)
                    Spacer(modifier = Modifier.height(10.dp))
                    OutlinedButton(onClick = onRefreshClick) {
                        Text("Load Templates")
                    }
                }
            }
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                items(templates, key = { it.id }) { tmpl ->
                    TemplateCard(
                        template = tmpl,
                        onEdit = { onEditClick(tmpl) },
                        onDelete = { onDeleteClick(tmpl) }
                    )
                }
            }
        }
    }
}

@Composable
private fun TemplateCard(
    template: WhatsAppTemplateDto,
    onEdit: () -> Unit,
    onDelete: () -> Unit
) {
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
                    text = template.name,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    color = Slate900,
                    modifier = Modifier.weight(1f)
                )

                Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    IconButton(onClick = onEdit, modifier = Modifier.size(32.dp)) {
                        Icon(Icons.Default.Edit, contentDescription = "Edit", tint = Slate600, modifier = Modifier.size(16.dp))
                    }
                    IconButton(onClick = onDelete, modifier = Modifier.size(32.dp)) {
                        Icon(Icons.Default.Delete, contentDescription = "Delete", tint = StatusDanger, modifier = Modifier.size(16.dp))
                    }
                }
            }

            Spacer(modifier = Modifier.height(6.dp))

            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                val (catColor, catLabel) = when (template.eventType) {
                    "order_created" -> StatusSuccess to "ORDER CREATED"
                    "order_expiring" -> Color(0xFFD97706) to "EXPIRING REMINDER"
                    "order_expired" -> StatusDanger to "EXPIRED"
                    else -> Slate600 to template.eventType.uppercase()
                }

                Surface(
                    color = catColor.copy(alpha = 0.12f),
                    shape = RoundedCornerShape(4.dp)
                ) {
                    Text(
                        text = catLabel,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        color = catColor,
                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                    )
                }

                Surface(
                    color = PrimaryBlue.copy(alpha = 0.12f),
                    shape = RoundedCornerShape(4.dp)
                ) {
                    Text(
                        text = template.language.uppercase(),
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        color = PrimaryBlue,
                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = template.content,
                fontSize = 12.sp,
                color = Slate700,
                maxLines = 3,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun TemplateEditorDialog(
    template: WhatsAppTemplateDto?,
    onDismiss: () -> Unit,
    onSubmit: (UpsertTemplateRequest) -> Unit
) {
    var name by remember { mutableStateOf(template?.name ?: "") }
    var eventType by remember { mutableStateOf(template?.eventType ?: "order_expiring") }
    var language by remember { mutableStateOf(template?.language ?: "en") }
    var content by remember { mutableStateOf(template?.content ?: "") }
    var errorMsg by remember { mutableStateOf<String?>(null) }

    var categoryDropdown by remember { mutableStateOf(false) }
    var languageDropdown by remember { mutableStateOf(false) }

    val variables = listOf("{customer_name}", "{product_name}", "{plan_name}", "{end_date}", "{order_id}", "{days_remaining}")

    Dialog(onDismissRequest = onDismiss) {
        Card(
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = Color.White),
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 16.dp)
        ) {
            Column(
                modifier = Modifier
                    .padding(20.dp)
                    .verticalScroll(rememberScrollState())
            ) {
                Text(
                    text = if (template != null) "Edit Template" else "New WhatsApp Template",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    color = Slate900
                )

                Spacer(modifier = Modifier.height(14.dp))

                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it; errorMsg = null },
                    label = { Text("Template Name") },
                    placeholder = { Text("e.g. 3-Day Expiry Reminder") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(10.dp)
                )

                Spacer(modifier = Modifier.height(10.dp))

                // Event Category Dropdown
                ExposedDropdownMenuBox(
                    expanded = categoryDropdown,
                    onExpandedChange = { categoryDropdown = it }
                ) {
                    OutlinedTextField(
                        value = when (eventType) {
                            "order_created" -> "Order Created (Delivery)"
                            "order_expiring" -> "Expiring Soon (Reminder)"
                            "order_expired" -> "Expired (Renewal Notice)"
                            else -> eventType
                        },
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("Event Category") },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = categoryDropdown) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .menuAnchor(),
                        shape = RoundedCornerShape(10.dp)
                    )
                    ExposedDropdownMenu(
                        expanded = categoryDropdown,
                        onDismissRequest = { categoryDropdown = false }
                    ) {
                        DropdownMenuItem(
                            text = { Text("Order Created (Delivery)") },
                            onClick = { eventType = "order_created"; categoryDropdown = false }
                        )
                        DropdownMenuItem(
                            text = { Text("Expiring Soon (Reminder)") },
                            onClick = { eventType = "order_expiring"; categoryDropdown = false }
                        )
                        DropdownMenuItem(
                            text = { Text("Expired (Renewal Notice)") },
                            onClick = { eventType = "order_expired"; categoryDropdown = false }
                        )
                    }
                }

                Spacer(modifier = Modifier.height(10.dp))

                // Language Dropdown
                ExposedDropdownMenuBox(
                    expanded = languageDropdown,
                    onExpandedChange = { languageDropdown = it }
                ) {
                    OutlinedTextField(
                        value = when (language) {
                            "en" -> "English (EN)"
                            "fr" -> "Français (FR)"
                            "ar" -> "العربية (AR)"
                            "ru" -> "Русский (RU)"
                            else -> language.uppercase()
                        },
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("Language") },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = languageDropdown) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .menuAnchor(),
                        shape = RoundedCornerShape(10.dp)
                    )
                    ExposedDropdownMenu(
                        expanded = languageDropdown,
                        onDismissRequest = { languageDropdown = false }
                    ) {
                        DropdownMenuItem(text = { Text("English (EN)") }, onClick = { language = "en"; languageDropdown = false })
                        DropdownMenuItem(text = { Text("Français (FR)") }, onClick = { language = "fr"; languageDropdown = false })
                        DropdownMenuItem(text = { Text("العربية (AR)") }, onClick = { language = "ar"; languageDropdown = false })
                        DropdownMenuItem(text = { Text("Русский (RU)") }, onClick = { language = "ru"; languageDropdown = false })
                    }
                }

                Spacer(modifier = Modifier.height(10.dp))

                Text("Available Variables (Click to insert):", fontSize = 11.sp, color = Slate600)
                Spacer(modifier = Modifier.height(4.dp))
                LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    items(variables) { variable ->
                        SuggestionChip(
                            onClick = {
                                content = if (content.isEmpty()) variable else "$content $variable"
                            },
                            label = { Text(variable, fontSize = 11.sp) }
                        )
                    }
                }

                Spacer(modifier = Modifier.height(8.dp))

                OutlinedTextField(
                    value = content,
                    onValueChange = { content = it; errorMsg = null },
                    label = { Text("Message Template Content") },
                    placeholder = { Text("Hello {customer_name}! Your subscription...") },
                    minLines = 4,
                    maxLines = 6,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(10.dp)
                )

                if (errorMsg != null) {
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(errorMsg!!, color = StatusDanger, fontSize = 12.sp)
                }

                Spacer(modifier = Modifier.height(16.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End
                ) {
                    TextButton(onClick = onDismiss) {
                        Text("Cancel", color = Slate500)
                    }
                    Spacer(modifier = Modifier.width(8.dp))
                    Button(
                        onClick = {
                            if (content.isBlank()) {
                                errorMsg = "Template content cannot be empty"
                                return@Button
                            }
                            onSubmit(
                                UpsertTemplateRequest(
                                    id = template?.id,
                                    name = name.ifBlank { "${eventType} (${language.uppercase()})" },
                                    eventType = eventType,
                                    language = language,
                                    content = content.trim()
                                )
                            )
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = PrimaryBlue)
                    ) {
                        Text(if (template != null) "Update" else "Save Template")
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
                        .background(if (isExpired) StatusDanger.copy(alpha = 0.1f) else StatusWarning.copy(alpha = 0.12f))
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

            Text(
                text = "${order.productName ?: "Product"} • ${order.planName ?: "Plan"}",
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                color = Slate900
            )

            Text(
                text = "Customer: ${order.customerName ?: "Unknown"}",
                fontSize = 13.sp,
                color = Slate600
            )

            if (!order.endDate.isNullOrBlank()) {
                Text(
                    text = "End Date: ${order.endDate.take(10)}",
                    fontSize = 12.sp,
                    color = Slate500
                )
            }

            Spacer(modifier = Modifier.height(10.dp))
            HorizontalDivider(color = Slate100)
            Spacer(modifier = Modifier.height(10.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = viewModel.formatCurrency(order.price),
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold,
                    color = Slate900
                )

                Button(
                    onClick = onWhatsAppClick,
                    shape = RoundedCornerShape(8.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF25D366)),
                    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
                ) {
                    Icon(
                        Icons.Default.Share,
                        contentDescription = "Send WhatsApp",
                        tint = Color.White,
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = if (isExpired) "Send Expired Alert" else "Send Reminder",
                        color = Color.White,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold
                    )
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
        EmptyAlertsState("Inventory capacity is healthy. No low stock items.")
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
