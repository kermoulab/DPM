package com.vectis.erp.feature.inventory

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
fun ServiceAccountFormDialog(
    initialAccount: ServiceAccountDto? = null,
    products: List<ProductDto>,
    onDismiss: () -> Unit,
    onSaveAccount: (CreateServiceAccountRequest) -> Unit,
    onUpdateAccount: (String, UpdateServiceAccountRequest) -> Unit
) {
    // Only show products that have service account / profiles capability or allow all products
    val eligibleProducts = remember(products) {
        val filtered = products.filter { it.isServiceAccount }
        if (filtered.isNotEmpty()) filtered else products
    }

    var selectedProductId by remember {
        mutableStateOf(
            initialAccount?.productId
                ?: eligibleProducts.firstOrNull()?.id
                ?: ""
        )
    }
    var provider by remember { mutableStateOf(initialAccount?.provider ?: "") }
    var login by remember { mutableStateOf(initialAccount?.login ?: "") }
    var password by remember { mutableStateOf("") }
    var capacityText by remember { mutableStateOf((initialAccount?.capacity ?: 5).toString()) }
    var expiryDate by remember { mutableStateOf(initialAccount?.expiryDate ?: "") }
    var notes by remember { mutableStateOf(initialAccount?.notes ?: "") }
    var status by remember { mutableStateOf(initialAccount?.status ?: "active") }

    var productDropdownExpanded by remember { mutableStateOf(false) }
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
                    text = if (initialAccount == null) "Add Service Account" else "Edit Service Account",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    color = Slate900
                )
                Spacer(modifier = Modifier.height(16.dp))

                // Product Selector
                ExposedDropdownMenuBox(
                    expanded = productDropdownExpanded,
                    onExpandedChange = { productDropdownExpanded = it }
                ) {
                    val currentProdName = eligibleProducts.find { it.id == selectedProductId }?.name ?: "Select Product"
                    OutlinedTextField(
                        value = currentProdName,
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("Associated Product *") },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = productDropdownExpanded) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .menuAnchor(),
                        shape = RoundedCornerShape(10.dp)
                    )
                    ExposedDropdownMenu(
                        expanded = productDropdownExpanded,
                        onDismissRequest = { productDropdownExpanded = false }
                    ) {
                        eligibleProducts.forEach { prod ->
                            DropdownMenuItem(
                                text = { Text(prod.name) },
                                onClick = {
                                    selectedProductId = prod.id
                                    if (provider.isBlank() && !prod.brand.isNullOrBlank()) {
                                        provider = prod.brand
                                    }
                                    productDropdownExpanded = false
                                }
                            )
                        }
                    }
                }
                Spacer(modifier = Modifier.height(10.dp))

                // Provider
                OutlinedTextField(
                    value = provider,
                    onValueChange = { provider = it },
                    label = { Text("Provider (e.g. Netflix, Spotify) *") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(10.dp)
                )
                Spacer(modifier = Modifier.height(10.dp))

                // Login
                OutlinedTextField(
                    value = login,
                    onValueChange = { login = it; validationError = null },
                    label = { Text("Master Login / Email *") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(10.dp)
                )
                Spacer(modifier = Modifier.height(10.dp))

                // Password
                OutlinedTextField(
                    value = password,
                    onValueChange = { password = it; validationError = null },
                    label = { Text(if (initialAccount == null) "Master Password *" else "New Password (Leave blank to keep)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(10.dp)
                )
                Spacer(modifier = Modifier.height(10.dp))

                // Capacity & Expiry
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedTextField(
                        value = capacityText,
                        onValueChange = { capacityText = it },
                        label = { Text("Profiles Capacity *") },
                        singleLine = true,
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(10.dp)
                    )

                    OutlinedTextField(
                        value = expiryDate,
                        onValueChange = { expiryDate = it },
                        label = { Text("Expiry (YYYY-MM-DD)") },
                        singleLine = true,
                        modifier = Modifier.weight(1.2f),
                        shape = RoundedCornerShape(10.dp)
                    )
                }
                Spacer(modifier = Modifier.height(10.dp))

                // Status if editing
                if (initialAccount != null) {
                    ExposedDropdownMenuBox(
                        expanded = statusDropdownExpanded,
                        onExpandedChange = { statusDropdownExpanded = it }
                    ) {
                        OutlinedTextField(
                            value = status.replaceFirstChar { it.uppercase() },
                            onValueChange = {},
                            readOnly = true,
                            label = { Text("Account Status") },
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
                            listOf("active", "inactive", "exhausted", "suspended").forEach { s ->
                                DropdownMenuItem(
                                    text = { Text(s.replaceFirstChar { it.uppercase() }) },
                                    onClick = {
                                        status = s
                                        statusDropdownExpanded = false
                                    }
                                )
                            }
                        }
                    }
                    Spacer(modifier = Modifier.height(10.dp))
                }

                // Notes
                OutlinedTextField(
                    value = notes,
                    onValueChange = { notes = it },
                    label = { Text("Notes (Optional)") },
                    maxLines = 2,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(10.dp)
                )

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
                            if (selectedProductId.isBlank()) {
                                validationError = "Please select a product"
                                return@Button
                            }
                            if (provider.isBlank()) {
                                validationError = "Provider is required"
                                return@Button
                            }
                            if (login.isBlank()) {
                                validationError = "Master login is required"
                                return@Button
                            }
                            if (initialAccount == null && password.isBlank()) {
                                validationError = "Master password is required"
                                return@Button
                            }
                            val cap = capacityText.toIntOrNull()
                            if (cap == null || cap <= 0) {
                                validationError = "Valid capacity required"
                                return@Button
                            }

                            if (initialAccount == null) {
                                onSaveAccount(
                                    CreateServiceAccountRequest(
                                        productId = selectedProductId,
                                        provider = provider.trim(),
                                        login = login.trim(),
                                        password = password.trim(),
                                        capacity = cap,
                                        expiryDate = expiryDate.trim().ifEmpty { null },
                                        notes = notes.trim().ifEmpty { null },
                                        createProfiles = true
                                    )
                                )
                            } else {
                                onUpdateAccount(
                                    initialAccount.id,
                                    UpdateServiceAccountRequest(
                                        productId = selectedProductId,
                                        provider = provider.trim(),
                                        login = login.trim(),
                                        password = password.trim().ifEmpty { null },
                                        capacity = cap,
                                        expiryDate = expiryDate.trim().ifEmpty { null },
                                        status = status,
                                        notes = notes.trim().ifEmpty { null }
                                    )
                                )
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = PrimaryBlue)
                    ) {
                        Text(if (initialAccount == null) "Create Account" else "Save Changes")
                    }
                }
            }
        }
    }
}

