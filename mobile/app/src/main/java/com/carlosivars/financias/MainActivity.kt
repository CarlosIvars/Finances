package com.carlosivars.financias

import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.Alignment
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Sync
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.activity.compose.BackHandler
import com.carlosivars.financias.data.TransactionRepository
import com.carlosivars.financias.model.TransactionType
import com.carlosivars.financias.ui.components.AddTransactionDialog
import com.carlosivars.financias.ui.components.MergeConflictDialog
import com.carlosivars.financias.ui.navigation.FinancIAsTab
import com.carlosivars.financias.ui.navigation.SubScreen
import com.carlosivars.financias.ui.screens.*
import com.carlosivars.financias.ui.theme.*
import com.carlosivars.financias.utils.NotificationUtils
import com.carlosivars.financias.utils.TestNotificationHelper
import com.carlosivars.financias.sync.HourlySyncWorker
import kotlinx.coroutines.launch

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.ui.text.font.FontWeight
import androidx.lifecycle.lifecycleScope

class MainActivity : ComponentActivity() {

    private lateinit var repository: TransactionRepository

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        repository = TransactionRepository(applicationContext)
        HourlySyncWorker.schedule(applicationContext)

        // Inicializar presupuestos por defecto si no existen
        lifecycleScope.launch {
            repository.initDefaultBudgetsIfEmpty()
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(arrayOf(android.Manifest.permission.POST_NOTIFICATIONS), 101)
            }
        }

        setContent {
            val systemInDark = isSystemInDarkTheme()
            var currentThemePref by remember { mutableStateOf(repository.securePrefs.appTheme) }
            val isDarkTheme = when (currentThemePref) {
                "LIGHT" -> false
                "DARK" -> true
                else -> systemInDark
            }

            FinancIAsTheme(darkTheme = isDarkTheme) {
                val lifecycleOwner = LocalLifecycleOwner.current
                var isPermissionGranted by remember {
                    mutableStateOf(NotificationUtils.isNotificationListenerEnabled(this))
                }

                DisposableEffect(lifecycleOwner) {
                    val observer = LifecycleEventObserver { _, event ->
                        if (event == Lifecycle.Event.ON_RESUME) {
                            isPermissionGranted = NotificationUtils.isNotificationListenerEnabled(this@MainActivity)
                        }
                    }
                    lifecycleOwner.lifecycle.addObserver(observer)
                    onDispose {
                        lifecycleOwner.lifecycle.removeObserver(observer)
                    }
                }

                val transactions by repository.allTransactions.collectAsState(initial = emptyList())
                val budgets by repository.allBudgets.collectAsState(initial = emptyList())
                val categories by repository.allCategories.collectAsState(initial = emptyList())
                val activeConflict by repository.activeConflict.collectAsState(initial = null)

                var selectedTab by remember { mutableStateOf(FinancIAsTab.DASHBOARD) }
                var activeSubScreen by remember { mutableStateOf<SubScreen?>(null) }
                var showAddTransactionDialog by remember { mutableStateOf(false) }
                var addTransactionInitialType by remember { mutableStateOf(TransactionType.EXPENSE) }
                var isSyncing by remember { mutableStateOf(false) }

                val coroutineScope = rememberCoroutineScope()

                BackHandler(enabled = activeSubScreen != null) {
                    activeSubScreen = null
                }

                if (activeSubScreen != null) {
                    Surface(
                        modifier = Modifier.fillMaxSize(),
                        color = MaterialTheme.colorScheme.background
                    ) {
                        when (activeSubScreen) {
                            SubScreen.SETTINGS -> {
                                SettingsScreen(
                                    securePrefs = repository.securePrefs,
                                    totalTransactionsCount = transactions.size,
                                    onBackClick = { 
                                        currentThemePref = repository.securePrefs.appTheme
                                        activeSubScreen = null 
                                    },
                                    onExportBackup = { repository.exportBackupJson() },
                                    onRestoreBackup = { json -> repository.restoreBackupJson(json) },
                                    onTestConnection = { url, token, cfId, cfSecret -> repository.testCloudConnection(url, token, cfId, cfSecret) },
                                    onPerformSync = { repository.performSync() },
                                    onClearAllData = { repository.clearAll() },
                                    onOpenNotificationSettings = {
                                        NotificationUtils.openNotificationListenerSettings(this@MainActivity)
                                    },
                                    onThemeChanged = { newTheme ->
                                        currentThemePref = newTheme
                                    }
                                )
                            }
                            SubScreen.BANKING -> {
                                BankingHubScreen(
                                    securePrefs = repository.securePrefs,
                                    isTrackerActive = isPermissionGranted,
                                    onOpenSettings = {
                                        activeSubScreen = SubScreen.SETTINGS
                                    },
                                    onTriggerTestBizum = {
                                        TestNotificationHelper.sendFakeSabadellBizumReceived(this@MainActivity, 10.0, "Carlos")
                                    },
                                    onTriggerTestSabadellCard = {
                                        TestNotificationHelper.sendFakeSabadellCardPayment(this@MainActivity, 34.0, "Mercadona")
                                    },
                                    onTriggerTestWallet = {
                                        TestNotificationHelper.sendFakeWalletNotification(this@MainActivity, 45.0, "Repsol")
                                    },
                                    onTriggerTestBbva = {
                                        TestNotificationHelper.sendFakeBbvaPayment(this@MainActivity, 18.50, "ZARA")
                                    },
                                    onTriggerTestSantander = {
                                        TestNotificationHelper.sendFakeSantanderPayment(this@MainActivity, 22.0, "Decathlon")
                                    },
                                    onTriggerTestRevolut = {
                                        TestNotificationHelper.sendFakeRevolutPayment(this@MainActivity, 9.20, "Starbucks")
                                    },
                                    onBackClick = { activeSubScreen = null }
                                )
                            }
                            SubScreen.CATEGORIES -> {
                                CategoriesScreen(
                                    categories = categories,
                                    onBackClick = { activeSubScreen = null }
                                )
                            }
                            SubScreen.INSIGHTS -> {
                                InsightsScreen(
                                    transactions = transactions,
                                    onBackClick = { activeSubScreen = null }
                                )
                            }
                            SubScreen.PRIVACY -> {
                                PrivacyScreen(
                                    isNotificationListenerActive = isPermissionGranted,
                                    onOpenNotificationSettings = {
                                        NotificationUtils.openNotificationListenerSettings(this@MainActivity)
                                    },
                                    onExportData = {
                                        coroutineScope.launch {
                                            val json = repository.exportBackupJson()
                                            val sendIntent = android.content.Intent().apply {
                                                action = android.content.Intent.ACTION_SEND
                                                putExtra(android.content.Intent.EXTRA_TEXT, json)
                                                type = "application/json"
                                            }
                                            val shareIntent = android.content.Intent.createChooser(sendIntent, "Exportar Copia de Seguridad")
                                            startActivity(shareIntent)
                                        }
                                    },
                                    onClearAllData = {
                                        coroutineScope.launch {
                                            repository.clearAll()
                                        }
                                    },
                                    onBackClick = { activeSubScreen = null }
                                )
                            }
                            null -> {}
                        }
                    }
                } else {
                    Box(modifier = Modifier.fillMaxSize()) {
                    Scaffold(
                        containerColor = MaterialTheme.colorScheme.background,
                        bottomBar = {
                            NavigationBar(
                                containerColor = MaterialTheme.colorScheme.surface,
                                tonalElevation = 6.dp
                            ) {
                                FinancIAsTab.values().forEach { tab ->
                                    val isSelected = selectedTab == tab
                                    NavigationBarItem(
                                        selected = isSelected,
                                        onClick = { selectedTab = tab },
                                        icon = {
                                            Icon(
                                                imageVector = tab.icon,
                                                contentDescription = tab.title
                                            )
                                        },
                                        label = {
                                            Text(
                                                text = tab.title,
                                                fontSize = 10.sp,
                                                fontWeight = if (isSelected) FontWeight.SemiBold else FontWeight.Normal,
                                                maxLines = 1,
                                                softWrap = false
                                            )
                                        },
                                        colors = NavigationBarItemDefaults.colors(
                                            selectedIconColor = MaterialTheme.colorScheme.primary,
                                            selectedTextColor = MaterialTheme.colorScheme.primary,
                                            unselectedIconColor = MaterialTheme.colorScheme.onSurfaceVariant,
                                            unselectedTextColor = MaterialTheme.colorScheme.onSurfaceVariant,
                                            indicatorColor = MaterialTheme.colorScheme.primary.copy(alpha = 0.15f)
                                        )
                                    )
                                }
                            }
                        }
                    ) { innerPadding ->
                        Surface(
                            modifier = Modifier
                                .fillMaxSize()
                                .statusBarsPadding()
                                .padding(bottom = innerPadding.calculateBottomPadding()),
                            color = MaterialTheme.colorScheme.background
                        ) {
                            when (selectedTab) {
                                FinancIAsTab.DASHBOARD -> {
                                    DashboardScreen(
                                        transactions = transactions,
                                        categories = categories,
                                        isTrackerActive = isPermissionGranted,
                                        onNavigateToTransactions = { selectedTab = FinancIAsTab.TRANSACTIONS },
                                        onOpenAddTransaction = { type ->
                                            addTransactionInitialType = type
                                            showAddTransactionDialog = true
                                        },
                                        onTriggerTestBizum = {
                                            TestNotificationHelper.sendFakeSabadellBizumReceived(this@MainActivity, 10.0, "Carlos")
                                        }
                                    )
                                }

                                FinancIAsTab.TRANSACTIONS -> {
                                    TransactionsScreen(
                                        transactions = transactions,
                                        categories = categories,
                                        onAddTransactionClick = {
                                            addTransactionInitialType = TransactionType.EXPENSE
                                            showAddTransactionDialog = true
                                        },
                                        onDeleteTransaction = { txId ->
                                            coroutineScope.launch {
                                                repository.deleteTransaction(txId)
                                            }
                                        },
                                        onRecategorizeTransaction = { txId, newCategory ->
                                            coroutineScope.launch {
                                                repository.updateCategory(
                                                    id = txId,
                                                    newCategory = newCategory.name,
                                                    categoryServerId = newCategory.id.toIntOrNull(),
                                                    parentCategory = newCategory.parentName
                                                )
                                            }
                                        }
                                    )
                                }

                                FinancIAsTab.ANALYTICS -> {
                                    AnalyticsScreen(
                                        transactions = transactions,
                                        categories = categories
                                    )
                                }

                                FinancIAsTab.BUDGETS -> {
                                    BudgetScreen(
                                        budgets = budgets,
                                        transactions = transactions,
                                        categories = categories,
                                        onSaveBudget = { catId, catName, limit, colorHex ->
                                            coroutineScope.launch {
                                                repository.setBudget(catId, catName, limit, colorHex)
                                            }
                                        }
                                    )
                                }

                                FinancIAsTab.MORE -> {
                                    HubScreen(
                                        onNavigateToSubScreen = { screen ->
                                            activeSubScreen = screen
                                        }
                                    )
                                }
                            }
                        }
                    }

                    FloatingActionButton(
                        onClick = {
                            if (!isSyncing) coroutineScope.launch {
                                isSyncing = true
                                repository.performSync()
                                isSyncing = false
                            }
                        },
                        modifier = Modifier
                            .align(Alignment.TopEnd)
                            .statusBarsPadding()
                            .padding(top = 8.dp, end = 16.dp),
                        containerColor = MaterialTheme.colorScheme.surface,
                        contentColor = MaterialTheme.colorScheme.primary,
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        if (isSyncing) {
                            CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
                        } else {
                            Icon(Icons.Default.Sync, contentDescription = "Sincronizar ahora", modifier = Modifier.size(20.dp))
                        }
                    }
                }
            }

                // Modal Añadir Transacción
                if (showAddTransactionDialog) {
                    AddTransactionDialog(
                        categories = categories,
                        onDismiss = { showAddTransactionDialog = false },
                        onConfirm = { desc, amount, type, category ->
                            coroutineScope.launch {
                                repository.addManualTransaction(desc, amount, type, category.name, category.id.toIntOrNull())
                                showAddTransactionDialog = false
                            }
                        }
                    )
                }

                // Diálogo Merge Editor ante conflicto de sincronización
                activeConflict?.let { conflict ->
                    MergeConflictDialog(
                        conflict = conflict,
                        categories = categories,
                        onResolve = { keepLocal ->
                            coroutineScope.launch {
                                repository.resolveConflict(conflict, keepLocal)
                            }
                        },
                        onDismiss = {
                            repository.dismissConflict()
                        }
                    )
                }
            }
        }
    }
}
