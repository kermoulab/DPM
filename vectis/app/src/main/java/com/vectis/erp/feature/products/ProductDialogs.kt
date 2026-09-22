package com.vectis.erp.feature.products

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.vectis.erp.core.design.*
import com.vectis.erp.data.model.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProductFormDialog(
    initialProduct: ProductDto? = null,
    categories: List<CategoryDto>,
    onDismiss: () -> Unit,
    onSaveProduct: (CreateProductRequest) -> Unit,
    onUpdateProduct: (String, UpdateProductRequest) -> Unit
) {
    var name by remember { mutableStateOf(initialProduct?.name ?: "") }
    var brand by remember { mutableStateOf(initialProduct?.brand ?: "") }
    var description by remember { mutableStateOf(initialProduct?.description ?: "") }
    var selectedCategoryId by remember {
        mutableStateOf(
            initialProduct?.categoryId
                ?: categories.firstOrNull()?.id
                ?: ""
        )
    }
    var fulfillmentType by remember { mutableStateOf(initialProduct?.fulfillmentType ?: "automatic") }
    var status by remember { mutableStateOf(initialProduct?.status ?: "active") }

    // Capabilities
    var isSubscription by remember {
        mutableStateOf(initialProduct?.isSubscription ?: true)
    }
    var isServiceAccount by remember {
        mutableStateOf(initialProduct?.isServiceAccount ?: false)
    }
    var isLicenseKey by remember {
        mutableStateOf(initialProduct?.isLicenseKey ?: false)
    }
    var isDigitalFile by remember {
        mutableStateOf(initialProduct?.isDigitalFile ?: false)
    }

    var categoryDropdownExpanded by remember { mutableStateOf(false) }
    var fulfillmentDropdownExpanded by remember { mutableStateOf(false) }
    var statusDropdownExpanded by remember { mutableStateOf(false) }
    var validationError by remember { mutableStateOf<String?>(null) }

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
                    text = if (initialProduct == null) "New Product" else "Edit Product",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    color = Slate900
                )
                Spacer(modifier = Modifier.height(16.dp))

                // Name
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it; validationError = null },
                    label = { Text("Product Name *") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(10.dp)
                )
                Spacer(modifier = Modifier.height(10.dp))

                // Brand
                OutlinedTextField(
                    value = brand,
                    onValueChange = { brand = it },
                    label = { Text("Brand / Vendor (Optional)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(10.dp)
                )
                Spacer(modifier = Modifier.height(10.dp))

                // Category Selector
                ExposedDropdownMenuBox(
                    expanded = categoryDropdownExpanded,
                    onExpandedChange = { categoryDropdownExpanded = it }
                ) {
                    val currentCatName = categories.find { it.id == selectedCategoryId }?.name ?: "Select Category"
                    OutlinedTextField(
                        value = currentCatName,
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("Category *") },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = categoryDropdownExpanded) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .menuAnchor(),
                        shape = RoundedCornerShape(10.dp)
                    )
                    ExposedDropdownMenu(
                        expanded = categoryDropdownExpanded,
                        onDismissRequest = { categoryDropdownExpanded = false }
                    ) {
                        categories.forEach { cat ->
                            DropdownMenuItem(
                                text = { Text(cat.name) },
                                onClick = {
                                    selectedCategoryId = cat.id
                                    categoryDropdownExpanded = false
                                }
                            )
                        }
                    }
                }
                Spacer(modifier = Modifier.height(10.dp))

                // Description
                OutlinedTextField(
                    value = description,
                    onValueChange = { description = it },
                    label = { Text("Description") },
                    maxLines = 3,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(10.dp)
                )
                Spacer(modifier = Modifier.height(10.dp))

                // Fulfillment Type
                ExposedDropdownMenuBox(
                    expanded = fulfillmentDropdownExpanded,
                    onExpandedChange = { fulfillmentDropdownExpanded = it }
                ) {
                    OutlinedTextField(
                        value = if (fulfillmentType == "automatic") "Automatic Fulfillment" else "Manual Fulfillment",
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("Fulfillment Mode") },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = fulfillmentDropdownExpanded) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .menuAnchor(),
                        shape = RoundedCornerShape(10.dp)
                    )
                    ExposedDropdownMenu(
                        expanded = fulfillmentDropdownExpanded,
                        onDismissRequest = { fulfillmentDropdownExpanded = false }
                    ) {
                        DropdownMenuItem(
                            text = { Text("Automatic Fulfillment") },
                            onClick = {
                                fulfillmentType = "automatic"
                                fulfillmentDropdownExpanded = false
                            }
                        )
                        DropdownMenuItem(
                            text = { Text("Manual Fulfillment") },
                            onClick = {
                                fulfillmentType = "manual"
                                fulfillmentDropdownExpanded = false
                            }
                        )
                    }
                }
                Spacer(modifier = Modifier.height(10.dp))

                // Status dropdown if editing
                if (initialProduct != null) {
                    ExposedDropdownMenuBox(
                        expanded = statusDropdownExpanded,
                        onExpandedChange = { statusDropdownExpanded = it }
                    ) {
                        OutlinedTextField(
                            value = if (status == "active") "Active" else "Inactive",
                            onValueChange = {},
                            readOnly = true,
                            label = { Text("Status") },
                            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = statusDropdownExpanded) },
                            modifier = Modifier
                                .fillMaxWidth()
                                .menuAnchor(),
                            shape = RoundedCornerShape(10.dp)
                        )
                        ExposedDropdownMenu(
                            expanded = statusDropdownExpanded,
                            onDismissRequest = { statusDropdownExpanded = false }
                        ) {
                            DropdownMenuItem(
                                text = { Text("Active") },
                                onClick = {
                                    status = "active"
                                    statusDropdownExpanded = false
                                }
                            )
                            DropdownMenuItem(
                                text = { Text("Inactive") },
                                onClick = {
                                    status = "inactive"
                                    statusDropdownExpanded = false
                                }
                            )
                        }
                    }
                    Spacer(modifier = Modifier.height(10.dp))
                }

                // Capabilities Checklist
                Text("Product Capabilities", fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = Slate700)
                Spacer(modifier = Modifier.height(4.dp))

                Row(verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(checked = isSubscription, onCheckedChange = { isSubscription = it })
                    Text("Subscription Tier", fontSize = 13.sp, color = Slate700)
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(checked = isServiceAccount, onCheckedChange = { isServiceAccount = it })
                    Text("Service Account / Profiles", fontSize = 13.sp, color = Slate700)
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(checked = isLicenseKey, onCheckedChange = { isLicenseKey = it })
                    Text("License Key Pool", fontSize = 13.sp, color = Slate700)
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(checked = isDigitalFile, onCheckedChange = { isDigitalFile = it })
                    Text("Digital File Download", fontSize = 13.sp, color = Slate700)
                }

                if (validationError != null) {
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(validationError!!, color = StatusDanger, fontSize = 12.sp)
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
                            if (name.isBlank()) {
                                validationError = "Product name is required"
                                return@Button
                            }
                            if (selectedCategoryId.isBlank()) {
                                validationError = "Please select a category"
                                return@Button
                            }

                            val caps = mutableListOf<String>()
                            if (isSubscription) caps.add("subscription")
                            if (isServiceAccount) {
                                caps.add("service_account")
                                caps.add("profiles")
                            }
                            if (isLicenseKey) caps.add("license_key")
                            if (isDigitalFile) caps.add("digital_file")

                            if (initialProduct == null) {
                                onSaveProduct(
                                    CreateProductRequest(
                                        categoryId = selectedCategoryId,
                                        name = name.trim(),
                                        brand = brand.trim().ifEmpty { null },
                                        description = description.trim().ifEmpty { null },
                                        capabilities = caps,
                                        fulfillmentType = fulfillmentType
                                    )
                                )
                            } else {
                                onUpdateProduct(
                                    initialProduct.id,
                                    UpdateProductRequest(
                                        categoryId = selectedCategoryId,
                                        name = name.trim(),
                                        brand = brand.trim().ifEmpty { null },
                                        description = description.trim().ifEmpty { null },
                                        capabilities = caps,
                                        fulfillmentType = fulfillmentType,
                                        status = status
                                    )
                                )
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = PrimaryBlue)
                    ) {
                        Text(if (initialProduct == null) "Create Product" else "Save Changes")
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PlanFormDialog(
    product: ProductDto,
    onDismiss: () -> Unit,
    onSavePlan: (CreatePlanRequest) -> Unit
) {
    var name by remember { mutableStateOf("") }
    var durationText by remember { mutableStateOf("1") }
    var durationUnit by remember { mutableStateOf("months") }
    var priceText by remember { mutableStateOf("9.99") }
    var costText by remember { mutableStateOf("3.50") }
    var currency by remember { mutableStateOf("USD") }
    var unitDropdownExpanded by remember { mutableStateOf(false) }
    var validationError by remember { mutableStateOf<String?>(null) }

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
                    text = "Add Plan - ${product.name}",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    color = Slate900
                )
                Spacer(modifier = Modifier.height(16.dp))

                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it; validationError = null },
                    label = { Text("Plan Name * (e.g. 1 Month, Annual)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(10.dp)
                )
                Spacer(modifier = Modifier.height(10.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedTextField(
                        value = durationText,
                        onValueChange = { durationText = it },
                        label = { Text("Duration *") },
                        singleLine = true,
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(10.dp)
                    )

                    ExposedDropdownMenuBox(
                        expanded = unitDropdownExpanded,
                        onExpandedChange = { unitDropdownExpanded = it },
                        modifier = Modifier.weight(1.2f)
                    ) {
                        OutlinedTextField(
                            value = durationUnit.replaceFirstChar { it.uppercase() },
                            onValueChange = {},
                            readOnly = true,
                            label = { Text("Unit") },
                            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = unitDropdownExpanded) },
                            modifier = Modifier
                                .fillMaxWidth()
                                .menuAnchor(),
                            shape = RoundedCornerShape(10.dp)
                        )
                        ExposedDropdownMenu(
                            expanded = unitDropdownExpanded,
                            onDismissRequest = { unitDropdownExpanded = false }
                        ) {
                            DropdownMenuItem(text = { Text("Days") }, onClick = { durationUnit = "days"; unitDropdownExpanded = false })
                            DropdownMenuItem(text = { Text("Months") }, onClick = { durationUnit = "months"; unitDropdownExpanded = false })
                            DropdownMenuItem(text = { Text("Years") }, onClick = { durationUnit = "years"; unitDropdownExpanded = false })
                        }
                    }
                }
                Spacer(modifier = Modifier.height(10.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedTextField(
                        value = priceText,
                        onValueChange = { priceText = it },
                        label = { Text("Retail Price *") },
                        singleLine = true,
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(10.dp)
                    )

                    OutlinedTextField(
                        value = costText,
                        onValueChange = { costText = it },
                        label = { Text("Cost (Optional)") },
                        singleLine = true,
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(10.dp)
                    )
                }

                if (validationError != null) {
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(validationError!!, color = StatusDanger, fontSize = 12.sp)
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
                            if (name.isBlank()) {
                                validationError = "Plan name is required"
                                return@Button
                            }
                            val dur = durationText.toIntOrNull()
                            if (dur == null || dur <= 0) {
                                validationError = "Valid duration required"
                                return@Button
                            }
                            val pr = priceText.toDoubleOrNull()
                            if (pr == null || pr < 0) {
                                validationError = "Valid retail price required"
                                return@Button
                            }
                            val cs = costText.toDoubleOrNull() ?: 0.0

                            onSavePlan(
                                CreatePlanRequest(
                                    productId = product.id,
                                    name = name.trim(),
                                    duration = dur,
                                    durationUnit = durationUnit,
                                    price = pr,
                                    cost = cs,
                                    currency = currency
                                )
                            )
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = PrimaryBlue)
                    ) {
                        Text("Add Plan")
                    }
                }
            }
        }
    }
}

