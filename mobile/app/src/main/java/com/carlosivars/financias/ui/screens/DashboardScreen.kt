package com.carlosivars.financias.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.carlosivars.financias.model.Category
import com.carlosivars.financias.model.Transaction
import com.carlosivars.financias.model.TransactionType
import com.carlosivars.financias.ui.theme.*
import java.util.Locale

@Composable
fun DashboardScreen(
    transactions: List<Transaction>,
    isTrackerActive: Boolean,
    onNavigateToTransactions: () -> Unit,
    onOpenAddTransaction: (TransactionType) -> Unit,
    onTriggerTestBizum: () -> Unit,
    onOpenSettings: () -> Unit
) {
    val totalIncome = transactions.filter { it.type == TransactionType.INCOME }.sumOf { it.amount }
    val totalExpense = transactions.filter { it.type == TransactionType.EXPENSE }.sumOf { it.amount }
    val netBalance = totalIncome - totalExpense

    val savingsRate = if (totalIncome > 0) {
        ((totalIncome - totalExpense) / totalIncome * 100).coerceAtLeast(0.0)
    } else {
        0.0
    }

    val recentTransactions = transactions.take(5)

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(DarkBackground)
            .padding(horizontal = 20.dp),
        contentPadding = PaddingValues(top = 20.dp, bottom = 100.dp),
        verticalArrangement = Arrangement.spacedBy(20.dp)
    ) {
        // 1. Header con estado y ajustes
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("💰", fontSize = 24.sp)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "FinancIAs",
                            color = TextPrimary,
                            fontSize = 24.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                    Text(
                        text = "Gestión inteligente de finanzas",
                        color = TextSecondary,
                        fontSize = 13.sp
                    )
                }

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Surface(
                        color = if (isTrackerActive) IncomeGreen.copy(alpha = 0.15f) else ExpenseRed.copy(alpha = 0.15f),
                        shape = RoundedCornerShape(16.dp),
                        border = CardDefaults.outlinedCardBorder().copy(
                            brush = androidx.compose.ui.graphics.SolidColor(
                                if (isTrackerActive) IncomeGreen.copy(alpha = 0.4f) else ExpenseRed.copy(alpha = 0.4f)
                            )
                        )
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(8.dp)
                                    .background(
                                        color = if (isTrackerActive) IncomeGreen else ExpenseRed,
                                        shape = CircleShape
                                    )
                            )
                            Text(
                                text = if (isTrackerActive) "Rastreo activo" else "Inactivo",
                                color = if (isTrackerActive) IncomeGreen else ExpenseRed,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.SemiBold
                            )
                        }
                    }

                    IconButton(
                        onClick = onOpenSettings,
                        modifier = Modifier.size(36.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Settings,
                            contentDescription = "Ajustes",
                            tint = TextSecondary
                        )
                    }
                }
            }
        }

        // 2. Tarjeta Balance Principal
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = CardBackground),
                shape = RoundedCornerShape(24.dp)
            ) {
                Column(
                    modifier = Modifier.padding(24.dp)
                ) {
                    Text(
                        text = "Balance total",
                        color = TextSecondary,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Medium
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = String.format(Locale.GERMANY, "%,.2f €", netBalance),
                        color = TextPrimary,
                        fontSize = 36.sp,
                        fontWeight = FontWeight.ExtraBold
                    )

                    Spacer(modifier = Modifier.height(20.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        // Ingresos
                        Column(modifier = Modifier.weight(1f)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Box(
                                    modifier = Modifier
                                        .size(24.dp)
                                        .background(IncomeGreen.copy(alpha = 0.2f), shape = CircleShape),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(Icons.Default.ArrowDownward, contentDescription = null, tint = IncomeGreen, modifier = Modifier.size(14.dp))
                                }
                                Spacer(modifier = Modifier.width(6.dp))
                                Text("Ingresos", color = TextSecondary, fontSize = 12.sp)
                            }
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = String.format(Locale.GERMANY, "+%,.2f €", totalIncome),
                                color = IncomeGreen,
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }

                        // Gastos
                        Column(modifier = Modifier.weight(1f)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Box(
                                    modifier = Modifier
                                        .size(24.dp)
                                        .background(ExpenseRed.copy(alpha = 0.2f), shape = CircleShape),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(Icons.Default.ArrowUpward, contentDescription = null, tint = ExpenseRed, modifier = Modifier.size(14.dp))
                                }
                                Spacer(modifier = Modifier.width(6.dp))
                                Text("Gastos", color = TextSecondary, fontSize = 12.sp)
                            }
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = String.format(Locale.GERMANY, "-%,.2f €", totalExpense),
                                color = ExpenseRed,
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }

                        // Ahorro
                        Column(modifier = Modifier.weight(0.9f)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Box(
                                    modifier = Modifier
                                        .size(24.dp)
                                        .background(PrimaryAccent.copy(alpha = 0.2f), shape = CircleShape),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(Icons.Default.Savings, contentDescription = null, tint = PrimaryAccent, modifier = Modifier.size(14.dp))
                                }
                                Spacer(modifier = Modifier.width(6.dp))
                                Text("Ahorro", color = TextSecondary, fontSize = 12.sp)
                            }
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = String.format(Locale.GERMANY, "%.1f %%", savingsRate),
                                color = PrimaryAccent,
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }
            }
        }

        // 3. Acciones Rápidas
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                OutlinedButton(
                    onClick = { onOpenAddTransaction(TransactionType.EXPENSE) },
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = TextPrimary),
                    contentPadding = PaddingValues(vertical = 12.dp)
                ) {
                    Icon(Icons.Default.Remove, contentDescription = null, tint = ExpenseRed, modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Gasto", fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                }

                OutlinedButton(
                    onClick = { onOpenAddTransaction(TransactionType.INCOME) },
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = TextPrimary),
                    contentPadding = PaddingValues(vertical = 12.dp)
                ) {
                    Icon(Icons.Default.Add, contentDescription = null, tint = IncomeGreen, modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Ingreso", fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                }

                OutlinedButton(
                    onClick = onTriggerTestBizum,
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = TextPrimary),
                    contentPadding = PaddingValues(vertical = 12.dp)
                ) {
                    Icon(Icons.Default.FlashOn, contentDescription = null, tint = Color(0xFFF59E0B), modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Bizum Test", fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                }
            }
        }

        // 4. Encabezado de Últimos Movimientos
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Últimos movimientos",
                    color = TextPrimary,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold
                )

                if (transactions.isNotEmpty()) {
                    Text(
                        text = "Ver todos (${transactions.size})",
                        color = PrimaryAccent,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.clickable { onNavigateToTransactions() }
                    )
                }
            }
        }

        // 5. Lista de transacciones o Estado Vacío
        if (recentTransactions.isEmpty()) {
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = CardBackground),
                    shape = RoundedCornerShape(16.dp)
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(32.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Icon(
                            imageVector = Icons.Default.AccountBalanceWallet,
                            contentDescription = null,
                            tint = TextSecondary.copy(alpha = 0.4f),
                            modifier = Modifier.size(48.dp)
                        )
                        Spacer(modifier = Modifier.height(12.dp))
                        Text(
                            text = "No hay movimientos registrados",
                            color = TextPrimary,
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 15.sp
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = "Los pagos de Sabadell, Wallet y Bizum aparecerán automáticamente aquí.",
                            color = TextSecondary,
                            fontSize = 13.sp,
                            textAlign = androidx.compose.ui.text.style.TextAlign.Center
                        )
                    }
                }
            }
        } else {
            items(recentTransactions, key = { it.id }) { tx ->
                TransactionRowItem(tx)
            }
        }
    }
}

