package com.vectis.erp.feature.customers

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
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
import androidx.compose.ui.window.Dialog
import com.vectis.erp.core.design.*
import com.vectis.erp.data.model.CustomerDto

@Composable
fun CustomerFormDialog(
    customerToEdit: CustomerDto? = null,
    onDismiss: () -> Unit,
    onSave: (name: String, email: String?, whatsapp: String?, notes: String?, status: String?) -> Unit
) {
    var name by remember { mutableStateOf(customerToEdit?.name ?: "") }
    var email by remember { mutableStateOf(customerToEdit?.email ?: "") }
    var whatsapp by remember { mutableStateOf(customerToEdit?.whatsapp ?: "") }
    var notes by remember { mutableStateOf(customerToEdit?.notes ?: "") }
    var status by remember { mutableStateOf(customerToEdit?.status ?: "active") }
    var nameError by remember { mutableStateOf<String?>(null) }
    var isSubmitting by remember { mutableStateOf(false) }

    Dialog(onDismissRequest = onDismiss) {
        Card(
            shape = RoundedCornerShape(24.dp),
            colors = CardDefaults.cardColors(containerColor = Color.White),
            modifier = Modifier
                .fillMaxWidth()
                .padding(8.dp)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                Text(
                    text = if (customerToEdit == null) "Add Customer" else "Edit Customer",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    color = Slate900
                )

                OutlinedTextField(
                    value = name,
                    onValueChange = {
                        name = it
                        if (it.isNotBlank()) nameError = null
                    },
                    label = { Text("Full Name *") },
                    leadingIcon = { Icon(Icons.Default.Person, contentDescription = null, tint = Slate400) },
                    isError = nameError != null,
                    supportingText = nameError?.let { { Text(it, color = StatusDanger) } },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                OutlinedTextField(
                    value = whatsapp,
                    onValueChange = { whatsapp = it },
                    label = { Text("WhatsApp Phone (e.g. +212600000000)") },
                    leadingIcon = { Icon(Icons.Default.Phone, contentDescription = null, tint = Slate400) },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                OutlinedTextField(
                    value = email,
                    onValueChange = { email = it },
                    label = { Text("Email Address") },
                    leadingIcon = { Icon(Icons.Default.Email, contentDescription = null, tint = Slate400) },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                OutlinedTextField(
                    value = notes,
                    onValueChange = { notes = it },
                    label = { Text("Notes / Internal Memo") },
                    leadingIcon = { Icon(Icons.Default.EditNote, contentDescription = null, tint = Slate400) },
                    maxLines = 3,
                    modifier = Modifier.fillMaxWidth()
                )

                if (customerToEdit != null) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("Active Status", fontSize = 14.sp, fontWeight = FontWeight.Medium, color = Slate700)
                        Switch(
                            checked = status == "active",
                            onCheckedChange = { status = if (it) "active" else "inactive" },
                            colors = SwitchDefaults.colors(
                                checkedThumbColor = Color.White,
                                checkedTrackColor = StatusSuccess
                            )
                        )
                    }
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    TextButton(onClick = onDismiss, enabled = !isSubmitting) {
                        Text("Cancel", color = Slate500)
                    }
                    Spacer(modifier = Modifier.width(8.dp))
                    Button(
                        onClick = {
                            if (name.isBlank()) {
                                nameError = "Customer name is required"
                                return@Button
                            }
                            isSubmitting = true
                            onSave(name, email, whatsapp, notes, status)
                        },
                        enabled = !isSubmitting,
                        colors = ButtonDefaults.buttonColors(containerColor = PrimaryBlue)
                    ) {
                        if (isSubmitting) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(18.dp),
                                color = Color.White,
                                strokeWidth = 2.dp
                            )
                        } else {
                            Text("Save")
                        }
                    }
                }
            }
        }
    }
}
