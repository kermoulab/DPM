package com.vectis.erp.feature.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.vectis.erp.core.design.PrimaryBlue
import com.vectis.erp.core.design.Slate50
import com.vectis.erp.core.design.Slate500
import com.vectis.erp.core.design.Slate900
import com.vectis.erp.core.design.StatusDanger
import com.vectis.erp.core.design.StatusSuccess

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LoginScreen(
    viewModel: LoginViewModel,
    deviceId: String?,
    onLoginSuccess: () -> Unit,
    onUnpairDevice: () -> Unit
) {
    val uiState by viewModel.uiState.collectAsState()
    var usernameInput by remember { mutableStateOf(viewModel.username) }
    var passwordInput by remember { mutableStateOf(viewModel.password) }
    var isPassVisible by remember { mutableStateOf(viewModel.isPasswordVisible) }
    var showUnpairDialog by remember { mutableStateOf(false) }

    Scaffold(
        containerColor = Slate50
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(horizontal = 24.dp),
            contentAlignment = Alignment.Center
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 24.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                // Header / Branding
                Text(
                    text = "Vectis ERP",
                    fontSize = 28.sp,
                    fontWeight = FontWeight.Bold,
                    color = Slate900
                )

                Spacer(modifier = Modifier.height(4.dp))

                Text(
                    text = "Staff Authentication",
                    fontSize = 14.sp,
                    color = Slate500
                )

                // Device Paired Badge
                if (!deviceId.isNullOrBlank()) {
                    Spacer(modifier = Modifier.height(16.dp))
                    Surface(
                        color = StatusSuccess.copy(alpha = 0.1f),
                        shape = RoundedCornerShape(20.dp)
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                Icons.Default.CheckCircle,
                                contentDescription = null,
                                tint = StatusSuccess,
                                modifier = Modifier.size(14.dp)
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = "Paired: $deviceId",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Medium,
                                color = StatusSuccess
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(36.dp))

                // Username Input
                OutlinedTextField(
                    value = usernameInput,
                    onValueChange = {
                        usernameInput = it
                        viewModel.updateUsername(it)
                        viewModel.clearError()
                    },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("Username") },
                    leadingIcon = {
                        Icon(Icons.Default.Person, contentDescription = null, tint = Slate500)
                    },
                    singleLine = true,
                    shape = RoundedCornerShape(14.dp),
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Next),
                    isError = uiState is AuthUiState.Error
                )

                Spacer(modifier = Modifier.height(16.dp))

                // Password Input
                OutlinedTextField(
                    value = passwordInput,
                    onValueChange = {
                        passwordInput = it
                        viewModel.updatePassword(it)
                        viewModel.clearError()
                    },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("Password") },
                    leadingIcon = {
                        Icon(Icons.Default.Lock, contentDescription = null, tint = Slate500)
                    },
                    trailingIcon = {
                        IconButton(onClick = {
                            isPassVisible = !isPassVisible
                            viewModel.togglePasswordVisibility()
                        }) {
                            Icon(
                                imageVector = if (isPassVisible) Icons.Default.VisibilityOff else Icons.Default.Visibility,
                                contentDescription = if (isPassVisible) "Hide password" else "Show password",
                                tint = Slate500
                            )
                        }
                    },
                    singleLine = true,
                    shape = RoundedCornerShape(14.dp),
                    visualTransformation = if (isPassVisible) VisualTransformation.None else PasswordVisualTransformation(),
                    keyboardOptions = KeyboardOptions(
                        keyboardType = KeyboardType.Password,
                        imeAction = ImeAction.Done
                    ),
                    keyboardActions = KeyboardActions(
                        onDone = { viewModel.login(onLoginSuccess) }
                    ),
                    isError = uiState is AuthUiState.Error
                )

                if (uiState is AuthUiState.Error) {
                    Spacer(modifier = Modifier.height(14.dp))
                    Text(
                        text = (uiState as AuthUiState.Error).message,
                        color = StatusDanger,
                        fontSize = 13.sp,
                        textAlign = TextAlign.Center
                    )
                }

                Spacer(modifier = Modifier.height(28.dp))

                // Login Button
                Button(
                    onClick = { viewModel.login(onLoginSuccess) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(52.dp),
                    enabled = usernameInput.isNotBlank() && passwordInput.isNotBlank() && uiState !is AuthUiState.Loading,
                    shape = RoundedCornerShape(16.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = PrimaryBlue)
                ) {
                    if (uiState is AuthUiState.Loading) {
                        CircularProgressIndicator(
                            color = MaterialTheme.colorScheme.onPrimary,
                            modifier = Modifier.size(22.dp),
                            strokeWidth = 2.5.dp
                        )
                    } else {
                        Text("Sign In", fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
                    }
                }

                Spacer(modifier = Modifier.height(24.dp))

                // Unlink / Re-pair Button
                TextButton(onClick = { showUnpairDialog = true }) {
                    Text(
                        text = "Unlink Device / Re-pair",
                        fontSize = 13.sp,
                        color = Slate500
                    )
                }
            }
        }
    }

    if (showUnpairDialog) {
        AlertDialog(
            onDismissRequest = { showUnpairDialog = false },
            title = { Text("Unlink this device?", fontWeight = FontWeight.Bold) },
            text = {
                Text(
                    "Unlinking will wipe the device pairing credentials and require a new QR code or pairing code to reconnect.",
                    fontSize = 13.sp,
                    color = Slate500
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        showUnpairDialog = false
                        viewModel.unpairDevice(onUnpairDevice)
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = StatusDanger)
                ) {
                    Text("Unlink & Disconnect")
                }
            },
            dismissButton = {
                TextButton(onClick = { showUnpairDialog = false }) {
                    Text("Cancel")
                }
            }
        )
    }
}
