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

    val searchRepo = remember { com.vectis.erp.data.repository.SearchRepositoryImpl(app.networkClient) }
    val searchViewModel: com.vectis.erp.feature.search.SearchViewModel = androidx.lifecycle.viewmodel.compose.viewModel(
        factory = com.vectis.erp.feature.search.SearchViewModel.Factory(searchRepo)
    )
    var showGlobalSearch by remember { mutableStateOf(false) }

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
        Screen.Products.route,
        Screen.Inventory.route,
        Screen.Customers.route,
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
                        selected = currentRoute == Screen.Products.route,
                        onClick = {
                            navController.navigate(Screen.Products.route) {
                                popUpTo(navController.graph.findStartDestination().id) { saveState = true }
                                launchSingleTop = true
                                restoreState = true
                            }
                        },
                        icon = { Icon(Icons.Default.Inventory2, contentDescription = "Products") },
                        label = { Text("Products") }
                    )
                    NavigationBarItem(
                        selected = currentRoute == Screen.Inventory.route,
                        onClick = {
                            navController.navigate(Screen.Inventory.route) {
                                popUpTo(navController.graph.findStartDestination().id) { saveState = true }
                                launchSingleTop = true
                                restoreState = true
                            }
                        },
                        icon = { Icon(Icons.Default.Layers, contentDescription = "Inventory") },
                        label = { Text("Inventory") }
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
                val app = androidx.compose.ui.platform.LocalContext.current.applicationContext as com.vectis.erp.VectisApplication
                val dashboardRepo = remember { com.vectis.erp.data.repository.DashboardRepositoryImpl(app.networkClient) }
                val viewModel: com.vectis.erp.feature.dashboard.DashboardViewModel = androidx.lifecycle.viewmodel.compose.viewModel(
                    factory = com.vectis.erp.feature.dashboard.DashboardViewModel.Factory(dashboardRepo)
                )

                com.vectis.erp.feature.dashboard.DashboardScreen(
                    viewModel = viewModel,
                    onNavigateToOrders = { navController.navigate(Screen.Orders.route) },
                    onNavigateToProducts = { navController.navigate(Screen.Products.route) },
                    onNavigateToInventory = { navController.navigate(Screen.Inventory.route) },
                    onNavigateToAlerts = { navController.navigate(Screen.Alerts.route) },
                    onNavigateToSettings = { navController.navigate(Screen.Settings.route) },
                    onOpenSearch = { showGlobalSearch = true }
                )
            }
            composable(Screen.Orders.route) {
                val app = androidx.compose.ui.platform.LocalContext.current.applicationContext as com.vectis.erp.VectisApplication
                val orderRepo = remember { com.vectis.erp.data.repository.OrderRepositoryImpl(app.networkClient) }
                val customerRepo = remember { com.vectis.erp.data.repository.CustomerRepositoryImpl(app.networkClient) }
                val productRepo = remember { com.vectis.erp.data.repository.ProductInventoryRepositoryImpl(app.networkClient) }
                val permissionManager = remember { com.vectis.erp.core.authorization.PermissionManager(secureStorage) }
                val viewModel: com.vectis.erp.feature.orders.OrderViewModel = androidx.lifecycle.viewmodel.compose.viewModel(
                    factory = com.vectis.erp.feature.orders.OrderViewModel.Factory(orderRepo, customerRepo, productRepo, secureStorage, permissionManager)
                )

                com.vectis.erp.feature.orders.OrderListScreen(
                    viewModel = viewModel,
                    onOrderClick = { orderId ->
                        navController.navigate(Screen.OrderDetail.createRoute(orderId))
                    },
                    onCreateOrderClick = {
                        navController.navigate(Screen.CreateOrder.route)
                    }
                )
            }
            composable(Screen.OrderDetail.route) { backStackEntry ->
                val orderId = backStackEntry.arguments?.getString("orderId") ?: ""
                val app = androidx.compose.ui.platform.LocalContext.current.applicationContext as com.vectis.erp.VectisApplication
                val orderRepo = remember { com.vectis.erp.data.repository.OrderRepositoryImpl(app.networkClient) }
                val customerRepo = remember { com.vectis.erp.data.repository.CustomerRepositoryImpl(app.networkClient) }
                val productRepo = remember { com.vectis.erp.data.repository.ProductInventoryRepositoryImpl(app.networkClient) }
                val permissionManager = remember { com.vectis.erp.core.authorization.PermissionManager(secureStorage) }
                val viewModel: com.vectis.erp.feature.orders.OrderViewModel = androidx.lifecycle.viewmodel.compose.viewModel(
                    factory = com.vectis.erp.feature.orders.OrderViewModel.Factory(orderRepo, customerRepo, productRepo, secureStorage, permissionManager)
                )

                com.vectis.erp.feature.orders.OrderDetailScreen(
                    orderId = orderId,
                    viewModel = viewModel,
                    onNavigateBack = { navController.popBackStack() }
                )
            }
            composable(Screen.CreateOrder.route) {
                val app = androidx.compose.ui.platform.LocalContext.current.applicationContext as com.vectis.erp.VectisApplication
                val orderRepo = remember { com.vectis.erp.data.repository.OrderRepositoryImpl(app.networkClient) }
                val customerRepo = remember { com.vectis.erp.data.repository.CustomerRepositoryImpl(app.networkClient) }
                val productRepo = remember { com.vectis.erp.data.repository.ProductInventoryRepositoryImpl(app.networkClient) }
                val permissionManager = remember { com.vectis.erp.core.authorization.PermissionManager(secureStorage) }
                val viewModel: com.vectis.erp.feature.orders.OrderViewModel = androidx.lifecycle.viewmodel.compose.viewModel(
                    factory = com.vectis.erp.feature.orders.OrderViewModel.Factory(orderRepo, customerRepo, productRepo, secureStorage, permissionManager)
                )

                com.vectis.erp.feature.orders.CreateOrderScreen(
                    viewModel = viewModel,
                    onNavigateBack = { navController.popBackStack() },
                    onOrderCreated = { newOrderId ->
                        navController.navigate(Screen.OrderDetail.createRoute(newOrderId)) {
                            popUpTo(Screen.Orders.route)
                        }
                    }
                )
            }
            composable(Screen.Products.route) {
                val app = androidx.compose.ui.platform.LocalContext.current.applicationContext as com.vectis.erp.VectisApplication
                val inventoryRepo = remember { com.vectis.erp.data.repository.ProductInventoryRepositoryImpl(app.networkClient) }
                val permissionManager = remember { com.vectis.erp.core.authorization.PermissionManager(secureStorage) }
                val viewModel: com.vectis.erp.feature.inventory.InventoryViewModel = androidx.lifecycle.viewmodel.compose.viewModel(
                    factory = com.vectis.erp.feature.inventory.InventoryViewModel.Factory(inventoryRepo, secureStorage, permissionManager)
                )

                com.vectis.erp.feature.products.ProductsScreen(
                    viewModel = viewModel
                )
            }
            composable(Screen.Customers.route) {
                val app = androidx.compose.ui.platform.LocalContext.current.applicationContext as com.vectis.erp.VectisApplication
                val customerRepo = remember { com.vectis.erp.data.repository.CustomerRepositoryImpl(app.networkClient) }
                val permissionManager = remember { com.vectis.erp.core.authorization.PermissionManager(secureStorage) }
                val viewModel: com.vectis.erp.feature.customers.CustomerViewModel = androidx.lifecycle.viewmodel.compose.viewModel(
                    factory = com.vectis.erp.feature.customers.CustomerViewModel.Factory(customerRepo, secureStorage, permissionManager)
                )

                com.vectis.erp.feature.customers.CustomerListScreen(
                    viewModel = viewModel,
                    onCustomerClick = { customerId ->
                        navController.navigate(Screen.CustomerDetail.createRoute(customerId))
                    }
                )
            }
            composable(Screen.CustomerDetail.route) { backStackEntry ->
                val customerId = backStackEntry.arguments?.getString("customerId") ?: ""
                val app = androidx.compose.ui.platform.LocalContext.current.applicationContext as com.vectis.erp.VectisApplication
                val customerRepo = remember { com.vectis.erp.data.repository.CustomerRepositoryImpl(app.networkClient) }
                val permissionManager = remember { com.vectis.erp.core.authorization.PermissionManager(secureStorage) }
                val viewModel: com.vectis.erp.feature.customers.CustomerViewModel = androidx.lifecycle.viewmodel.compose.viewModel(
                    factory = com.vectis.erp.feature.customers.CustomerViewModel.Factory(customerRepo, secureStorage, permissionManager)
                )

                com.vectis.erp.feature.customers.CustomerDetailScreen(
                    customerId = customerId,
                    viewModel = viewModel,
                    onNavigateBack = { navController.popBackStack() },
                    onOrderClick = { orderId ->
                        navController.navigate(Screen.OrderDetail.createRoute(orderId))
                    }
                )
            }
            composable(Screen.Inventory.route) {
                val app = androidx.compose.ui.platform.LocalContext.current.applicationContext as com.vectis.erp.VectisApplication
                val inventoryRepo = remember { com.vectis.erp.data.repository.ProductInventoryRepositoryImpl(app.networkClient) }
                val permissionManager = remember { com.vectis.erp.core.authorization.PermissionManager(secureStorage) }
                val viewModel: com.vectis.erp.feature.inventory.InventoryViewModel = androidx.lifecycle.viewmodel.compose.viewModel(
                    factory = com.vectis.erp.feature.inventory.InventoryViewModel.Factory(inventoryRepo, secureStorage, permissionManager)
                )

                com.vectis.erp.feature.inventory.InventoryScreen(
                    viewModel = viewModel
                )
            }
            composable(Screen.Alerts.route) {
                val app = androidx.compose.ui.platform.LocalContext.current.applicationContext as com.vectis.erp.VectisApplication
                val alertRepo = remember { com.vectis.erp.data.repository.AlertRepositoryImpl(app.networkClient) }
                val viewModel: com.vectis.erp.feature.alerts.AlertsViewModel = androidx.lifecycle.viewmodel.compose.viewModel(
                    factory = com.vectis.erp.feature.alerts.AlertsViewModel.Factory(alertRepo, secureStorage)
                )

                com.vectis.erp.feature.alerts.AlertsScreen(
                    viewModel = viewModel,
                    onOrderClick = { orderId ->
                        navController.navigate(Screen.OrderDetail.createRoute(orderId))
                    },
                    onNavigateBack = { navController.popBackStack() }
                )
            }
            composable(Screen.Settings.route) {
                val app = androidx.compose.ui.platform.LocalContext.current.applicationContext as com.vectis.erp.VectisApplication
                val settingsRepo = remember { com.vectis.erp.data.repository.SettingsRepositoryImpl(app.networkClient) }
                val viewModel: com.vectis.erp.feature.settings.SettingsViewModel = androidx.lifecycle.viewmodel.compose.viewModel(
                    factory = com.vectis.erp.feature.settings.SettingsViewModel.Factory(settingsRepo, secureStorage)
                )

                com.vectis.erp.feature.settings.SettingsScreen(
                    viewModel = viewModel,
                    onNavigateToLogin = {
                        navController.navigate(Screen.Login.route) {
                            popUpTo(0) { inclusive = true }
                        }
                    },
                    onNavigateToPairing = {
                        navController.navigate(Screen.Pairing.route) {
                            popUpTo(0) { inclusive = true }
                        }
                    },
                    onNavigateBack = { navController.popBackStack() }
                )
            }
        }

        if (showGlobalSearch) {
            com.vectis.erp.feature.search.GlobalSearchDialog(
                viewModel = searchViewModel,
                onDismiss = { showGlobalSearch = false },
                onResultClick = { result ->
                    showGlobalSearch = false
                    when (result.type.lowercase()) {
                        "customer" -> navController.navigate(Screen.CustomerDetail.createRoute(result.id))
                        "order" -> navController.navigate(Screen.OrderDetail.createRoute(result.id))
                        "product" -> navController.navigate(Screen.Products.route)
                        "account", "license", "inventory" -> navController.navigate(Screen.Inventory.route)
                        else -> {
                            result.route?.let { r ->
                                if (r.contains("customer")) navController.navigate(Screen.CustomerDetail.createRoute(result.id))
                                else if (r.contains("order")) navController.navigate(Screen.OrderDetail.createRoute(result.id))
                                else if (r.contains("product")) navController.navigate(Screen.Products.route)
                                else navController.navigate(Screen.Inventory.route)
                            }
                        }
                    }
                }
            )
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
