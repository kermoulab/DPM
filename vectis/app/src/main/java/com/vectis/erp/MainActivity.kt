package com.vectis.erp

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Modifier
import androidx.core.content.ContextCompat
import com.vectis.erp.core.design.VectisTheme
import com.vectis.erp.navigation.VectisNavGraph

class MainActivity : ComponentActivity() {

    private val deepLinkIntentState = mutableStateOf<Intent?>(null)

    private val requestNotificationPermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { isGranted ->
            // System notification permission granted callback
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        val app = application as VectisApplication
        deepLinkIntentState.value = intent

        // Prompt user for notification permission on Android 13+ (API 33+)
        checkAndRequestNotificationPermission()

        setContent {
            VectisTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    VectisNavGraph(
                        secureStorage = app.secureStorage,
                        deepLinkIntent = deepLinkIntentState.value
                    )
                }
            }
        }
    }

    private fun checkAndRequestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val permission = Manifest.permission.POST_NOTIFICATIONS
            if (ContextCompat.checkSelfPermission(this, permission) != PackageManager.PERMISSION_GRANTED) {
                requestNotificationPermissionLauncher.launch(permission)
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        deepLinkIntentState.value = intent
    }
}