@Composable
fun ProfileEditDialog(
    profile: ServiceProfileDto,
    onDismiss: () -> Unit,
    onSave: (UpdateServiceProfileRequest) -> Unit
) {
    var profileName by remember { mutableStateOf(profile.profileName) }
    var pin by remember { mutableStateOf(profile.pin ?: "") }
    var validationError by remember { mutableStateOf<String?>(null) }

    Dialog(onDismissRequest = onDismiss) {
        Card(
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = Color.White),
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 16.dp)
        ) {
            Column(modifier = Modifier.padding(20.dp)) {
                Text("Edit Profile Slot", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = Slate900)
                Spacer(modifier = Modifier.height(16.dp))

                OutlinedTextField(
                    value = profileName,
                    onValueChange = { profileName = it; validationError = null },
                    label = { Text("Profile Name *") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(10.dp)
                )
                Spacer(modifier = Modifier.height(10.dp))

                OutlinedTextField(
                    value = pin,
                    onValueChange = { pin = it },
                    label = { Text("PIN Code (Optional)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(10.dp)
                )

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
                            if (profileName.isBlank()) {
                                validationError = "Profile name is required"
                                return@Button
                            }
                            onSave(
                                UpdateServiceProfileRequest(
                                    profileName = profileName.trim(),
                                    pin = pin.trim().ifEmpty { null }
                                )
                            )
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = PrimaryBlue)
                    ) {
                        Text("Save")
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BulkLicenseDialog(
    products: List<ProductDto>,
    onDismiss: () -> Unit,
    onSaveLicenses: (AddLicensesRequest) -> Unit
) {
    val licenseProducts = remember(products) {
        val filtered = products.filter { it.isLicenseKey }
        if (filtered.isNotEmpty()) filtered else products
    }

    var selectedProductId by remember {
        mutableStateOf(licenseProducts.firstOrNull()?.id ?: "")
    }
    var keysText by remember { mutableStateOf("") }
    var expiryDate by remember { mutableStateOf("") }
    var notes by remember { mutableStateOf("") }
    var productDropdownExpanded by remember { mutableStateOf(false) }
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
                Text("Bulk Import License Keys", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = Slate900)
                Spacer(modifier = Modifier.height(16.dp))

                // Product Dropdown
                ExposedDropdownMenuBox(
                    expanded = productDropdownExpanded,
                    onExpandedChange = { productDropdownExpanded = it }
                ) {
                    val currentProdName = licenseProducts.find { it.id == selectedProductId }?.name ?: "Select Product"
                    OutlinedTextField(
                        value = currentProdName,
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("Product *") },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = productDropdownExpanded) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .menuAnchor(),
                        shape = RoundedCornerShape(10.dp)
                    )
                    ExposedDropdownMenu(
                        expanded = productDropdownExpanded,
                        onDismissRequest = { productDropdownExpanded = false }
                    ) {
                        licenseProducts.forEach { prod ->
                            DropdownMenuItem(
                                text = { Text(prod.name) },
                                onClick = {
                                    selectedProductId = prod.id
                                    productDropdownExpanded = false
                                }
                            )
                        }
                    }
                }
                Spacer(modifier = Modifier.height(10.dp))

                // Keys Multiline Input
                OutlinedTextField(
                    value = keysText,
                    onValueChange = { keysText = it; validationError = null },
                    label = { Text("License Keys (One per line) *") },
                    placeholder = { Text("XXXXX-XXXXX-XXXXX\nYYYYY-YYYYY-YYYYY") },
                    minLines = 5,
                    maxLines = 8,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(10.dp)
                )
                Spacer(modifier = Modifier.height(10.dp))

                // Expiry and Notes
                OutlinedTextField(
                    value = expiryDate,
                    onValueChange = { expiryDate = it },
                    label = { Text("Expiry Date (Optional, YYYY-MM-DD)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(10.dp)
                )
                Spacer(modifier = Modifier.height(10.dp))

                OutlinedTextField(
                    value = notes,
                    onValueChange = { notes = it },
                    label = { Text("Batch Notes (Optional)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(10.dp)
                )

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
                            if (selectedProductId.isBlank()) {
                                validationError = "Please select a product"
                                return@Button
                            }
                            val rawKeys = keysText.lines()
                                .map { it.trim() }
                                .filter { it.isNotEmpty() }

                            if (rawKeys.isEmpty()) {
                                validationError = "Please enter at least one license key"
                                return@Button
                            }

                            onSaveLicenses(
                                AddLicensesRequest(
                                    productId = selectedProductId,
                                    keys = rawKeys,
                                    expiryDate = expiryDate.trim().ifEmpty { null },
                                    notes = notes.trim().ifEmpty { null }
                                )
                            )
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = StatusSuccess)
                    ) {
                        Text("Import ${keysText.lines().filter { it.isNotBlank() }.size} Keys")
                    }
                }
            }
        }
    }
}
