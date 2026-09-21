package com.vectis.erp

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import com.vectis.erp.core.design.VectisTheme
import com.vectis.erp.navigation.VectisNavGraph

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        val app = application as VectisApplication

        setContent {
            VectisTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    VectisNavGraph(secureStorage = app.secureStorage)
                }
            }
        }
    }
}
