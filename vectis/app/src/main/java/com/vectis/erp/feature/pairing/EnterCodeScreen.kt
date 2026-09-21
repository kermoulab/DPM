package com.vectis.erp.feature.pairing

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.vectis.erp.core.design.PrimaryBlue
import com.vectis.erp.core.design.Slate50
import com.vectis.erp.core.design.Slate500
import com.vectis.erp.core.design.Slate900
import com.vectis.erp.core.design.StatusDanger

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EnterCodeScreen(
    viewModel: PairingViewModel,
    onNavigateBack: () -> Unit,
    onPairingSuccess: () -> Unit
) {
    val uiState by viewModel.uiState.collectAsState()
    var codeInput by remember { mutableStateOf(viewModel.pairingCode) }
    var deviceNameInput by remember { mutableStateOf(viewModel.deviceName) }

    LaunchedEffect(uiState) {
        if (uiState is PairingUiState.Success) {
            onPairingSuccess()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Enter Pairing Code", fontWeight = FontWeight.SemiBold) },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Slate50)
            )
        },
        containerColor = Slate50
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(horizontal = 24.dp)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 16.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    text = "Enter the 6-digit code shown on your Web ERP under Settings → Connected Devices",
                    fontSize = 14.sp,
                    color = Slate500,
                    textAlign = TextAlign.Center,
                    lineHeight = 20.sp
                )

                Spacer(modifier = Modifier.height(32.dp))

                // Large Monospace Code Input
                OutlinedTextField(
                    value = codeInput,
                    onValueChange = { newValue ->
                        val digits = newValue.filter { it.isDigit() }.take(8)
                        codeInput = digits
                        viewModel.updatePairingCode(digits)
                        viewModel.clearError()
                    },
                    modifier = Modifier.fillMaxWidth(),
                    placeholder = {
                        Text(
                            "000000",
                            modifier = Modifier.fillMaxWidth(),
                            textAlign = TextAlign.Center,
                            fontFamily = FontFamily.Monospace,
                            fontSize = 28.sp,
                            letterSpacing = 6.sp,
                            color = Slate500.copy(alpha = 0.4f)
                        )
                    },
                    textStyle = LocalTextStyle.current.copy(
                        textAlign = TextAlign.Center,
                        fontFamily = FontFamily.Monospace,
                        fontSize = 28.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 6.sp,
                        color = Slate900
                    ),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                    singleLine = true,
                    shape = RoundedCornerShape(16.dp),
                    isError = uiState is PairingUiState.Error
                )

                Spacer(modifier = Modifier.height(20.dp))

                // Device Name Field
                OutlinedTextField(
                    value = deviceNameInput,
                    onValueChange = {
                        deviceNameInput = it
                        viewModel.updateDeviceName(it)
                    },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("Device Name (e.g. Counter Tablet)") },
                    singleLine = true,
                    shape = RoundedCornerShape(12.dp)
                )

                if (uiState is PairingUiState.Error) {
                    Spacer(modifier = Modifier.height(16.dp))
                    Text(
                        text = (uiState as PairingUiState.Error).message,
                        color = StatusDanger,
                        fontSize = 13.sp,
                        textAlign = TextAlign.Center
                    )
                }

                Spacer(modifier = Modifier.height(32.dp))

                Button(
                    onClick = {
                        viewModel.submitPairingCode(onSuccess = onPairingSuccess)
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(52.dp),
                    enabled = codeInput.length >= 6 && uiState !is PairingUiState.Loading,
                    shape = RoundedCornerShape(16.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = PrimaryBlue)
                ) {
                    if (uiState is PairingUiState.Loading) {
                        CircularProgressIndicator(
                            color = MaterialTheme.colorScheme.onPrimary,
                            modifier = Modifier.size(22.dp),
                            strokeWidth = 2.5.dp
                        )
                    } else {
                        Text("Connect & Authorize", fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
                    }
                }
            }
        }
    }
}
