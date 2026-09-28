package com.vectis.erp.feature.alerts

import androidx.compose.foundation.BorderStroke
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
import androidx.compose.material.icons.automirrored.filled.Send
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
    onNavigateBack: (() -> Unit)? = null,
    preferredCurrency: String = "USD",
    onOpenSearch: () -> Unit = {},
    onNavigateToSettings: () -> Unit = {}
) {
    val uiState by viewModel.uiState.collectAsState()
    val context = LocalContext.current
    val snackbarHostState = remember { SnackbarHostState() }
    val coroutineScope = rememberCoroutineScope()

    var showTemplateEditor by remember { mutableStateOf(false) }
    var templateToEdit by remember { mutableStateOf<WhatsAppTemplateDto?>(null) }
    var templateToDelete by remember { mutableStateOf<WhatsAppTemplateDto?>(null) }
    var phonePromptOrder by remember { mutableStateOf<Pair<AlertOrderDto, String>?>(null) }

    Scaffold(
        contentWindowInsets = WindowInsets(0.dp, 0.dp, 0.dp, 0.dp),
        snackbarHost = { VectisSnackbarHost(snackbarHostState) },
        topBar = {
            VectisTopAppBar(
                onRefresh = { viewModel.loadAlerts(isRefresh = true) },
                onNavigateToSettings = onNavigateToSettings,
                onNavigateToAlerts = {},
                onOpenSearch = onOpenSearch,
                preferredCurrency = preferredCurrency
            )
        },
        containerColor = Slate50
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(top = paddingValues.calculateTopPadding())
        ) {
            ViewHeader(
                title = "Subscription Alerts",
                description = "Expiring, Expired & WhatsApp Templates"
            )
            val isRefreshing = (uiState as? AlertsUiState.Success)?.isRefreshing == true
            VectisPullToRefreshBox(
                isRefreshing = isRefreshing,
                onRefresh = { viewModel.loadAlerts(isRefresh = true) },
                modifier = Modifier.fillMaxSize()
            ) {
                when (val state = uiState) {
                    is AlertsUiState.Loading -> {
                        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                            CircularProgressIndicator(color = PrimaryBlue)
                        }
                    }
                    is AlertsUiState.Error -> {
                        Box(
                            modifier = Modifier
                                .fillMaxSize()
                                .verticalScroll(rememberScrollState()),
                            contentAlignment = Alignment.Center
                        ) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.padding(24.dp)) {
                                Icon(Icons.Default.Warning, contentDescription = null, tint = StatusDanger, modifier = Modifier.size(48.dp))
                                Spacer(modifier = Modifier.height(12.dp))
                                Text(text = state.message, color = Slate700, fontSize = 14.sp)
                                Spacer(modifier = Modifier.height(16.dp))
                                Button(
                                    onClick = { viewModel.loadAlerts() },
                                    colors = ButtonDefaults.buttonColors(containerColor = PrimaryBlue, contentColor = Color.White)
                                ) {
                                    Text("Retry", color = Color.White)
                                }
                            }
                        }
                    }
                    is AlertsUiState.Success -> {
                        Column(modifier = Modifier.fillMaxSize()) {
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

                    // Renewal Feedback Banner
                    if (state.renewalFeedback != null) {
                        RenewalFeedbackCard(
                            feedback = state.renewalFeedback,
                            onDismiss = { viewModel.dismissRenewalFeedback() }
                        )
                    }

                    // Content
                    when (state.activeFilter) {
                        AlertsFilter.EXPIRING -> {
                            if (state.expiringOrders.isEmpty()) {
                                EmptyAlertsState("No subscriptions expiring in the next 7 days.")
                            } else {
                                LazyColumn(
                                    modifier = Modifier.fillMaxSize(),
                                    contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 16.dp, bottom = 80.dp),
                                    verticalArrangement = Arrangement.spacedBy(10.dp)
                                ) {
                                    items(state.expiringOrders, key = { it.id }) { order ->
                                        AlertOrderCard(
                                            order = order,
                                            viewModel = viewModel,
                                            isExpired = false,
                                            isRenewing = state.renewingOrderId == order.id,
                                            isContacted = state.contactedOrderIds.contains(order.id) || isAlertContactedFromServer(order),
                                            onClick = { onOrderClick(order.id) },
                                            onRenewClick = {
                                                viewModel.renewOrder(order) { err ->
                                                    coroutineScope.launch {
                                                        snackbarHostState.showSnackbar("Renewal failed: $err")
                                                    }
                                                }
                                            },
                                            onWhatsAppClick = {
                                                if (order.customerWhatsapp.isNullOrBlank()) {
                                                    phonePromptOrder = order to "order_expiring"
                                                } else {
                                                    viewModel.sendWhatsAppAlert(context, order, "order_expiring") { err ->
                                                        coroutineScope.launch {
                                                            snackbarHostState.showSnackbar(err)
                                                        }
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
                                    contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 16.dp, bottom = 80.dp),
                                    verticalArrangement = Arrangement.spacedBy(10.dp)
                                ) {
                                    items(state.expiredOrders, key = { it.id }) { order ->
                                        AlertOrderCard(
                                            order = order,
                                            viewModel = viewModel,
                                            isExpired = true,
                                            isRenewing = state.renewingOrderId == order.id,
                                            isContacted = state.contactedOrderIds.contains(order.id) || isAlertContactedFromServer(order),
                                            onClick = { onOrderClick(order.id) },
                                            onRenewClick = {
                                                viewModel.renewOrder(order) { err ->
                                                    coroutineScope.launch {
                                                        snackbarHostState.showSnackbar("Reactivation failed: $err")
                                                    }
                                                }
                                            },
                                            onWhatsAppClick = {
                                                if (order.customerWhatsapp.isNullOrBlank()) {
                                                    phonePromptOrder = order to "order_expired"
                                                } else {
                                                    viewModel.sendWhatsAppAlert(context, order, "order_expired") { err ->
                                                        coroutineScope.launch {
                                                            snackbarHostState.showSnackbar(err)
                                                        }
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

    templateToDelete?.let { tmpl ->
        val tmplId = tmpl.id
        ConfirmDeleteDialog(
            title = "Delete WhatsApp Template",
            message = "Are you sure you want to delete template \"${tmpl.finalName}\"? This action cannot be undone.",
            onDismiss = { templateToDelete = null },
            onConfirm = {
                if (tmplId == null) {
                    templateToDelete = null
                    return@ConfirmDeleteDialog
                }
                viewModel.deleteTemplate(
                    id = tmplId,
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

    // Missing Phone Number Prompt Dialog
    phonePromptOrder?.let { (order, eventType) ->
        PhonePromptDialog(
            order = order,
            eventType = eventType,
            onDismiss = { phonePromptOrder = null },
            onSubmit = { phone, savePhone ->
                viewModel.sendWhatsAppAlert(
                    context = context,
                    order = order,
                    eventType = eventType,
                    customPhone = phone,
                    savePhone = savePhone,
                    onSuccess = {
                        phonePromptOrder = null
                        coroutineScope.launch {
                            snackbarHostState.showSnackbar("WhatsApp opened for ${order.customerName ?: order.orderNumber}")
                        }
                    },
                    onError = { err ->
                        coroutineScope.launch {
                            snackbarHostState.showSnackbar("Failed to prepare WhatsApp: $err")
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
    onEditClick: (WhatsAppTemplateDto) -> Unit,
    onDeleteClick: (WhatsAppTemplateDto) -> Unit,
    onRefreshClick: () -> Unit
) {
    var selectedCategory by remember { mutableStateOf("all") }
    val filteredTemplates = remember(templates, selectedCategory) {
        if (selectedCategory == "all") templates else templates.filter { it.finalEventType == selectedCategory }
    }

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
            IconButton(onClick = onRefreshClick, modifier = Modifier.size(32.dp)) {
                Icon(Icons.Default.Refresh, contentDescription = "Refresh", tint = PrimaryBlue, modifier = Modifier.size(18.dp))
            }
        }

        Spacer(modifier = Modifier.height(10.dp))

        // Category Filter Chips
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            val categories = listOf(
                "all" to "All (${templates.size})",
                "order_created" to "Delivery (${templates.count { it.finalEventType == "order_created" }})",
                "order_expiring" to "Expiring (${templates.count { it.finalEventType == "order_expiring" }})",
                "order_expired" to "Expired (${templates.count { it.finalEventType == "order_expired" }})"
            )
            categories.forEach { (catId, catLabel) ->
                val isSelected = selectedCategory == catId
                Surface(
                    shape = RoundedCornerShape(20.dp),
                    color = if (isSelected) PrimaryBlue else Color.White,
                    border = BorderStroke(1.dp, if (isSelected) PrimaryBlue else Slate200),
                    modifier = Modifier.clickable { selectedCategory = catId }
                ) {
                    Text(
                        text = catLabel,
                        fontSize = 11.sp,
                        fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                        color = if (isSelected) Color.White else Slate700,
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        if (filteredTemplates.isEmpty()) {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White)
            ) {
                Column(
                    modifier = Modifier.padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text("No templates found in this category", color = Slate600, fontSize = 14.sp)
                    Spacer(modifier = Modifier.height(10.dp))
                    OutlinedButton(onClick = onRefreshClick) {
                        Text("Reload Templates")
                    }
                }
            }
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                items(filteredTemplates, key = { it.finalId }) { tmpl ->
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
    val clipboardManager = androidx.compose.ui.platform.LocalClipboardManager.current
    var copied by remember { mutableStateOf(false) }

    LaunchedEffect(copied) {
        if (copied) {
            kotlinx.coroutines.delay(2000)
            copied = false
        }
    }

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
                    text = template.finalName,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    color = Slate900,
                    modifier = Modifier.weight(1f)
                )

                Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    IconButton(
                        onClick = {
                            clipboardManager.setText(androidx.compose.ui.text.AnnotatedString(template.finalContent))
                            copied = true
                        },
                        modifier = Modifier.size(32.dp)
                    ) {
                        Icon(
                            if (copied) Icons.Default.Check else Icons.Default.Share,
                            contentDescription = if (copied) "Copied" else "Copy Text",
                            tint = if (copied) StatusSuccess else Slate600,
                            modifier = Modifier.size(16.dp)
                        )
                    }
                    IconButton(onClick = onEdit, modifier = Modifier.size(32.dp)) {
                        Icon(Icons.Default.Edit, contentDescription = "Edit", tint = Slate600, modifier = Modifier.size(16.dp))
                    }
                    if (template.id != null && !template.id.startsWith("tmpl-")) {
                        IconButton(onClick = onDelete, modifier = Modifier.size(32.dp)) {
                            Icon(Icons.Default.Delete, contentDescription = "Delete", tint = StatusDanger, modifier = Modifier.size(16.dp))
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(6.dp))

            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                val (catColor, catLabel) = when (template.finalEventType) {
                    "order_created" -> StatusSuccess to "ORDER DELIVERY"
                    "order_expiring" -> Color(0xFFD97706) to "RENEWAL REMINDER"
                    "order_expired" -> StatusDanger to "EXPIRED"
                    else -> Slate600 to template.finalEventType.uppercase()
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
                        text = template.finalLanguage.uppercase(),
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        color = PrimaryBlue,
                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = template.finalContent,
                fontSize = 12.sp,
                color = Slate700,
                maxLines = 4,
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
    var name by remember { mutableStateOf(template?.finalName ?: "") }
    var eventType by remember { mutableStateOf(template?.finalEventType ?: "order_expiring") }
    var language by remember { mutableStateOf(template?.finalLanguage ?: "en") }
    var content by remember { mutableStateOf(template?.finalContent ?: "") }
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
                            .menuAnchor(MenuAnchorType.PrimaryNotEditable),
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
                            .menuAnchor(MenuAnchorType.PrimaryNotEditable),
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
                    VectisPillButton(
                        text = if (template != null) "Update Template" else "Save Template",
                        icon = Icons.Default.Check,
                        onClick = {
                            if (content.isBlank()) {
                                errorMsg = "Template content cannot be empty"
                                return@VectisPillButton
                            }
                            onSubmit(
                                UpsertTemplateRequest(
                                    id = if (template?.id != null && !template.id.startsWith("tmpl-")) template.id else null,
                                    name = name.ifBlank { "${eventType} (${language.uppercase()})" },
                                    eventType = eventType,
                                    language = language,
                                    content = content.trim()
                                )
                            )
                        }
                    )
                }
            }
        }
    }
}

@Composable
private fun RenewalFeedbackCard(
    feedback: RenewalFeedback,
    onDismiss: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp),
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xFFEFF6FF)),
        border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFBFDBFE))
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(14.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Row(
                modifier = Modifier.weight(1f),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Box(
                    modifier = Modifier
                        .size(36.dp)
                        .clip(RoundedCornerShape(10.dp))
                        .background(PrimaryBlue),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.Default.Refresh, contentDescription = null, tint = Color.White, modifier = Modifier.size(20.dp))
                }
                Column {
                    Text(
                        text = "Order #${feedback.orderNumber} successfully renewed!",
                        fontWeight = FontWeight.Bold,
                        fontSize = 13.sp,
                        color = Color(0xFF1E3A8A)
                    )
                    Text(
                        text = "New duration: ${feedback.startDate} → ${feedback.newEndDate} (+${feedback.duration} ${feedback.durationUnit})",
                        fontSize = 11.sp,
                        color = Color(0xFF1D4ED8)
                    )
                }
            }
            IconButton(onClick = onDismiss, modifier = Modifier.size(28.dp)) {
                Icon(Icons.Default.Close, contentDescription = "Dismiss", tint = Color(0xFF1D4ED8), modifier = Modifier.size(16.dp))
            }
        }
    }
}

@Composable
private fun PhonePromptDialog(
    order: AlertOrderDto,
    eventType: String,
    onDismiss: () -> Unit,
    onSubmit: (phone: String, savePhone: Boolean) -> Unit
) {
    var phoneInput by remember { mutableStateOf("") }
    var savePhone by remember { mutableStateOf(true) }

    Dialog(onDismissRequest = onDismiss) {
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            shape = RoundedCornerShape(20.dp),
            colors = CardDefaults.cardColors(containerColor = Color.White)
        ) {
            Column(
                modifier = Modifier.padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Customer Phone Required",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                        color = Slate900
                    )
                    IconButton(onClick = onDismiss, modifier = Modifier.size(28.dp)) {
                        Icon(Icons.Default.Close, contentDescription = "Close", tint = Slate500)
                    }
                }

                Text(
                    text = "Customer ${order.customerName ?: "for Order #${order.orderNumber}"} does not have a WhatsApp phone number registered. Enter it below to launch WhatsApp.",
                    fontSize = 13.sp,
                    color = Slate600
                )

                OutlinedTextField(
                    value = phoneInput,
                    onValueChange = { phoneInput = it },
                    label = { Text("WhatsApp Phone (e.g. +123456789)") },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(10.dp),
                    singleLine = true
                )

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.clickable { savePhone = !savePhone }
                ) {
                    Checkbox(checked = savePhone, onCheckedChange = { savePhone = it })
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = "Save number to customer profile",
                        fontSize = 12.sp,
                        color = Slate700
                    )
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    TextButton(onClick = onDismiss) {
                        Text("Cancel", color = Slate600)
                    }
                    Spacer(modifier = Modifier.width(8.dp))
                    Button(
                        onClick = {
                            if (phoneInput.isNotBlank()) {
                                onSubmit(phoneInput.trim(), savePhone)
                            }
                        },
                        enabled = phoneInput.isNotBlank(),
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF25D366), contentColor = Color.White),
                        shape = RoundedCornerShape(10.dp)
                    ) {
                        Icon(Icons.AutoMirrored.Filled.Send, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Send WhatsApp", fontWeight = FontWeight.SemiBold)
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
    isRenewing: Boolean,
    isContacted: Boolean,
    onClick: () -> Unit,
    onRenewClick: () -> Unit,
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

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    if (isContacted) {
                        Surface(
                            color = Color(0xFFECFDF5),
                            border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFA7F3D0)),
                            shape = RoundedCornerShape(6.dp)
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(3.dp)
                            ) {
                                Icon(
                                    Icons.Default.CheckCircle,
                                    contentDescription = null,
                                    tint = Color(0xFF059669),
                                    modifier = Modifier.size(12.dp)
                                )
                                Text(
                                    text = "Contacted",
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = Color(0xFF047857)
                                )
                            }
                        }
                    }

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

                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Button(
                        onClick = onRenewClick,
                        enabled = !isRenewing,
                        shape = RoundedCornerShape(8.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = PrimaryBlue, contentColor = Color.White),
                        contentPadding = PaddingValues(horizontal = 10.dp, vertical = 6.dp)
                    ) {
                        if (isRenewing) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(14.dp),
                                color = Color.White,
                                strokeWidth = 2.dp
                            )
                        } else {
                            Icon(
                                Icons.Default.Refresh,
                                contentDescription = null,
                                tint = Color.White,
                                modifier = Modifier.size(14.dp)
                            )
                        }
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = if (isRenewing) (if (isExpired) "Reactivating..." else "Renewing...") else (if (isExpired) "Reactivate" else "Renew"),
                            color = Color.White,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                    }

                    Button(
                        onClick = onWhatsAppClick,
                        shape = RoundedCornerShape(8.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF25D366), contentColor = Color.White),
                        contentPadding = PaddingValues(horizontal = 10.dp, vertical = 6.dp)
                    ) {
                        Icon(
                            Icons.Default.Share,
                            contentDescription = "Send WhatsApp",
                            tint = Color.White,
                            modifier = Modifier.size(14.dp)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = if (isExpired) "Send Alert" else "Reminder",
                            color = Color.White,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                    }
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
            contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 16.dp, bottom = 80.dp),
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
