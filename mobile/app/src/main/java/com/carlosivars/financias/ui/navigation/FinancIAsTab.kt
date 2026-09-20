package com.carlosivars.financias.ui.navigation

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountBalance
import androidx.compose.material.icons.filled.AccountBalanceWallet
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.PieChart
import androidx.compose.material.icons.filled.ReceiptLong
import androidx.compose.ui.graphics.vector.ImageVector

enum class FinancIAsTab(
    val title: String,
    val icon: ImageVector
) {
    DASHBOARD("Inicio", Icons.Default.Home),
    TRANSACTIONS("Movimientos", Icons.Default.ReceiptLong),
    ANALYTICS("Análisis", Icons.Default.PieChart),
    BUDGETS("Presupuestos", Icons.Default.AccountBalanceWallet),
    BANKING("Bancos", Icons.Default.AccountBalance)
}

