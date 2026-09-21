package com.vectis.erp.navigation

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.vectis.erp.core.security.SecureStorage

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun VectisNavGraph(
    secureStorage: SecureStorage,
    navController: NavHostController = rememberNavController()
) {
    // Determine initial destination:
    // 1. If device not paired -> Pairing screen
    // 2. If device paired but no user session -> Login screen
    // 3. If authenticated -> Dashboard screen
    val startDestination = remember {
        when {
            !secureStorage.isDevicePaired() -> Screen.Pairing.route
            !secureStorage.isAuthenticated() -> Screen.Login.route
            else -> Screen.Dashboard.route
        }
    }

    val context = androidx.compose.ui.platform.LocalContext.current
    val app = context.applicationContext as com.vectis.erp.VectisApplication

    LaunchedEffect(Unit) {
        app.networkClient.deviceRevokedEvents.collect {
            navController.navigate(Screen.Pairing.route) {
                popUpTo(0) { inclusive = true }
            }
        }
    }

    LaunchedEffect(Unit) {
        app.networkClient.unauthorizedEvents.collect {
            if (secureStorage.isDevicePaired()) {
                navController.navigate(Screen.Login.route) {
                    popUpTo(0) { inclusive = true }
                }
            } else {
                navController.navigate(Screen.Pairing.route) {
                    popUpTo(0) { inclusive = true }
                }
            }
        }
    }

    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route

    val isMainScreen = currentRoute in listOf(
        Screen.Dashboard.route,
        Screen.Orders.route,
        Screen.Customers.route,
        Screen.Inventory.route,
        Screen.Alerts.route,
        Screen.Settings.route
    )

    Scaffold(
        bottomBar = {
            if (isMainScreen) {
                NavigationBar {
                    NavigationBarItem(
                        selected = currentRoute == Screen.Dashboard.route,
                        onClick = {
                            navController.navigate(Screen.Dashboard.route) {
                                popUpTo(navController.graph.findStartDestination().id) { saveState = true }
                                launchSingleTop = true
                                restoreState = true
                            }
                        },
                        icon = { Icon(Icons.Default.Dashboard, contentDescription = "Dashboard") },
                        label = { Text("Dashboard") }
                    )
                    NavigationBarItem(
                        selected = currentRoute == Screen.Orders.route,
                        onClick = {
                            navController.navigate(Screen.Orders.route) {
                                popUpTo(navController.graph.findStartDestination().id) { saveState = true }
                                launchSingleTop = true
                                restoreState = true
                            }
                        },
                        icon = { Icon(Icons.Default.ShoppingCart, contentDescription = "Orders") },
                        label = { Text("Orders") }
                    )
                    NavigationBarItem(
                        selected = currentRoute == Screen.Customers.route,
                        onClick = {
                            navController.navigate(Screen.Customers.route) {
                                popUpTo(navController.graph.findStartDestination().id) { saveState = true }
                                launchSingleTop = true
                                restoreState = true
                            }
                        },
                        icon = { Icon(Icons.Default.People, contentDescription = "Customers") },
                        label = { Text("Customers") }
                    )
                    NavigationBarItem(
                        selected = currentRoute == Screen.Alerts.route,
                        onClick = {
                            navController.navigate(Screen.Alerts.route) {
                                popUpTo(navController.graph.findStartDestination().id) { saveState = true }
                                launchSingleTop = true
                                restoreState = true
                            }
                        },
                        icon = { Icon(Icons.Default.Notifications, contentDescription = "Alerts") },
                        label = { Text("Alerts") }
                    )
                    NavigationBarItem(
                        selected = currentRoute == Screen.Settings.route,
                        onClick = {
                            navController.navigate(Screen.Settings.route) {
                                popUpTo(navController.graph.findStartDestination().id) { saveState = true }
                                launchSingleTop = true
                                restoreState = true
                            }
                        },
                        icon = { Icon(Icons.Default.Settings, contentDescription = "Settings") },
                        label = { Text("Settings") }
                    )
                }
            }
        }
    ) { paddingValues ->
        NavHost(
            navController = navController,
            startDestination = startDestination,
            modifier = Modifier.padding(paddingValues)
        ) {
            composable(Screen.Pairing.route) {
                val app = androidx.compose.ui.platform.LocalContext.current.applicationContext as com.vectis.erp.VectisApplication
                val pairingRepo = remember { com.vectis.erp.data.repository.PairingRepositoryImpl(app.networkClient, secureStorage) }
                val viewModel: com.vectis.erp.feature.pairing.PairingViewModel = androidx.lifecycle.viewmodel.compose.viewModel(
                    factory = com.vectis.erp.feature.pairing.PairingViewModel.Factory(pairingRepo, secureStorage)
                )

                com.vectis.erp.feature.pairing.PairingScreen(
                    viewModel = viewModel,
                    onNavigateToScanQr = { navController.navigate(Screen.ScanQr.route) },
                    onNavigateToEnterCode = { navController.navigate(Screen.EnterCode.route) }
                )
            }
            composable(Screen.EnterCode.route) {
                val app = androidx.compose.ui.platform.LocalContext.current.applicationContext as com.vectis.erp.VectisApplication
                val pairingRepo = remember { com.vectis.erp.data.repository.PairingRepositoryImpl(app.networkClient, secureStorage) }
                val viewModel: com.vectis.erp.feature.pairing.PairingViewModel = androidx.lifecycle.viewmodel.compose.viewModel(
                    factory = com.vectis.erp.feature.pairing.PairingViewModel.Factory(pairingRepo, secureStorage)
                )

                com.vectis.erp.feature.pairing.EnterCodeScreen(
                    viewModel = viewModel,
                    onNavigateBack = { navController.popBackStack() },
                    onPairingSuccess = {
                        navController.navigate(Screen.Login.route) {
                            popUpTo(Screen.Pairing.route) { inclusive = true }
                        }
                    }
                )
            }
            composable(Screen.ScanQr.route) {
                val app = androidx.compose.ui.platform.LocalContext.current.applicationContext as com.vectis.erp.VectisApplication
                val pairingRepo = remember { com.vectis.erp.data.repository.PairingRepositoryImpl(app.networkClient, secureStorage) }
                val viewModel: com.vectis.erp.feature.pairing.PairingViewModel = androidx.lifecycle.viewmodel.compose.viewModel(
                    factory = com.vectis.erp.feature.pairing.PairingViewModel.Factory(pairingRepo, secureStorage)
                )

                com.vectis.erp.feature.pairing.ScanQrScreen(
                    viewModel = viewModel,
                    onNavigateBack = { navController.popBackStack() },
                    onPairingSuccess = {
                        navController.navigate(Screen.Login.route) {
                            popUpTo(Screen.Pairing.route) { inclusive = true }
                        }
                    }
                )
            }
            composable(Screen.Login.route) {
                val app = androidx.compose.ui.platform.LocalContext.current.applicationContext as com.vectis.erp.VectisApplication
                val authRepo = remember { com.vectis.erp.data.repository.AuthRepositoryImpl(app.networkClient, secureStorage) }
                val viewModel: com.vectis.erp.feature.auth.LoginViewModel = androidx.lifecycle.viewmodel.compose.viewModel(
                    factory = com.vectis.erp.feature.auth.LoginViewModel.Factory(authRepo, secureStorage)
                )

                com.vectis.erp.feature.auth.LoginScreen(
                    viewModel = viewModel,
                    deviceId = secureStorage.getDeviceId(),
                    onLoginSuccess = {
                        navController.navigate(Screen.Dashboard.route) {
                            popUpTo(Screen.Login.route) { inclusive = true }
                        }
                    },
                    onUnpairDevice = {
                        navController.navigate(Screen.Pairing.route) {
                            popUpTo(0) { inclusive = true }
                        }
                    }
                )
            }
            composable(Screen.Dashboard.route) {
                PlaceholderScreen("Dashboard Screen (Phase 5)")
            }
            composable(Screen.Orders.route) {
                PlaceholderScreen("Orders Screen (Phase 8)")
            }
            composable(Screen.Customers.route) {
                PlaceholderScreen("Customers Screen (Phase 6)")
            }
            composable(Screen.Inventory.route) {
                PlaceholderScreen("Inventory Bank Screen (Phase 7)")
            }
            composable(Screen.Alerts.route) {
                PlaceholderScreen("Alerts Screen (Phase 9)")
            }
            composable(Screen.Settings.route) {
                PlaceholderScreen("Settings Screen")
            }
        }
    }
}

@Composable
fun PlaceholderScreen(title: String) {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Text(text = title, style = MaterialTheme.typography.titleMedium)
    }
}
