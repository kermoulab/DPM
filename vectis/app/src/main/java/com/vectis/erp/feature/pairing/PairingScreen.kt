package com.vectis.erp.feature.pairing

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Dns
import androidx.compose.material.icons.filled.Pin
import androidx.compose.material.icons.filled.QrCodeScanner
import androidx.compose.material.icons.filled.Security
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.vectis.erp.core.design.PrimaryBlue
import com.vectis.erp.core.design.Slate400
import com.vectis.erp.core.design.Slate50
import com.vectis.erp.core.design.Slate500
import com.vectis.erp.core.design.Slate800
import com.vectis.erp.core.design.Slate900

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PairingScreen(
    viewModel: PairingViewModel,
    onNavigateToScanQr: () -> Unit,
    onNavigateToEnterCode: () -> Unit
) {
    var showServerUrlDialog by remember { mutableStateOf(false) }
    var tempUrl by remember { mutableStateOf(viewModel.serverUrl) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("") },
                actions = {
                    IconButton(onClick = {
                        tempUrl = viewModel.serverUrl
                        showServerUrlDialog = true
                    }) {
                        Icon(Icons.Default.Dns, contentDescription = "Server Settings", tint = Slate500)
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
                .padding(horizontal = 24.dp),
            contentAlignment = Alignment.Center
        ) {
            Column(
                modifier = Modifier.fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                // Security Badge Icon
                Box(
                    modifier = Modifier
                        .size(80.dp)
                        .clip(RoundedCornerShape(24.dp))
                        .background(PrimaryBlue.copy(alpha = 0.1f)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.Security,
                        contentDescription = null,
                        tint = PrimaryBlue,
                        modifier = Modifier.size(44.dp)
                    )
                }

                Spacer(modifier = Modifier.height(24.dp))

                Text(
                    text = "Digital Products ERP",
                    fontSize = 24.sp,
                    fontWeight = FontWeight.Bold,
                    color = Slate900
                )

                Spacer(modifier = Modifier.height(8.dp))

                Text(
                    text = "Connect this device",
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Medium,
                    color = Slate500,
                    textAlign = TextAlign.Center
                )

                Spacer(modifier = Modifier.height(40.dp))

                // Scan QR Code Button
                Button(
                    onClick = onNavigateToScanQr,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(52.dp),
                    shape = RoundedCornerShape(16.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = PrimaryBlue)
                ) {
                    Icon(Icons.Default.QrCodeScanner, contentDescription = null, modifier = Modifier.size(20.dp))
                    Spacer(modifier = Modifier.width(10.dp))
                    Text(text = "Scan QR Code", fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Or Divider
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    HorizontalDivider(modifier = Modifier.weight(1f), color = Slate400.copy(alpha = 0.3f))
                    Text(
                        text = "or",
                        modifier = Modifier.padding(horizontal = 12.dp),
                        fontSize = 13.sp,
                        color = Slate400
                    )
                    HorizontalDivider(modifier = Modifier.weight(1f), color = Slate400.copy(alpha = 0.3f))
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Enter Pairing Code Button
                OutlinedButton(
                    onClick = onNavigateToEnterCode,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(52.dp),
                    shape = RoundedCornerShape(16.dp),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = Slate800)
                ) {
                    Icon(Icons.Default.Pin, contentDescription = null, modifier = Modifier.size(20.dp))
                    Spacer(modifier = Modifier.width(10.dp))
                    Text(text = "Enter Pairing Code", fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
                }

                Spacer(modifier = Modifier.height(32.dp))

                // Current Connected Server indicator
                Text(
                    text = "Server: ${viewModel.serverUrl}",
                    fontSize = 12.sp,
                    color = Slate400,
                    textAlign = TextAlign.Center
                )
            }
        }
    }

    if (showServerUrlDialog) {
        AlertDialog(
            onDismissRequest = { showServerUrlDialog = false },
            title = { Text("ERP Server URL", fontWeight = FontWeight.Bold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        text = "Enter the base URL of your Vectis ERP instance:",
                        fontSize = 13.sp,
                        color = Slate500
                    )
                    OutlinedTextField(
                        value = tempUrl,
                        onValueChange = { tempUrl = it },
                        singleLine = true,
                        placeholder = { Text("https://erp.example.com") },
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        viewModel.updateServerUrl(tempUrl)
                        showServerUrlDialog = false
                    }
                ) {
                    Text("Save")
                }
            },
            dismissButton = {
                TextButton(onClick = { showServerUrlDialog = false }) {
                    Text("Cancel")
                }
            }
        )
    }
}
