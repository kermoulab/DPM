package com.vectis.erp.feature.pairing

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.QrCodeScanner
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
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
fun ScanQrScreen(
    viewModel: PairingViewModel,
    onNavigateBack: () -> Unit,
    onPairingSuccess: () -> Unit
) {
    val uiState by viewModel.uiState.collectAsState()
    var rawQrText by remember { mutableStateOf("") }
    var showManualInput by remember { mutableStateOf(false) }

    LaunchedEffect(uiState) {
        if (uiState is PairingUiState.Success) {
            onPairingSuccess()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Scan QR Code", fontWeight = FontWeight.SemiBold) },
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
                    .padding(top = 24.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    text = "Point camera at the QR code displayed on your Web ERP under Settings → Connected Devices",
                    fontSize = 14.sp,
                    color = Slate500,
                    textAlign = TextAlign.Center,
                    lineHeight = 20.sp
                )

                Spacer(modifier = Modifier.height(32.dp))

                // QR Viewfinder Box
                Box(
                    modifier = Modifier
                        .size(260.dp)
                        .clip(RoundedCornerShape(24.dp))
                        .background(Slate900.copy(alpha = 0.05f))
                        .border(2.dp, PrimaryBlue, RoundedCornerShape(24.dp)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.QrCodeScanner,
                        contentDescription = null,
                        tint = PrimaryBlue.copy(alpha = 0.6f),
                        modifier = Modifier.size(72.dp)
                    )
                }

                Spacer(modifier = Modifier.height(24.dp))

                TextButton(onClick = { showManualInput = !showManualInput }) {
                    Text(if (showManualInput) "Hide Paste QR Payload" else "Paste QR Payload directly")
                }

                if (showManualInput) {
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedTextField(
                        value = rawQrText,
                        onValueChange = { rawQrText = it },
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text("QR JSON Data") },
                        placeholder = { Text("""{"action":"pair_device","code":"123456"}""") },
                        maxLines = 3,
                        shape = RoundedCornerShape(12.dp)
                    )

                    Spacer(modifier = Modifier.height(16.dp))

                    Button(
                        onClick = {
                            viewModel.submitQrPayload(rawQrText, onSuccess = onPairingSuccess)
                        },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(48.dp),
                        enabled = rawQrText.isNotBlank() && uiState !is PairingUiState.Loading,
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = PrimaryBlue)
                    ) {
                        if (uiState is PairingUiState.Loading) {
                            CircularProgressIndicator(
                                color = MaterialTheme.colorScheme.onPrimary,
                                modifier = Modifier.size(20.dp),
                                strokeWidth = 2.dp
                            )
                        } else {
                            Text("Pair with Payload")
                        }
                    }
                }

                if (uiState is PairingUiState.Error) {
                    Spacer(modifier = Modifier.height(16.dp))
                    Text(
                        text = (uiState as PairingUiState.Error).message,
                        color = StatusDanger,
                        fontSize = 13.sp,
                        textAlign = TextAlign.Center
                    )
                }
            }
        }
    }
}
