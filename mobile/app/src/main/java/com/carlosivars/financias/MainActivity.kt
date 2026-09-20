package com.carlosivars.financias

import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.lifecycleScope
import com.carlosivars.financias.data.TransactionRepository
import com.carlosivars.financias.model.TransactionType
import com.carlosivars.financias.ui.components.AddTransactionDialog
import com.carlosivars.financias.ui.navigation.FinancIAsTab
import com.carlosivars.financias.ui.screens.*
import com.carlosivars.financias.ui.theme.*
import com.carlosivars.financias.utils.NotificationUtils
import com.carlosivars.financias.utils.TestNotificationHelper
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {

    private lateinit var repository: TransactionRepository

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        repository = TransactionRepository(applicationContext)

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
            FinancIAsTheme {
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

                var selectedTab by remember { mutableStateOf(FinancIAsTab.DASHBOARD) }
                var isInSettings by remember { mutableStateOf(false) }
                var showAddTransactionDialog by remember { mutableStateOf(false) }
                var addTransactionInitialType by remember { mutableStateOf(TransactionType.EXPENSE) }

                val coroutineScope = rememberCoroutineScope()

                Scaffold(
                    containerColor = DarkBackground,
                    bottomBar = {
                        NavigationBar(
                            containerColor = CardBackground,
                            tonalElevation = 8.dp
                        ) {
                            FinancIAsTab.values().forEach { tab ->
                                val isSelected = selectedTab == tab
                                NavigationBarItem(
                                    selected = isSelected,
                                    onClick = { selectedTab = tab },
                                    icon = {
                                        Icon(
                                            imageVector = tab.icon,
                                            contentDescription = tab.title,
                                            tint = if (isSelected) PrimaryAccent else TextSecondary
                if (isInSettings) {
                    SettingsScreen(
                        securePrefs = repository.securePrefs,
                        totalTransactionsCount = transactions.size,
                        onBackClick = { isInSettings = false },
                        onExportBackup = { repository.exportBackupJson() },
                        onRestoreBackup = { json -> repository.restoreBackupJson(json) },
                        onTestConnection = { url, token -> repository.testCloudConnection(url, token) },
                        onClearAllData = { repository.clearAll() },
                        onOpenNotificationSettings = {
                            NotificationUtils.openNotificationListenerSettings(this@MainActivity)
                        }
                    )
                } else {
                    Scaffold(
                        containerColor = DarkBackground,
                        bottomBar = {
                            NavigationBar(
                                containerColor = CardBackground,
                                tonalElevation = 8.dp
                            ) {
                                FinancIAsTab.values().forEach { tab ->
                                    val isSelected = selectedTab == tab
                                    NavigationBarItem(
                                        selected = isSelected,
                                        onClick = { selectedTab = tab },
                                        icon = {
                                            Icon(
                                                imageVector = tab.icon,
                                                contentDescription = tab.title,
                                                tint = if (isSelected) PrimaryAccent else TextSecondary
                                            )
                                        },
                                        label = {
                                            Text(
                                                text = tab.title,
                                                color = if (isSelected) PrimaryAccent else TextSecondary,
                                                fontSize = 11.sp
                                            )
                                        },
                                        colors = NavigationBarItemDefaults.colors(
                                            indicatorColor = PrimaryAccent.copy(alpha = 0.15f)
                                        )
                                    },
                                    label = {
                                        Text(
                                            text = tab.title,
                                            color = if (isSelected) PrimaryAccent else TextSecondary,
                                            fontSize = 11.sp
                                        )
                                    },
                                    colors = NavigationBarItemDefaults.colors(
                                        indicatorColor = PrimaryAccent.copy(alpha = 0.15f)
                                    )
                                )
                                }
                            }
                        }
                    }
                ) { innerPadding ->
                    Surface(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(bottom = innerPadding.calculateBottomPadding()),
                        color = DarkBackground
                    ) {
                        when (selectedTab) {
                            FinancIAsTab.DASHBOARD -> {
                                DashboardScreen(
                                    transactions = transactions,
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
                    ) { innerPadding ->
                        Surface(
                            modifier = Modifier
                                .fillMaxSize()
                                .padding(bottom = innerPadding.calculateBottomPadding()),
                            color = DarkBackground
                        ) {
                            when (selectedTab) {
                                FinancIAsTab.DASHBOARD -> {
                                    DashboardScreen(
                                        transactions = transactions,
                                        isTrackerActive = isPermissionGranted,
                                        onNavigateToTransactions = { selectedTab = FinancIAsTab.TRANSACTIONS },
                                        onOpenAddTransaction = { type ->
                                            addTransactionInitialType = type
                                            showAddTransactionDialog = true
                                        },
                                        onTriggerTestBizum = {
                                            TestNotificationHelper.sendFakeSabadellBizumReceived(this@MainActivity, 10.0, "Carlos")
                                        },
                                        onOpenSettings = { isInSettings = true }
                                    )
                                }

                            FinancIAsTab.TRANSACTIONS -> {
                                TransactionsScreen(
                                    transactions = transactions,
                                    onAddTransactionClick = {
                                        addTransactionInitialType = TransactionType.EXPENSE
                                        showAddTransactionDialog = true
                                    },
                                    onDeleteTransaction = { txId ->
                                        coroutineScope.launch {
                                            repository.deleteTransaction(txId)
                                FinancIAsTab.TRANSACTIONS -> {
                                    TransactionsScreen(
                                        transactions = transactions,
                                        onAddTransactionClick = {
                                            addTransactionInitialType = TransactionType.EXPENSE
                                            showAddTransactionDialog = true
                                        },
                                        onDeleteTransaction = { txId ->
                                            coroutineScope.launch {
                                                repository.deleteTransaction(txId)
                                            }
                                        }
                                    }
                                )
                            }
                                    )
                                }

                            FinancIAsTab.ANALYTICS -> {
                                AnalyticsScreen(
                                    transactions = transactions
                                )
                            }
                                FinancIAsTab.ANALYTICS -> {
                                    AnalyticsScreen(
                                        transactions = transactions
                                    )
                                }

                            FinancIAsTab.BUDGETS -> {
                                BudgetScreen(
                                    budgets = budgets,
                                    transactions = transactions,
                                    onSaveBudget = { catId, catName, limit, colorHex ->
                                        coroutineScope.launch {
                                            repository.setBudget(catId, catName, limit, colorHex)
                                FinancIAsTab.BUDGETS -> {
                                    BudgetScreen(
                                        budgets = budgets,
                                        transactions = transactions,
                                        onSaveBudget = { catId, catName, limit, colorHex ->
                                            coroutineScope.launch {
                                                repository.setBudget(catId, catName, limit, colorHex)
                                            }
                                        }
                                    }
                                )
                            }
                                    )
                                }

                            FinancIAsTab.BANKING -> {
                                BankingHubScreen(
                                    isTrackerActive = isPermissionGranted,
                                    onOpenSettings = {
                                        NotificationUtils.openNotificationListenerSettings(this@MainActivity)
                                    },
                                    onTriggerTestBizum = {
                                        TestNotificationHelper.sendFakeSabadellBizumReceived(this@MainActivity, 10.0, "Carlos")
                                    },
                                    onTriggerTestSabadellCard = {
                                        TestNotificationHelper.sendFakeSabadellCardPayment(this@MainActivity, 34.0, "Mercadona")
                                    },
                                    onTriggerTestWallet = {
                                        TestNotificationHelper.sendFakeWalletNotification(this@MainActivity, 45.0, "Repsol")
                                    }
                                )
                                FinancIAsTab.BANKING -> {
                                    BankingHubScreen(
                                        isTrackerActive = isPermissionGranted,
                                        onOpenSettings = {
                                            NotificationUtils.openNotificationListenerSettings(this@MainActivity)
                                        },
                                        onTriggerTestBizum = {
                                            TestNotificationHelper.sendFakeSabadellBizumReceived(this@MainActivity, 10.0, "Carlos")
                                        },
                                        onTriggerTestSabadellCard = {
                                            TestNotificationHelper.sendFakeSabadellCardPayment(this@MainActivity, 34.0, "Mercadona")
                                        },
                                        onTriggerTestWallet = {
                                            TestNotificationHelper.sendFakeWalletNotification(this@MainActivity, 45.0, "Repsol")
                                        }
                                    )
                                }
                            }
                        }
                    }
                }

                // Modal Añadir Transacción
                if (showAddTransactionDialog) {
                    AddTransactionDialog(
                        onDismiss = { showAddTransactionDialog = false },
                        onConfirm = { desc, amount, type, category ->
                            coroutineScope.launch {
                                repository.addManualTransaction(desc, amount, type, category)
                                showAddTransactionDialog = false
                            }
                        }
                    )
                }
            }
        }
    }
}
