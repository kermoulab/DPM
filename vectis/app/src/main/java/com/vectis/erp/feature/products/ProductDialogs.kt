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
                    VectisPillButton(
                        text = if (initialProduct == null) "Create Product" else "Save Changes",
                        icon = if (initialProduct == null) Icons.Default.Add else Icons.Default.Check,
                        onClick = {
                            if (name.isBlank()) {
                                validationError = "Product name is required"
                                return@VectisPillButton
                            }
                            if (selectedCategoryId.isBlank()) {
                                validationError = "Please select a category"
                                return@VectisPillButton
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
                        }
                    )
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
                    VectisPillButton(
                        text = "Add Plan",
                        icon = Icons.Default.Add,
                        onClick = {
                            if (name.isBlank()) {
                                validationError = "Plan name is required"
                                return@VectisPillButton
                            }
                            val dur = durationText.toIntOrNull()
                            if (dur == null || dur <= 0) {
                                validationError = "Valid duration required"
                                return@VectisPillButton
                            }
                            val pr = priceText.toDoubleOrNull()
                            if (pr == null || pr < 0) {
                                validationError = "Valid retail price required"
                                return@VectisPillButton
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
                        }
                    )
                }
            }
        }
    }
}

@Composable
fun CategoryManagerDialog(
    categories: List<CategoryDto>,
    onDismiss: () -> Unit,
    onCreateCategory: (CreateCategoryRequest) -> Unit,
    onUpdateCategory: (String, UpdateCategoryRequest) -> Unit = { _, _ -> },
    onDeleteCategory: (CategoryDto) -> Unit = {}
) {
    var newCatName by remember { mutableStateOf("") }
    var newCatDesc by remember { mutableStateOf("") }
    var validationError by remember { mutableStateOf<String?>(null) }

    var editingCategoryId by remember { mutableStateOf<String?>(null) }
    var editCatName by remember { mutableStateOf("") }
    var editCatDesc by remember { mutableStateOf("") }
    var categoryToDelete by remember { mutableStateOf<CategoryDto?>(null) }

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
                    Column(modifier = Modifier.weight(1f)) {
                        Text("Manage Categories", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = Slate900)
                        Text("Create, edit, or delete catalog categories", fontSize = 12.sp, color = Slate500)
                    }
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
                        border = androidx.compose.foundation.BorderStroke(1.dp, Slate200),
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 4.dp)
                    ) {
                        if (editingCategoryId == cat.id) {
                            Column(modifier = Modifier.padding(12.dp)) {
                                Text("Edit Category", fontWeight = FontWeight.Bold, fontSize = 13.sp, color = Slate900)
                                Spacer(modifier = Modifier.height(6.dp))
                                OutlinedTextField(
                                    value = editCatName,
                                    onValueChange = { editCatName = it },
                                    label = { Text("Name") },
                                    singleLine = true,
                                    modifier = Modifier.fillMaxWidth()
                                )
                                Spacer(modifier = Modifier.height(6.dp))
                                OutlinedTextField(
                                    value = editCatDesc,
                                    onValueChange = { editCatDesc = it },
                                    label = { Text("Description") },
                                    singleLine = true,
                                    modifier = Modifier.fillMaxWidth()
                                )
                                Spacer(modifier = Modifier.height(8.dp))
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.End,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    TextButton(onClick = { editingCategoryId = null }) {
                                        Text("Cancel", color = Slate600)
                                    }
                                    Spacer(modifier = Modifier.width(8.dp))
                                    VectisPillButton(
                                        text = "Save",
                                        icon = Icons.Default.Check,
                                        onClick = {
                                            if (editCatName.isNotBlank()) {
                                                onUpdateCategory(
                                                    cat.id,
                                                    UpdateCategoryRequest(
                                                        name = editCatName.trim(),
                                                        description = editCatDesc.trim().ifEmpty { null }
                                                    )
                                                )
                                                editingCategoryId = null
                                            }
                                        }
                                    )
                                }
                            }
                        } else {
                            Row(
                                modifier = Modifier.padding(10.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Icon(Icons.Default.Folder, contentDescription = null, tint = PrimaryBlue, modifier = Modifier.size(20.dp))
                                Spacer(modifier = Modifier.width(10.dp))
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(cat.name, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = Slate800)
                                    if (!cat.description.isNullOrBlank()) {
                                        Text(cat.description, fontSize = 11.sp, color = Slate500)
                                    }
                                }
                                Row {
                                    IconButton(
                                        onClick = {
                                            editingCategoryId = cat.id
                                            editCatName = cat.name
                                            editCatDesc = cat.description ?: ""
                                        },
                                        modifier = Modifier.size(30.dp)
                                    ) {
                                        Icon(Icons.Default.Edit, contentDescription = "Edit Category", tint = PrimaryBlue, modifier = Modifier.size(16.dp))
                                    }
                                    IconButton(
                                        onClick = { categoryToDelete = cat },
                                        modifier = Modifier.size(30.dp)
                                    ) {
                                        Icon(Icons.Default.Delete, contentDescription = "Delete Category", tint = StatusDanger, modifier = Modifier.size(16.dp))
                                    }
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
                VectisPillButton(
                    text = "Create Category",
                    icon = Icons.Default.Add,
                    onClick = {
                        if (newCatName.isBlank()) {
                            validationError = "Category name is required"
                            return@VectisPillButton
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
                    modifier = Modifier.fillMaxWidth()
                )
            }
        }
    }

    categoryToDelete?.let { cat ->
        ConfirmDeleteDialog(
            title = "Delete Category",
            message = "Are you sure you want to delete category \"${cat.name}\"? Products currently assigned to this category will not be deleted.",
            onDismiss = { categoryToDelete = null },
            onConfirm = {
                val target = cat
                categoryToDelete = null
                onDeleteCategory(target)
            }
        )
    }
}

@Composable
fun ManagePlansDialog(
    product: ProductDto,
    plans: List<PlanDto>,
    formatCurrency: (Double) -> String,
    onDismiss: () -> Unit,
    onAddPlan: () -> Unit,
    onUpdatePlan: (String, UpdatePlanRequest) -> Unit,
    onDeletePlan: (PlanDto) -> Unit
) {
    var editingPlanId by remember { mutableStateOf<String?>(null) }
    var editName by remember { mutableStateOf("") }
    var editDuration by remember { mutableStateOf("") }
    var editDurationUnit by remember { mutableStateOf("months") }
    var editPrice by remember { mutableStateOf("") }
    var editCost by remember { mutableStateOf("") }
    var planToDelete by remember { mutableStateOf<PlanDto?>(null) }

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
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = "Manage Plans",
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold,
                            color = Slate900
                        )
                        Text(
                            text = product.name,
                            fontSize = 13.sp,
                            color = Slate500,
                            maxLines = 1
                        )
                    }
                    IconButton(onClick = onDismiss) {
                        Icon(Icons.Default.Close, contentDescription = "Close", tint = Slate500)
                    }
                }

                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "Manage duration, retail pricing, and supplier costs.",
                    fontSize = 12.sp,
                    color = Slate600
                )
                Spacer(modifier = Modifier.height(12.dp))

                if (plans.isEmpty()) {
                    Text(
                        text = "No plans configured for this product yet.",
                        fontSize = 13.sp,
                        color = Slate400,
                        modifier = Modifier.padding(vertical = 16.dp)
                    )
                } else {
                    plans.forEach { plan ->
                        Surface(
                            color = Slate50,
                            shape = RoundedCornerShape(10.dp),
                            border = androidx.compose.foundation.BorderStroke(1.dp, Slate200),
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 4.dp)
                        ) {
                            if (editingPlanId == plan.id) {
                                Column(modifier = Modifier.padding(12.dp)) {
                                    Text("Edit Plan", fontWeight = FontWeight.Bold, fontSize = 13.sp, color = Slate900)
                                    Spacer(modifier = Modifier.height(6.dp))
                                    OutlinedTextField(
                                        value = editName,
                                        onValueChange = { editName = it },
                                        label = { Text("Plan Name") },
                                        singleLine = true,
                                        modifier = Modifier.fillMaxWidth()
                                    )
                                    Spacer(modifier = Modifier.height(6.dp))
                                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                        OutlinedTextField(
                                            value = editDuration,
                                            onValueChange = { editDuration = it.filter { c -> c.isDigit() } },
                                            label = { Text("Duration") },
                                            singleLine = true,
                                            modifier = Modifier.weight(1f)
                                        )
                                        OutlinedTextField(
                                            value = editDurationUnit,
                                            onValueChange = { editDurationUnit = it },
                                            label = { Text("Unit") },
                                            singleLine = true,
                                            modifier = Modifier.weight(1f)
                                        )
                                    }
                                    Spacer(modifier = Modifier.height(6.dp))
                                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                        OutlinedTextField(
                                            value = editPrice,
                                            onValueChange = { editPrice = it },
                                            label = { Text("Retail Price") },
                                            singleLine = true,
                                            modifier = Modifier.weight(1f)
                                        )
                                        OutlinedTextField(
                                            value = editCost,
                                            onValueChange = { editCost = it },
                                            label = { Text("Supplier Cost") },
                                            singleLine = true,
                                            modifier = Modifier.weight(1f)
                                        )
                                    }
                                    Spacer(modifier = Modifier.height(10.dp))
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.End,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        TextButton(onClick = { editingPlanId = null }) {
                                            Text("Cancel", color = Slate600)
                                        }
                                        Spacer(modifier = Modifier.width(8.dp))
                                        VectisPillButton(
                                            text = "Save Changes",
                                            icon = Icons.Default.Check,
                                            onClick = {
                                                val pPrice = editPrice.toDoubleOrNull() ?: plan.price
                                                val pCost = editCost.toDoubleOrNull() ?: plan.cost
                                                val pDur = editDuration.toIntOrNull() ?: plan.duration
                                                onUpdatePlan(
                                                    plan.id,
                                                    UpdatePlanRequest(
                                                        name = editName.trim().ifEmpty { plan.name },
                                                        duration = pDur,
                                                        durationUnit = editDurationUnit.trim().ifEmpty { plan.durationUnit },
                                                        price = pPrice,
                                                        cost = pCost
                                                    )
                                                )
                                                editingPlanId = null
                                            }
                                        )
                                    }
                                }
                            } else {
                                Column(modifier = Modifier.padding(12.dp)) {
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Column(modifier = Modifier.weight(1f)) {
                                            Text(
                                                text = plan.name,
                                                fontSize = 14.sp,
                                                fontWeight = FontWeight.Bold,
                                                color = Slate900
                                            )
                                            Text(
                                                text = "Duration: ${plan.duration} ${plan.durationUnit}",
                                                fontSize = 12.sp,
                                                color = Slate500
                                            )
                                        }
                                        Row {
                                            IconButton(
                                                onClick = {
                                                    editingPlanId = plan.id
                                                    editName = plan.name
                                                    editDuration = plan.duration.toString()
                                                    editDurationUnit = plan.durationUnit
                                                    editPrice = plan.price.toString()
                                                    editCost = plan.cost.toString()
                                                },
                                                modifier = Modifier.size(32.dp)
                                            ) {
                                                Icon(
                                                    Icons.Default.Edit,
                                                    contentDescription = "Edit Plan",
                                                    tint = PrimaryBlue,
                                                    modifier = Modifier.size(16.dp)
                                                )
                                            }
                                            IconButton(
                                                onClick = { planToDelete = plan },
                                                modifier = Modifier.size(32.dp)
                                            ) {
                                                Icon(
                                                    Icons.Default.Delete,
                                                    contentDescription = "Delete Plan",
                                                    tint = StatusDanger,
                                                    modifier = Modifier.size(16.dp)
                                                )
                                            }
                                        }
                                    }
                                    Spacer(modifier = Modifier.height(8.dp))
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween
                                    ) {
                                        Column {
                                            Text("Retail Price", fontSize = 10.sp, color = Slate400)
                                            Text(
                                                formatCurrency(plan.price),
                                                fontSize = 13.sp,
                                                fontWeight = FontWeight.Bold,
                                                color = PrimaryBlue
                                            )
                                        }
                                        Column {
                                            Text("Supplier Cost", fontSize = 10.sp, color = Slate400)
                                            Text(
                                                formatCurrency(plan.cost),
                                                fontSize = 13.sp,
                                                fontWeight = FontWeight.SemiBold,
                                                color = Slate700
                                            )
                                        }
                                        Column {
                                            Text("Margin", fontSize = 10.sp, color = Slate400)
                                            val margin = plan.price - plan.cost
                                            Text(
                                                formatCurrency(margin),
                                                fontSize = 13.sp,
                                                fontWeight = FontWeight.Bold,
                                                color = if (margin >= 0) StatusSuccess else StatusDanger
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))
                VectisPillButton(
                    text = "Add New Plan",
                    icon = Icons.Default.Add,
                    onClick = onAddPlan,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        }
    }

    planToDelete?.let { plan ->
        ConfirmDeleteDialog(
            title = "Delete Plan",
            message = "Are you sure you want to delete the plan \"${plan.name}\"? Active subscriptions on this plan will not be automatically deleted.",
            onDismiss = { planToDelete = null },
            onConfirm = {
                val target = plan
                planToDelete = null
                onDeletePlan(target)
            }
        )
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
        containerColor = Color.White,
        title = { Text(title, fontWeight = FontWeight.Bold, color = Slate900) },
        text = { Text(message, color = Slate700, fontSize = 14.sp) },
        confirmButton = {
            VectisPillButton(
                text = "Delete",
                icon = Icons.Default.Delete,
                containerColor = StatusDanger,
                onClick = onConfirm
            )
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel", color = Slate500)
            }
        }
    )
}
