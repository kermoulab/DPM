package com.vectis.erp.feature.settings

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.vectis.erp.core.design.*
import com.vectis.erp.data.model.CreateUserRequest

@Composable
fun ChangePasswordDialog(
    onDismiss: () -> Unit,
    onSubmit: (String, String) -> Unit
) {
    var currentPassword by remember { mutableStateOf("") }
    var newPassword by remember { mutableStateOf("") }
    var confirmPassword by remember { mutableStateOf("") }

    var showCurrentPw by remember { mutableStateOf(false) }
    var showNewPw by remember { mutableStateOf(false) }
    var showConfirmPw by remember { mutableStateOf(false) }

    var errorMsg by remember { mutableStateOf<String?>(null) }

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
                Text("Change Password", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = Slate900)
                Spacer(modifier = Modifier.height(16.dp))

                OutlinedTextField(
                    value = currentPassword,
                    onValueChange = { currentPassword = it; errorMsg = null },
                    label = { Text("Current Password") },
                    singleLine = true,
                    visualTransformation = if (showCurrentPw) VisualTransformation.None else PasswordVisualTransformation(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                    trailingIcon = {
                        IconButton(onClick = { showCurrentPw = !showCurrentPw }) {
                            Icon(if (showCurrentPw) Icons.Default.VisibilityOff else Icons.Default.Visibility, contentDescription = null)
                        }
                    },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(10.dp)
                )
                Spacer(modifier = Modifier.height(10.dp))

                OutlinedTextField(
                    value = newPassword,
                    onValueChange = { newPassword = it; errorMsg = null },
                    label = { Text("New Password (Min 8 chars)") },
                    singleLine = true,
                    visualTransformation = if (showNewPw) VisualTransformation.None else PasswordVisualTransformation(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                    trailingIcon = {
                        IconButton(onClick = { showNewPw = !showNewPw }) {
                            Icon(if (showNewPw) Icons.Default.VisibilityOff else Icons.Default.Visibility, contentDescription = null)
                        }
                    },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(10.dp)
                )
                Spacer(modifier = Modifier.height(10.dp))

                OutlinedTextField(
                    value = confirmPassword,
                    onValueChange = { confirmPassword = it; errorMsg = null },
                    label = { Text("Confirm New Password") },
                    singleLine = true,
                    visualTransformation = if (showConfirmPw) VisualTransformation.None else PasswordVisualTransformation(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                    trailingIcon = {
                        IconButton(onClick = { showConfirmPw = !showConfirmPw }) {
                            Icon(if (showConfirmPw) Icons.Default.VisibilityOff else Icons.Default.Visibility, contentDescription = null)
                        }
                    },
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
                            if (currentPassword.isBlank()) {
                                errorMsg = "Current password is required"
                                return@Button
                            }
                            if (newPassword.length < 8) {
                                errorMsg = "New password must be at least 8 characters"
                                return@Button
                            }
                            if (newPassword != confirmPassword) {
                                errorMsg = "Passwords do not match"
                                return@Button
                            }
                            onSubmit(currentPassword, newPassword)
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = PrimaryBlue)
                    ) {
                        Text("Update Password")
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddUserDialog(
    onDismiss: () -> Unit,
    onSubmit: (CreateUserRequest) -> Unit
) {
    var name by remember { mutableStateOf("") }
    var username by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var role by remember { mutableStateOf("agent") }
    var roleDropdownExpanded by remember { mutableStateOf(false) }
    var errorMsg by remember { mutableStateOf<String?>(null) }

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
                Text("Add Team Member", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = Slate900)
                Spacer(modifier = Modifier.height(16.dp))

                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it; errorMsg = null },
                    label = { Text("Full Name *") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(10.dp)
                )
                Spacer(modifier = Modifier.height(10.dp))

                OutlinedTextField(
                    value = username,
                    onValueChange = { username = it; errorMsg = null },
                    label = { Text("Username *") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(10.dp)
                )
                Spacer(modifier = Modifier.height(10.dp))

                OutlinedTextField(
                    value = email,
                    onValueChange = { email = it; errorMsg = null },
                    label = { Text("Email Address *") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(10.dp)
                )
                Spacer(modifier = Modifier.height(10.dp))

                OutlinedTextField(
                    value = password,
                    onValueChange = { password = it; errorMsg = null },
                    label = { Text("Password (Min 8 chars) *") },
                    singleLine = true,
                    visualTransformation = PasswordVisualTransformation(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(10.dp)
                )
                Spacer(modifier = Modifier.height(10.dp))

                // Role Dropdown
                ExposedDropdownMenuBox(
                    expanded = roleDropdownExpanded,
                    onExpandedChange = { roleDropdownExpanded = it }
                ) {
                    OutlinedTextField(
                        value = role.uppercase(),
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("Staff Role") },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = roleDropdownExpanded) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .menuAnchor(),
                        shape = RoundedCornerShape(10.dp)
                    )
                    ExposedDropdownMenu(
                        expanded = roleDropdownExpanded,
                        onDismissRequest = { roleDropdownExpanded = false }
                    ) {
                        listOf("agent", "manager", "admin", "viewer").forEach { r ->
                            DropdownMenuItem(
                                text = { Text(r.uppercase()) },
                                onClick = {
                                    role = r
                                    roleDropdownExpanded = false
                                }
                            )
                        }
                    }
                }

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
                            if (name.isBlank() || username.isBlank() || email.isBlank() || password.isBlank()) {
                                errorMsg = "All fields are required"
                                return@Button
                            }
                            if (password.length < 8) {
                                errorMsg = "Password must be at least 8 characters"
                                return@Button
                            }
                            onSubmit(
                                CreateUserRequest(
                                    name = name.trim(),
                                    username = username.trim(),
                                    email = email.trim().lowercase(),
                                    password = password.trim(),
                                    role = role
                                )
                            )
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = PrimaryBlue)
                    ) {
                        Text("Create Member")
                    }
                }
            }
        }
    }
}