@Composable
fun CategoryManagerDialog(
    categories: List<CategoryDto>,
    onDismiss: () -> Unit,
    onCreateCategory: (CreateCategoryRequest) -> Unit
) {
    var newCatName by remember { mutableStateOf("") }
    var newCatDesc by remember { mutableStateOf("") }
    var validationError by remember { mutableStateOf<String?>(null) }

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
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Product Categories", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = Slate900)
                    IconButton(onClick = onDismiss) {
                        Icon(Icons.Default.Close, contentDescription = "Close", tint = Slate500)
                    }
                }
                Spacer(modifier = Modifier.height(12.dp))

                // List existing categories
                Text("Existing Categories (${categories.size})", fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = Slate400)
                Spacer(modifier = Modifier.height(6.dp))

                categories.forEach { cat ->
                    Surface(
                        color = Slate50,
                        shape = RoundedCornerShape(8.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 4.dp)
                    ) {
                        Row(
                            modifier = Modifier.padding(10.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(Icons.Default.Folder, contentDescription = null, tint = PrimaryBlue, modifier = Modifier.size(18.dp))
                            Spacer(modifier = Modifier.width(10.dp))
                            Column(modifier = Modifier.weight(1f)) {
                                Text(cat.name, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = Slate800)
                                if (!cat.description.isNullOrBlank()) {
                                    Text(cat.description, fontSize = 11.sp, color = Slate500)
                                }
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))
                HorizontalDivider(color = Slate200)
                Spacer(modifier = Modifier.height(12.dp))

                Text("Add New Category", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = Slate900)
                Spacer(modifier = Modifier.height(8.dp))

                OutlinedTextField(
                    value = newCatName,
                    onValueChange = { newCatName = it; validationError = null },
                    label = { Text("Category Name *") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(10.dp)
                )
                Spacer(modifier = Modifier.height(8.dp))

                OutlinedTextField(
                    value = newCatDesc,
                    onValueChange = { newCatDesc = it },
                    label = { Text("Description (Optional)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(10.dp)
                )

                if (validationError != null) {
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(validationError!!, color = StatusDanger, fontSize = 12.sp)
                }

                Spacer(modifier = Modifier.height(12.dp))
                Button(
                    onClick = {
                        if (newCatName.isBlank()) {
                            validationError = "Category name is required"
                            return@Button
                        }
                        onCreateCategory(
                            CreateCategoryRequest(
                                name = newCatName.trim(),
                                description = newCatDesc.trim().ifEmpty { null }
                            )
                        )
                        newCatName = ""
                        newCatDesc = ""
                    },
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(containerColor = PrimaryBlue)
                ) {
                    Icon(Icons.Default.Add, contentDescription = null)
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Create Category")
                }
            }
        }
    }
}

@Composable
fun ConfirmDeleteDialog(
    title: String,
    message: String,
    onDismiss: () -> Unit,
    onConfirm: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title, fontWeight = FontWeight.Bold, color = Slate900) },
        text = { Text(message, color = Slate700, fontSize = 14.sp) },
        confirmButton = {
            Button(
                onClick = onConfirm,
                colors = ButtonDefaults.buttonColors(containerColor = StatusDanger)
            ) {
                Text("Delete")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel", color = Slate500)
            }
        }
    )
}
