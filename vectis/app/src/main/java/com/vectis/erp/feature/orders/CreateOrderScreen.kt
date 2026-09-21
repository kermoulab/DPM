package com.vectis.erp.feature.orders

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.vectis.erp.core.design.*
import kotlinx.coroutines.launch

@Suppress("DEPRECATION")
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CreateOrderScreen(
    viewModel: OrderViewModel,
    onNavigateBack: () -> Unit,
    onOrderCreated: (String) -> Unit
) {
    val wizardState by viewModel.wizardState.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }
    val coroutineScope = rememberCoroutineScope()

    LaunchedEffect(Unit) {
        viewModel.initCreateOrderWizard()
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            TopAppBar(
                title = { Text("Create New Order", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = Slate900) },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = Slate700)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Color.White)
            )
        },
        containerColor = Slate50
    ) { paddingValues ->
        if (wizardState.isLoading) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator(color = PrimaryBlue)
            }
        } else {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues)
                    .verticalScroll(rememberScrollState())
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Card 1: Customer Selection
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
                ) {
                    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Text("1. Select Customer *", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = Slate900)

                        var customerExpanded by remember { mutableStateOf(false) }
                        ExposedDropdownMenuBox(
                            expanded = customerExpanded,
                            onExpandedChange = { customerExpanded = it }
                        ) {
                            OutlinedTextField(
                                value = wizardState.selectedCustomer?.name ?: "",
                                onValueChange = {},
                                readOnly = true,
                                label = { Text("Choose Customer") },
                                trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = customerExpanded) },
                                modifier = Modifier
                                    .menuAnchor()
                                    .fillMaxWidth()
                            )
                            ExposedDropdownMenu(
                                expanded = customerExpanded,
                                onDismissRequest = { customerExpanded = false }
                            ) {
                                wizardState.customers.forEach { customer ->
                                    DropdownMenuItem(
                                        text = {
                                            Column {
                                                Text(customer.name, fontWeight = FontWeight.SemiBold)
                                                if (!customer.whatsapp.isNullOrBlank()) {
                                                    Text(customer.whatsapp, fontSize = 11.sp, color = Slate500)
                                                }
                                            }
                                        },
                                        onClick = {
                                            viewModel.selectWizardCustomer(customer)
                                            customerExpanded = false
                                        }
                                    )
                                }
                            }
                        }
                    }
                }

                // Card 2: Product Selection
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
                ) {
                    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Text("2. Select Product *", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = Slate900)

                        var productExpanded by remember { mutableStateOf(false) }
                        ExposedDropdownMenuBox(
                            expanded = productExpanded,
                            onExpandedChange = { productExpanded = it }
                        ) {
                            OutlinedTextField(
                                value = wizardState.selectedProduct?.name ?: "",
                                onValueChange = {},
                                readOnly = true,
                                label = { Text("Choose Product") },
                                trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = productExpanded) },
                                modifier = Modifier
                                    .menuAnchor()
                                    .fillMaxWidth()
                            )
                            ExposedDropdownMenu(
                                expanded = productExpanded,
                                onDismissRequest = { productExpanded = false }
                            ) {
                                wizardState.products.forEach { product ->
                                    DropdownMenuItem(
                                        text = {
                                            Column {
                                                Text(product.name, fontWeight = FontWeight.SemiBold)
                                                Text(
                                                    text = product.capabilities.joinToString(", ") { it.replace('_', ' ') },
                                                    fontSize = 11.sp,
                                                    color = PrimaryBlue
                                                )
                                            }
                                        },
                                        onClick = {
                                            viewModel.selectWizardProduct(product)
                                            productExpanded = false
                                        }
                                    )
                                }
                            }
                        }

                        // Display product capability notice
                        wizardState.selectedProduct?.let { prod ->
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .background(Slate100, RoundedCornerShape(8.dp))
                                    .padding(8.dp)
                            ) {
                                Text(
                                    text = "Fulfillment type: ${prod.fulfillmentType.replaceFirstChar { it.uppercase() }}",
                                    fontSize = 11.sp,
                                    color = Slate600
                                )
                            }
                        }
                    }
                }

                // Card 3: Plan Selection (Dynamic)
                if (wizardState.selectedProduct != null) {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(containerColor = Color.White),
                        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
                    ) {
                        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            Text("3. Select Subscription Plan *", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = Slate900)

                            var planExpanded by remember { mutableStateOf(false) }
                            ExposedDropdownMenuBox(
                                expanded = planExpanded,
                                onExpandedChange = { planExpanded = it }
                            ) {
                                OutlinedTextField(
                                    value = wizardState.selectedPlan?.name ?: "",
                                    onValueChange = {},
                                    readOnly = true,
                                    label = { Text("Choose Plan Tier") },
                                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = planExpanded) },
                                    modifier = Modifier
                                        .menuAnchor()
                                        .fillMaxWidth()
                                )
                                ExposedDropdownMenu(
                                    expanded = planExpanded,
                                    onDismissRequest = { planExpanded = false }
                                ) {
                                    wizardState.plans.forEach { plan ->
                                        DropdownMenuItem(
                                            text = {
                                                Row(
                                                    modifier = Modifier.fillMaxWidth(),
                                                    horizontalArrangement = Arrangement.SpaceBetween
                                                ) {
                                                    Text("${plan.name} (${plan.duration} ${plan.durationUnit})")
                                                    Text(viewModel.formatCurrency(plan.price), fontWeight = FontWeight.Bold)
                                                }
                                            },
                                            onClick = {
                                                viewModel.selectWizardPlan(plan)
                                                planExpanded = false
                                            }
                                        )
                                    }
                                }
                            }
                        }
                    }
                }

                // Card 4: Dates & Pricing
                if (wizardState.selectedPlan != null) {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(containerColor = Color.White),
                        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
                    ) {
                        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                            Text("4. Order Configuration", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = Slate900)

                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(12.dp)
                            ) {
                                OutlinedTextField(
                                    value = wizardState.startDate,
                                    onValueChange = { viewModel.setWizardStartDate(it) },
                                    label = { Text("Start Date") },
                                    modifier = Modifier.weight(1f)
                                )
                                OutlinedTextField(
                                    value = wizardState.endDate,
                                    onValueChange = {},
                                    readOnly = true,
                                    label = { Text("End Date (Auto)") },
                                    modifier = Modifier.weight(1f)
                                )
                            }

                            OutlinedTextField(
                                value = wizardState.customPrice,
                                onValueChange = { viewModel.setWizardCustomPrice(it) },
                                label = { Text("Selling Price (${wizardState.selectedPlan?.currency ?: "MAD"})") },
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                modifier = Modifier.fillMaxWidth()
                            )

                            OutlinedTextField(
                                value = wizardState.notes,
                                onValueChange = { viewModel.setWizardNotes(it) },
                                label = { Text("Order Memo / Notes") },
                                maxLines = 2,
                                modifier = Modifier.fillMaxWidth()
                            )
                        }
                    }
                }

                // Submit Button
                Button(
                    onClick = {
                        viewModel.submitCreateOrder(
                            onSuccess = { newOrderId ->
                                coroutineScope.launch {
                                    snackbarHostState.showSnackbar("Order created successfully!")
                                }
                                onOrderCreated(newOrderId)
                            },
                            onError = { err ->
                                coroutineScope.launch {
                                    snackbarHostState.showSnackbar(err)
                                }
                            }
                        )
                    },
                    enabled = !wizardState.isSubmitting && wizardState.selectedCustomer != null && wizardState.selectedProduct != null && wizardState.selectedPlan != null,
                    colors = ButtonDefaults.buttonColors(containerColor = PrimaryBlue),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(50.dp)
                ) {
                    if (wizardState.isSubmitting) {
                        CircularProgressIndicator(color = Color.White, modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
                    } else {
                        Text("Create Order & Allocate Inventory", fontSize = 15.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}
