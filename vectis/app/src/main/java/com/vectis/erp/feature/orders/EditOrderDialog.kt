package com.vectis.erp.feature.orders

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.vectis.erp.core.design.*
import com.vectis.erp.data.model.*
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EditOrderDialog(
    order: OrderDto,
    viewModel: OrderViewModel,
    onDismiss: () -> Unit,
    onSave: (UpdateOrderRequest) -> Unit
) {
    val coroutineScope = rememberCoroutineScope()

    var customers by remember { mutableStateOf<List<CustomerDto>>(emptyList()) }
    var products by remember { mutableStateOf<List<ProductDto>>(emptyList()) }
    var plans by remember { mutableStateOf<List<PlanDto>>(emptyList()) }
    var isLoadingData by remember { mutableStateOf(true) }

    var selectedCustomer by remember { mutableStateOf<CustomerDto?>(null) }
    var selectedProduct by remember { mutableStateOf<ProductDto?>(null) }
    var selectedPlan by remember { mutableStateOf<PlanDto?>(null) }

    var startDateText by remember { mutableStateOf(order.startDate?.take(10) ?: "") }
    var endDateText by remember { mutableStateOf(order.endDate?.take(10) ?: "") }
    var priceText by remember { mutableStateOf(order.price.toString()) }
    var paymentStatus by remember { mutableStateOf((order.paymentStatus ?: "paid").lowercase()) }
    var paymentMethod by remember { mutableStateOf(order.paymentMethod ?: "cash") }
    var status by remember { mutableStateOf(order.effectiveStatus) }
    var notesText by remember { mutableStateOf(order.notes ?: "") }
    var isSubmitting by remember { mutableStateOf(false) }

    var customerDropdown by remember { mutableStateOf(false) }
    var productDropdown by remember { mutableStateOf(false) }
    var planDropdown by remember { mutableStateOf(false) }
    var paymentMethodDropdown by remember { mutableStateOf(false) }

    // Status options: Active, Expiring, Expired (Cancelled removed)
    val statusOptions = listOf("active", "expiring", "expired")
    // Payment status options: Paid, Pending, Refunded (Failed removed)
    val paymentStatusOptions = listOf("paid", "pending", "refunded")

    // Fetch initial options
    LaunchedEffect(order) {
        isLoadingData = true
        val cList = viewModel.fetchCustomers()
        val pList = viewModel.fetchProducts()
        customers = cList
        products = pList

        selectedCustomer = cList.find { it.id == order.customerId } ?: CustomerDto(
            id = order.customerId,
            name = order.customerName ?: "Customer"
        )

        val matchedProd = pList.find { it.id == order.productId } ?: ProductDto(
            id = order.productId,
            name = order.productName ?: "Product"
        )
        selectedProduct = matchedProd

        val currentProdId = order.productId.ifBlank { matchedProd.id }
        if (currentProdId.isNotBlank()) {
            val plList = viewModel.fetchPlans(currentProdId)
            plans = plList
            selectedPlan = plList.find { it.id == order.planId } ?: plList.firstOrNull() ?: PlanDto(
                id = order.planId,
                productId = currentProdId,
                name = order.planName ?: "Plan",
                duration = order.duration ?: 1,
                durationUnit = order.durationUnit ?: "months"
            )
        }
        isLoadingData = false
    }

    Dialog(onDismissRequest = onDismiss) {
        Card(
            shape = RoundedCornerShape(20.dp),
            colors = CardDefaults.cardColors(containerColor = Color.White),
            modifier = Modifier
                .fillMaxWidth()
                .padding(8.dp)
                .imePadding()
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(20.dp)
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                // Header
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(
                            text = "Edit Order",
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold,
                            color = Slate900
                        )
                        Text(
                            text = order.orderNumber,
                            fontSize = 12.sp,
                            color = PrimaryBlue,
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                    IconButton(onClick = onDismiss, modifier = Modifier.size(28.dp)) {
                        Icon(Icons.Default.Close, contentDescription = "Close", tint = Slate500)
                    }
                }

                HorizontalDivider(color = Slate100)

                if (isLoadingData) {
                    Box(modifier = Modifier.fillMaxWidth().padding(24.dp), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(color = PrimaryBlue, modifier = Modifier.size(28.dp))
                    }
                } else {
                    // 1. Customer Selection Dropdown
                    ExposedDropdownMenuBox(
                        expanded = customerDropdown,
                        onExpandedChange = { customerDropdown = it }
                    ) {
                        OutlinedTextField(
                            value = selectedCustomer?.name ?: order.customerName ?: "Select Customer",
                            onValueChange = {},
                            readOnly = true,
                            label = { Text("Customer") },
                            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = customerDropdown) },
                            modifier = Modifier
                                .fillMaxWidth()
                                .menuAnchor(MenuAnchorType.PrimaryNotEditable),
                            shape = RoundedCornerShape(10.dp)
                        )
                        ExposedDropdownMenu(
                            expanded = customerDropdown,
                            onDismissRequest = { customerDropdown = false }
                        ) {
                            customers.forEach { c ->
                                val detail = if (!c.whatsapp.isNullOrBlank()) " (${c.whatsapp})" else if (!c.email.isNullOrBlank()) " (${c.email})" else ""
                                DropdownMenuItem(
                                    text = { Text("${c.name}$detail") },
                                    onClick = {
                                        selectedCustomer = c
                                        customerDropdown = false
                                    }
                                )
                            }
                        }
                    }

                    // 2. Product Selection Dropdown
                    ExposedDropdownMenuBox(
                        expanded = productDropdown,
                        onExpandedChange = { productDropdown = it }
                    ) {
                        OutlinedTextField(
                            value = selectedProduct?.name ?: order.productName ?: "Select Product",
                            onValueChange = {},
                            readOnly = true,
                            label = { Text("Product") },
                            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = productDropdown) },
                            modifier = Modifier
                                .fillMaxWidth()
                                .menuAnchor(MenuAnchorType.PrimaryNotEditable),
                            shape = RoundedCornerShape(10.dp)
                        )
                        ExposedDropdownMenu(
                            expanded = productDropdown,
                            onDismissRequest = { productDropdown = false }
                        ) {
                            products.forEach { prod ->
                                DropdownMenuItem(
                                    text = { Text(prod.name) },
                                    onClick = {
                                        selectedProduct = prod
                                        productDropdown = false
                                        coroutineScope.launch {
                                            val plList = viewModel.fetchPlans(prod.id)
                                            plans = plList
                                            if (plList.isNotEmpty()) {
                                                val firstPlan = plList.first()
                                                selectedPlan = firstPlan
                                                priceText = firstPlan.price.toString()
                                                if (startDateText.isNotBlank()) {
                                                    val newEnd = viewModel.calculateEndDateLocally(startDateText, firstPlan.duration, firstPlan.durationUnit)
                                                    endDateText = newEnd
                                                    status = viewModel.calculateStatusForEndDate(newEnd)
                                                }
                                            } else {
                                                selectedPlan = null
                                            }
                                        }
                                    }
                                )
                            }
                        }
                    }

                    // 3. Plan Selection Dropdown
                    ExposedDropdownMenuBox(
                        expanded = planDropdown,
                        onExpandedChange = { planDropdown = it }
                    ) {
                        val planLabel = selectedPlan?.let {
                            "${it.name} (${it.price} / ${it.duration} ${it.durationUnit})"
                        } ?: order.planName ?: "Select Plan"

                        OutlinedTextField(
                            value = planLabel,
                            onValueChange = {},
                            readOnly = true,
                            label = { Text("Plan / Term") },
                            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = planDropdown) },
                            modifier = Modifier
                                .fillMaxWidth()
                                .menuAnchor(MenuAnchorType.PrimaryNotEditable),
                            shape = RoundedCornerShape(10.dp)
                        )
                        ExposedDropdownMenu(
                            expanded = planDropdown,
                            onDismissRequest = { planDropdown = false }
                        ) {
                            if (plans.isEmpty()) {
                                DropdownMenuItem(
                                    text = { Text("No plans available for this product") },
                                    onClick = { planDropdown = false }
                                )
                            } else {
                                plans.forEach { pl ->
                                    DropdownMenuItem(
                                        text = { Text("${pl.name} (${pl.price} / ${pl.duration} ${pl.durationUnit})") },
                                        onClick = {
                                            selectedPlan = pl
                                            planDropdown = false
                                            priceText = pl.price.toString()
                                            if (startDateText.isNotBlank()) {
                                                val newEnd = viewModel.calculateEndDateLocally(startDateText, pl.duration, pl.durationUnit)
                                                endDateText = newEnd
                                                status = viewModel.calculateStatusForEndDate(newEnd)
                                            }
                                        }
                                    )
                                }
                            }
                        }
                    }

                    // 4. Start Date & End Date (Auto-calculated depending on plan duration)
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        OutlinedTextField(
                            value = startDateText,
                            onValueChange = { newStart ->
                                startDateText = newStart
                                val dur = selectedPlan?.duration ?: order.duration ?: 1
                                val unit = selectedPlan?.durationUnit ?: order.durationUnit ?: "months"
                                if (newStart.isNotBlank()) {
                                    val newEnd = viewModel.calculateEndDateLocally(newStart, dur, unit)
                                    if (newEnd.isNotBlank()) {
                                        endDateText = newEnd
                                        status = viewModel.calculateStatusForEndDate(newEnd)
                                    }
                                }
                            },
                            label = { Text("Start Date") },
                            placeholder = { Text("YYYY-MM-DD") },
                            modifier = Modifier.weight(1f),
                            singleLine = true
                        )
                        OutlinedTextField(
                            value = endDateText,
                            onValueChange = { newEnd ->
                                endDateText = newEnd
                                if (newEnd.isNotBlank()) {
                                    status = viewModel.calculateStatusForEndDate(newEnd)
                                }
                            },
                            label = { Text("End Date") },
                            placeholder = { Text("YYYY-MM-DD") },
                            modifier = Modifier.weight(1f),
                            singleLine = true
                        )
                    }

                    // 5. Price Charged & Payment Method (Cost input removed)
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        OutlinedTextField(
                            value = priceText,
                            onValueChange = { priceText = it },
                            label = { Text("Price (${order.currency})") },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                            modifier = Modifier.weight(1f),
                            singleLine = true
                        )

                        ExposedDropdownMenuBox(
                            expanded = paymentMethodDropdown,
                            onExpandedChange = { paymentMethodDropdown = it },
                            modifier = Modifier.weight(1f)
                        ) {
                            OutlinedTextField(
                                value = when (paymentMethod) {
                                    "transfer" -> "Transfer"
                                    "card" -> "Card / Stripe"
                                    "crypto" -> "Crypto"
                                    else -> "Cash"
                                },
                                onValueChange = {},
                                readOnly = true,
                                label = { Text("Payment") },
                                trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = paymentMethodDropdown) },
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .menuAnchor(MenuAnchorType.PrimaryNotEditable),
                                shape = RoundedCornerShape(10.dp)
                            )
                            ExposedDropdownMenu(
                                expanded = paymentMethodDropdown,
                                onDismissRequest = { paymentMethodDropdown = false }
                            ) {
                                DropdownMenuItem(text = { Text("Cash") }, onClick = { paymentMethod = "cash"; paymentMethodDropdown = false })
                                DropdownMenuItem(text = { Text("Bank / Transfer") }, onClick = { paymentMethod = "transfer"; paymentMethodDropdown = false })
                                DropdownMenuItem(text = { Text("Card / Stripe") }, onClick = { paymentMethod = "card"; paymentMethodDropdown = false })
                                DropdownMenuItem(text = { Text("Cryptocurrency") }, onClick = { paymentMethod = "crypto"; paymentMethodDropdown = false })
                            }
                        }
                    }

                    // 6. Order Status (Cancelled button removed: only Active, Expiring, Expired)
                    Text(
                        text = "Subscription Status",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = Slate700
                    )
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        statusOptions.forEach { opt ->
                            val isSelected = status == opt
                            val chipBg = if (isSelected) PrimaryBlue else Slate100
                            val chipFg = if (isSelected) Color.White else Slate700
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(chipBg)
                                    .clickable { status = opt }
                                    .padding(horizontal = 12.dp, vertical = 6.dp)
                            ) {
                                Text(
                                    text = opt.replaceFirstChar { it.uppercase() },
                                    fontSize = 12.sp,
                                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                                    color = chipFg
                                )
                            }
                        }
                    }

                    // 7. Payment Status (Failed button removed: only Paid, Pending, Refunded)
                    Text(
                        text = "Payment Status",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = Slate700
                    )
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        paymentStatusOptions.forEach { opt ->
                            val isSelected = paymentStatus == opt
                            val chipBg = if (isSelected) PrimaryBlue else Slate100
                            val chipFg = if (isSelected) Color.White else Slate700
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(chipBg)
                                    .clickable { paymentStatus = opt }
                                    .padding(horizontal = 12.dp, vertical = 6.dp)
                            ) {
                                Text(
                                    text = opt.replaceFirstChar { it.uppercase() },
                                    fontSize = 12.sp,
                                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                                    color = chipFg
                                )
                            }
                        }
                    }

                    // 8. Internal Notes
                    OutlinedTextField(
                        value = notesText,
                        onValueChange = { notesText = it },
                        label = { Text("Internal Notes (optional)") },
                        modifier = Modifier.fillMaxWidth(),
                        maxLines = 3
                    )

                    // Action Buttons
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.End,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        TextButton(onClick = onDismiss) {
                            Text("Cancel", color = Slate600)
                        }
                        Spacer(modifier = Modifier.width(8.dp))
                        VectisPillButton(
                            text = "Save Changes",
                            icon = Icons.Default.Check,
                            isLoading = isSubmitting,
                            onClick = {
                                isSubmitting = true
                                val targetStatus = if (endDateText.isNotBlank()) {
                                    viewModel.calculateStatusForEndDate(endDateText)
                                } else {
                                    status
                                }
                                val req = UpdateOrderRequest(
                                    customerId = selectedCustomer?.id ?: order.customerId,
                                    productId = selectedProduct?.id ?: order.productId,
                                    planId = selectedPlan?.id ?: order.planId,
                                    status = targetStatus,
                                    paymentStatus = paymentStatus,
                                    paymentMethod = paymentMethod,
                                    price = priceText.toDoubleOrNull() ?: order.price,
                                    cost = null, // Cost input removed
                                    startDate = startDateText.ifBlank { null },
                                    endDate = endDateText.ifBlank { null },
                                    notes = notesText.ifBlank { null }
                                )
                                onSave(req)
                            }
                        )
                    }
                }
            }
        }
    }
}
