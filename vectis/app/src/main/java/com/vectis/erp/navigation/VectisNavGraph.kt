package com.vectis.erp.navigation

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.input.nestedscroll.NestedScrollConnection
import androidx.compose.ui.input.nestedscroll.NestedScrollSource
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.vectis.erp.core.design.PrimaryBlue
import com.vectis.erp.core.design.Slate500
import com.vectis.erp.core.security.SecureStorage
import com.vectis.erp.feature.alerts.AlertsUiState
import com.vectis.erp.feature.customers.CustomerListUiState
import com.vectis.erp.feature.dashboard.DashboardUiState
import com.vectis.erp.feature.inventory.InventoryUiState
import com.vectis.erp.feature.orders.OrderListUiState
import com.vectis.erp.feature.settings.SettingsUiState
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun VectisNavGraph(
    secureStorage: SecureStorage,
    navController: NavHostController = rememberNavController(),
    deepLinkIntent: android.content.Intent? = null
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

    // Push Notification Deep Link Navigation Handler
    LaunchedEffect(deepLinkIntent) {
        val intent = deepLinkIntent ?: return@LaunchedEffect
        if (!secureStorage.isAuthenticated()) return@LaunchedEffect

        val orderId = intent.getStringExtra("deep_link_order_id")
            ?: if (intent.getStringExtra("deep_link_entity_type") == "order") intent.getStringExtra("deep_link_entity_id") else null
        val entityType = intent.getStringExtra("deep_link_entity_type")
        val type = intent.getStringExtra("deep_link_type")

        when {
            !orderId.isNullOrBlank() -> {
                navController.navigate(Screen.OrderDetail.createRoute(orderId))
            }
            entityType == "service_account" || type?.startsWith("SERVICE_ACCOUNT") == true -> {
                navController.navigate(Screen.Inventory.route)
            }
            entityType == "customer" || type?.startsWith("CUSTOMER") == true -> {
                val customerId = intent.getStringExtra("deep_link_entity_id")
                if (!customerId.isNullOrBlank()) {
                    navController.navigate(Screen.CustomerDetail.createRoute(customerId))
                } else {
                    navController.navigate(Screen.Customers.route)
                }
            }
            entityType == "plan" || type?.startsWith("PLAN") == true -> {
                navController.navigate(Screen.Products.route)
            }
            type == "PASSWORD_CHANGED" || type == "LOGIN_FAILED" -> {
                navController.navigate(Screen.Settings.route)
            }
        }
    }

    val syncPushTokenWithServer: () -> Unit = {
        if (secureStorage.isAuthenticated()) {
            CoroutineScope(Dispatchers.IO).launch {
                try {
                    // 1. Fetch dynamic client config from server
                    val clientConfigResult = app.notificationRepository.getClientConfig()
                    if (clientConfigResult is com.vectis.erp.core.network.ApiResult.Success && clientConfigResult.data != null) {
                        val configured = com.vectis.erp.core.notification.NotificationHelper.configureFirebaseAtRuntime(context, clientConfigResult.data)
                        if (configured) {
                            try {
                                com.google.firebase.messaging.FirebaseMessaging.getInstance().deleteToken()
                            } catch (_: Exception) {}
                        }
                    }

                    // 2. Request genuine FCM token
                    com.google.firebase.messaging.FirebaseMessaging.getInstance().token
                        .addOnSuccessListener { token ->
                            if (!token.isNullOrBlank()) {
                                secureStorage.setPushToken(token)
                                CoroutineScope(Dispatchers.IO).launch {
                                    app.notificationRepository.registerPushToken(token, secureStorage.getDeviceId())
                                }
                            }
                        }
                        .addOnFailureListener {
                            val fallback = secureStorage.getPushToken() ?: "dev-token-${secureStorage.getDeviceId() ?: System.currentTimeMillis()}"
                            secureStorage.setPushToken(fallback)
                            CoroutineScope(Dispatchers.IO).launch {
                                app.notificationRepository.registerPushToken(fallback, secureStorage.getDeviceId())
                            }
                        }
                } catch (_: Exception) {
                    val fallback = secureStorage.getPushToken() ?: "dev-token-${secureStorage.getDeviceId() ?: System.currentTimeMillis()}"
                    secureStorage.setPushToken(fallback)
                    CoroutineScope(Dispatchers.IO).launch {
                        app.notificationRepository.registerPushToken(fallback, secureStorage.getDeviceId())
                    }
                }
            }
        }
    }

    // Register Push Token on launch if already authenticated
    LaunchedEffect(Unit) {
        syncPushTokenWithServer()
    }
    val authRepo = remember { com.vectis.erp.data.repository.AuthRepositoryImpl(app.networkClient, secureStorage) }
    val alertRepo = remember { com.vectis.erp.data.repository.AlertRepositoryImpl(app.networkClient) }

    val preferredCurrency by secureStorage.preferredCurrencyFlow.collectAsState()
    var alertCount by remember { mutableStateOf(0) }

    LaunchedEffect(Unit) {
        delay(10_000)
        while (true) {
            if (secureStorage.isAuthenticated()) {
                val res = alertRepo.getAlerts()
                if (res is com.vectis.erp.core.network.ApiResult.Success) {
                    alertCount = res.data.badgeCount
                }
            }
            delay(15_000)
        }
    }

    val searchRepo = remember { com.vectis.erp.data.repository.SearchRepositoryImpl(app.networkClient) }
    val searchViewModel: com.vectis.erp.feature.search.SearchViewModel = androidx.lifecycle.viewmodel.compose.viewModel(
        factory = com.vectis.erp.feature.search.SearchViewModel.Factory(searchRepo)
    )
    var showGlobalSearch by remember { mutableStateOf(false) }

    val dashboardRepo = remember { com.vectis.erp.data.repository.DashboardRepositoryImpl(app.networkClient) }
    val orderRepo = remember { com.vectis.erp.data.repository.OrderRepositoryImpl(app.networkClient) }
    val customerRepo = remember { com.vectis.erp.data.repository.CustomerRepositoryImpl(app.networkClient) }
    val productRepo = remember { com.vectis.erp.data.repository.ProductInventoryRepositoryImpl(app.networkClient) }
    val permissionManager = remember { com.vectis.erp.core.authorization.PermissionManager(secureStorage) }
    val settingsRepo = remember { com.vectis.erp.data.repository.SettingsRepositoryImpl(app.networkClient) }

    val dashboardViewModel: com.vectis.erp.feature.dashboard.DashboardViewModel = androidx.lifecycle.viewmodel.compose.viewModel(
        factory = com.vectis.erp.feature.dashboard.DashboardViewModel.Factory(dashboardRepo, app.secureStorage, authRepo)
    )
    val orderViewModel: com.vectis.erp.feature.orders.OrderViewModel = androidx.lifecycle.viewmodel.compose.viewModel(
        factory = com.vectis.erp.feature.orders.OrderViewModel.Factory(orderRepo, customerRepo, productRepo, secureStorage, permissionManager, authRepo)
    )
    val inventoryViewModel: com.vectis.erp.feature.inventory.InventoryViewModel = androidx.lifecycle.viewmodel.compose.viewModel(
        factory = com.vectis.erp.feature.inventory.InventoryViewModel.Factory(productRepo, secureStorage, permissionManager, authRepo)
    )
    val customerViewModel: com.vectis.erp.feature.customers.CustomerViewModel = androidx.lifecycle.viewmodel.compose.viewModel(
        factory = com.vectis.erp.feature.customers.CustomerViewModel.Factory(customerRepo, secureStorage, permissionManager, authRepo)
    )
    val alertsViewModel: com.vectis.erp.feature.alerts.AlertsViewModel = androidx.lifecycle.viewmodel.compose.viewModel(
        factory = com.vectis.erp.feature.alerts.AlertsViewModel.Factory(alertRepo, orderRepo, secureStorage)
    )
    val settingsViewModel: com.vectis.erp.feature.settings.SettingsViewModel = androidx.lifecycle.viewmodel.compose.viewModel(
        factory = com.vectis.erp.feature.settings.SettingsViewModel.Factory(settingsRepo, secureStorage)
    )

    LaunchedEffect(Unit) {
        app.networkClient.deviceRevokedEvents.collect {
            navController.navigate(Screen.Pairing.route) {
                popUpTo(0) { inclusive = true }
            }
        }
    }

    LaunchedEffect(Unit) {
        app.networkClient.unauthorizedEvents.collect {
            val destination = if (secureStorage.isDevicePaired()) Screen.Login.route else Screen.Pairing.route
            if (navController.currentDestination?.route != destination) {
                navController.navigate(destination) {
                    popUpTo(0) { inclusive = true }
                }
            }
        }
    }

    // Periodic session keep-alive and profile sync (every 15 minutes) while authenticated
    LaunchedEffect(Unit) {
        delay(60_000)
        while (true) {
            if (secureStorage.isAuthenticated()) {
                authRepo.getMe()
            }
            delay(15 * 60_000L)
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

    val navItemClick: (String) -> Unit = { targetRoute ->
        if (currentRoute != targetRoute) {
            navController.navigate(targetRoute) {
                popUpTo(Screen.Dashboard.route) {
                    saveState = true
                }
                launchSingleTop = true
                restoreState = true
            }
        }
    }

    val handleLogout: () -> Unit = {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                authRepo.logout()
            } catch (_: Exception) {}
            withContext(Dispatchers.Main) {
                navController.navigate(Screen.Login.route) {
                    popUpTo(0) { inclusive = true }
                }
            }
        }
    }

    var isBottomBarVisible by remember { mutableStateOf(true) }

    LaunchedEffect(currentRoute) {
        isBottomBarVisible = true
    }

    val nestedScrollConnection = remember {
        object : NestedScrollConnection {
            override fun onPreScroll(available: Offset, source: NestedScrollSource): Offset {
                if (available.y < -8f) {
                    isBottomBarVisible = false
                } else if (available.y > 8f) {
                    isBottomBarVisible = true
                }
                return Offset.Zero
            }
        }
    }

    val animatedBottomBarOffset by animateDpAsState(
        targetValue = if (isBottomBarVisible) 0.dp else 140.dp,
        animationSpec = tween(
            durationMillis = 220,
            easing = FastOutSlowInEasing
        ),
        label = "BottomBarOffset"
    )

    CompositionLocalProvider(com.vectis.erp.core.design.LocalLogoutHandler provides handleLogout) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .nestedScroll(nestedScrollConnection)
        ) {
            NavHost(
                navController = navController,
                startDestination = startDestination,
                modifier = Modifier.fillMaxSize()
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
                        dashboardViewModel.loadStats()
                        orderViewModel.loadOrders(isRefresh = true)
                        inventoryViewModel.loadData(isRefresh = true)
                        customerViewModel.loadCustomers(isRefresh = true)
                        alertsViewModel.loadAlerts(isRefresh = true)
                        settingsViewModel.loadSettings(isRefresh = true)
                        syncPushTokenWithServer()
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
                LaunchedEffect(Unit) {
                    if (secureStorage.isAuthenticated() && dashboardViewModel.uiState.value !is DashboardUiState.Success) {
                        dashboardViewModel.loadStats()
                    }
                }
                com.vectis.erp.feature.dashboard.DashboardScreen(
                    viewModel = dashboardViewModel,
                    onNavigateToOrders = { navController.navigate(Screen.Orders.route) },
                    onNavigateToProducts = { navController.navigate(Screen.Products.route) },
                    onNavigateToInventory = { navController.navigate(Screen.Inventory.route) },
                    onNavigateToAlerts = { navController.navigate(Screen.Alerts.route) },
                    onNavigateToSettings = { navController.navigate(Screen.Settings.route) },
                    onOpenSearch = { showGlobalSearch = true }
                )
            }
            composable(Screen.Orders.route) {
                LaunchedEffect(Unit) {
                    if (secureStorage.isAuthenticated() && orderViewModel.listUiState.value !is OrderListUiState.Success) {
                        orderViewModel.loadOrders(isRefresh = true)
                    }
                }
                com.vectis.erp.feature.orders.OrderListScreen(
                    viewModel = orderViewModel,
                    preferredCurrency = preferredCurrency,
                    alertCount = alertCount,
                    onOpenSearch = { showGlobalSearch = true },
                    onNavigateToAlerts = { navController.navigate(Screen.Alerts.route) },
                    onNavigateToSettings = { navController.navigate(Screen.Settings.route) },
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
                com.vectis.erp.feature.orders.OrderDetailScreen(
                    orderId = orderId,
                    viewModel = orderViewModel,
                    onNavigateBack = { navController.popBackStack() }
                )
            }
            composable(Screen.CreateOrder.route) {
                com.vectis.erp.feature.orders.CreateOrderScreen(
                    viewModel = orderViewModel,
                    onNavigateBack = { navController.popBackStack() },
                    onOrderCreated = { newOrderId ->
                        navController.navigate(Screen.OrderDetail.createRoute(newOrderId)) {
                            popUpTo(Screen.Orders.route)
                        }
                    }
                )
            }
            composable(Screen.Products.route) {
                LaunchedEffect(Unit) {
                    if (secureStorage.isAuthenticated() && inventoryViewModel.uiState.value !is InventoryUiState.Success) {
                        inventoryViewModel.loadData(isRefresh = true)
                    }
                }
                com.vectis.erp.feature.products.ProductsScreen(
                    viewModel = inventoryViewModel,
                    preferredCurrency = preferredCurrency,
                    alertCount = alertCount,
                    onOpenSearch = { showGlobalSearch = true },
                    onNavigateToAlerts = { navController.navigate(Screen.Alerts.route) },
                    onNavigateToSettings = { navController.navigate(Screen.Settings.route) }
                )
            }
            composable(Screen.Customers.route) {
                LaunchedEffect(Unit) {
                    if (secureStorage.isAuthenticated() && customerViewModel.listUiState.value !is CustomerListUiState.Success) {
                        customerViewModel.loadCustomers(isRefresh = true)
                    }
                }
                com.vectis.erp.feature.customers.CustomerListScreen(
                    viewModel = customerViewModel,
                    preferredCurrency = preferredCurrency,
                    alertCount = alertCount,
                    onOpenSearch = { showGlobalSearch = true },
                    onNavigateToAlerts = { navController.navigate(Screen.Alerts.route) },
                    onNavigateToSettings = { navController.navigate(Screen.Settings.route) },
                    onCustomerClick = { customerId ->
                        navController.navigate(Screen.CustomerDetail.createRoute(customerId))
                    }
                )
            }
            composable(Screen.CustomerDetail.route) { backStackEntry ->
                val customerId = backStackEntry.arguments?.getString("customerId") ?: ""
                com.vectis.erp.feature.customers.CustomerDetailScreen(
                    customerId = customerId,
                    viewModel = customerViewModel,
                    onNavigateBack = { navController.popBackStack() },
                    onOrderClick = { orderId ->
                        navController.navigate(Screen.OrderDetail.createRoute(orderId))
                    }
                )
            }
            composable(Screen.Inventory.route) {
                LaunchedEffect(Unit) {
                    if (secureStorage.isAuthenticated() && inventoryViewModel.uiState.value !is InventoryUiState.Success) {
                        inventoryViewModel.loadData(isRefresh = true)
                    }
                }
                com.vectis.erp.feature.inventory.InventoryScreen(
                    viewModel = inventoryViewModel,
                    preferredCurrency = preferredCurrency,
                    alertCount = alertCount,
                    onOpenSearch = { showGlobalSearch = true },
                    onNavigateToAlerts = { navController.navigate(Screen.Alerts.route) },
                    onNavigateToSettings = { navController.navigate(Screen.Settings.route) }
                )
            }
            composable(Screen.Alerts.route) {
                LaunchedEffect(Unit) {
                    if (secureStorage.isAuthenticated() && alertsViewModel.uiState.value !is AlertsUiState.Success) {
                        alertsViewModel.loadAlerts(isRefresh = true)
                    }
                }
                com.vectis.erp.feature.alerts.AlertsScreen(
                    viewModel = alertsViewModel,
                    preferredCurrency = preferredCurrency,
                    onOpenSearch = { showGlobalSearch = true },
                    onNavigateToSettings = { navController.navigate(Screen.Settings.route) },
                    onOrderClick = { orderId ->
                        navController.navigate(Screen.OrderDetail.createRoute(orderId))
                    },
                    onNavigateBack = { navController.popBackStack() }
                )
            }
            composable(Screen.Settings.route) {
                LaunchedEffect(Unit) {
                    if (secureStorage.isAuthenticated() && settingsViewModel.uiState.value !is SettingsUiState.Success) {
                        settingsViewModel.loadSettings(isRefresh = true)
                    }
                }
                com.vectis.erp.feature.settings.SettingsScreen(
                    viewModel = settingsViewModel,
                    preferredCurrency = preferredCurrency,
                    alertCount = alertCount,
                    onOpenSearch = { showGlobalSearch = true },
                    onNavigateToAlerts = { navController.navigate(Screen.Alerts.route) },
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

        if (isMainScreen) {
            val navItemColors = NavigationBarItemDefaults.colors(
                selectedIconColor = PrimaryBlue,
                unselectedIconColor = Slate500,
                indicatorColor = Color.Transparent
            )
            Surface(
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .fillMaxWidth()
                    .offset(y = animatedBottomBarOffset),
                color = Color.White,
                shadowElevation = 8.dp
            ) {
                NavigationBar(
                    modifier = Modifier
                        .fillMaxWidth()
                        .navigationBarsPadding()
                        .height(56.dp),
                    containerColor = Color.White,
                    tonalElevation = 0.dp,
                    windowInsets = WindowInsets(0.dp, 0.dp, 0.dp, 0.dp)
                ) {
                    NavigationBarItem(
                        selected = currentRoute == Screen.Dashboard.route,
                        onClick = { navItemClick(Screen.Dashboard.route) },
                        icon = { Icon(Icons.Default.Dashboard, contentDescription = "Dashboard") },
                        colors = navItemColors
                    )
                    NavigationBarItem(
                        selected = currentRoute == Screen.Orders.route,
                        onClick = { navItemClick(Screen.Orders.route) },
                        icon = { Icon(Icons.Default.ShoppingCart, contentDescription = "Orders") },
                        colors = navItemColors
                    )
                    NavigationBarItem(
                        selected = currentRoute == Screen.Products.route,
                        onClick = { navItemClick(Screen.Products.route) },
                        icon = { Icon(Icons.Default.Inventory2, contentDescription = "Products") },
                        colors = navItemColors
                    )
                    NavigationBarItem(
                        selected = currentRoute == Screen.Inventory.route,
                        onClick = { navItemClick(Screen.Inventory.route) },
                        icon = { Icon(Icons.Default.Layers, contentDescription = "Inventory") },
                        colors = navItemColors
                    )
                    NavigationBarItem(
                        selected = currentRoute == Screen.Customers.route,
                        onClick = { navItemClick(Screen.Customers.route) },
                        icon = { Icon(Icons.Default.People, contentDescription = "Customers") },
                        colors = navItemColors
                    )
                }
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