@Composable
fun TransactionRowItem(tx: Transaction) {
    val isIncome = tx.type == TransactionType.INCOME
    val amountColor = if (isIncome) IncomeGreen else ExpenseRed
    val prefix = if (isIncome) "+" else "-"

    val category = Category.findByName(tx.category)
    val catColor = try {
        Color(android.graphics.Color.parseColor(category.colorHex))
    } catch (_: Exception) {
        PrimaryAccent
    }

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = CardBackground),
        shape = RoundedCornerShape(16.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.weight(1f)
            ) {
                Box(
                    modifier = Modifier
                        .size(44.dp)
                        .background(catColor.copy(alpha = 0.15f), shape = RoundedCornerShape(12.dp)),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = if (isIncome) "💰" else when (category.id) {
                            "food" -> "🛒"
                            "transport" -> "⛽"
                            "leisure" -> "🍔"
                            "housing" -> "🏠"
                            "health" -> "💊"
                            "subscriptions" -> "📱"
                            "transfers" -> "💸"
                            else -> "💳"
                        },
                        fontSize = 20.sp
                    )
                }

                Spacer(modifier = Modifier.width(12.dp))

                Column {
                    Text(
                        text = tx.description,
                        color = TextPrimary,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 1,
                        overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis
                    )
                    Spacer(modifier = Modifier.height(2.dp))
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Text(
                            text = tx.category,
                            color = catColor,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Medium
                        )
                        Text("•", color = TextSecondary, fontSize = 10.sp)
                        Text(
                            text = tx.date,
                            color = TextSecondary,
                            fontSize = 11.sp
                        )
                    }
                }
            }

            Text(
                text = String.format(Locale.GERMANY, "%s%,.2f €", prefix, tx.amount),
                color = amountColor,
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold
            )
        }
    }
}

