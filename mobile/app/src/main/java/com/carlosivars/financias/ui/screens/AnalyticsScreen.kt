package com.carlosivars.financias.ui.screens

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.background
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
import androidx.compose.ui.draw.clip
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
fun AnalyticsScreen(
    transactions: List<Transaction>
) {
    val expenseTransactions = transactions.filter { it.type == TransactionType.EXPENSE }
    val totalExpense = expenseTransactions.sumOf { it.amount }
    val totalIncome = transactions.filter { it.type == TransactionType.INCOME }.sumOf { it.amount }

    // Agrupación por categoría
    val categoryTotals = remember(transactions) {
        expenseTransactions
            .groupBy { it.category }
            .mapValues { entry -> entry.value.sumOf { it.amount } }
            .toList()
            .sortedByDescending { it.second }
    }

    val topCategory = categoryTotals.firstOrNull()

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(DarkBackground)
            .padding(horizontal = 20.dp),
        contentPadding = PaddingValues(top = 20.dp, bottom = 100.dp),
        verticalArrangement = Arrangement.spacedBy(18.dp)
    ) {
        // Header
        item {
            Column {
                Text(
                    text = "Análisis Financiero",
                    color = TextPrimary,
                    fontSize = 24.sp,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = "Distribución y desglose de tus gastos",
                    color = TextSecondary,
                    fontSize = 13.sp
                )
            }
        }

        // Resumen General
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = CardBackground),
                shape = RoundedCornerShape(20.dp)
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(20.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text("Gasto Total Acumulado", color = TextSecondary, fontSize = 13.sp)
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = String.format(Locale.GERMANY, "%,.2f €", totalExpense),
                            color = ExpenseRed,
                            fontSize = 24.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }

                    Box(
                        modifier = Modifier
                            .size(48.dp)
                            .background(ExpenseRed.copy(alpha = 0.15f), shape = CircleShape),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.PieChart,
                            contentDescription = null,
                            tint = ExpenseRed,
                            modifier = Modifier.size(24.dp)
                        )
                    }
                }
            }
        }

        // Métricas Clave
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                // Top categoría
                Card(
                    modifier = Modifier.weight(1f),
                    colors = CardDefaults.cardColors(containerColor = CardBackground),
                    shape = RoundedCornerShape(16.dp)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text("Mayor Gasto", color = TextSecondary, fontSize = 12.sp)
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = topCategory?.first ?: "Sin datos",
                            color = TextPrimary,
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Bold,
                            maxLines = 1,
                            overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis
                        )
                        Spacer(modifier = Modifier.height(2.dp))
                        Text(
                            text = topCategory?.let { String.format(Locale.GERMANY, "%,.2f €", it.second) } ?: "-",
                            color = PrimaryAccent,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                }

                // Total operaciones
                Card(
                    modifier = Modifier.weight(1f),
                    colors = CardDefaults.cardColors(containerColor = CardBackground),
                    shape = RoundedCornerShape(16.dp)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text("Operaciones", color = TextSecondary, fontSize = 12.sp)
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = "${transactions.size}",
                            color = TextPrimary,
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Spacer(modifier = Modifier.height(2.dp))
                        Text(
                            text = "${expenseTransactions.size} gastos, ${transactions.size - expenseTransactions.size} ingresos",
                            color = TextSecondary,
                            fontSize = 11.sp
                        )
                    }
                }
            }
        }

        // Título Desglose por Categoría
        item {
            Text(
                text = "Gastos por Categoría",
                color = TextPrimary,
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold
            )
        }

        // Desglose de Categorías
        if (categoryTotals.isEmpty()) {
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = CardBackground),
                    shape = RoundedCornerShape(16.dp)
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(28.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text(
                            text = "Aún no hay gastos para analizar",
                            color = TextSecondary,
                            fontSize = 14.sp
                        )
                    }
                }
            }
        } else {
            items(categoryTotals) { (catName, amount) ->
                val category = Category.findByName(catName)
                val catColor = try {
                    Color(android.graphics.Color.parseColor(category.colorHex))
                } catch (_: Exception) {
                    PrimaryAccent
                }
                val percentage = if (totalExpense > 0) (amount / totalExpense).toFloat() else 0f
                val animatedProgress by animateFloatAsState(targetValue = percentage, label = "progress")

                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = CardBackground),
                    shape = RoundedCornerShape(16.dp)
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(36.dp)
                                        .background(catColor.copy(alpha = 0.15f), shape = RoundedCornerShape(10.dp)),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text(
                                        text = when (category.id) {
                                            "food" -> "🛒"
                                            "transport" -> "⛽"
                                            "leisure" -> "🍔"
                                            "housing" -> "🏠"
                                            "health" -> "💊"
                                            "subscriptions" -> "📱"
                                            "transfers" -> "💸"
                                            else -> "💳"
                                        },
                                        fontSize = 18.sp
                                    )
                                }

                                Column {
                                    Text(
                                        text = category.name,
                                        color = TextPrimary,
                                        fontWeight = FontWeight.SemiBold,
                                        fontSize = 15.sp
                                    )
                                    Text(
                                        text = String.format(Locale.GERMANY, "%.1f %% del total", percentage * 100),
                                        color = TextSecondary,
                                        fontSize = 12.sp
                                    )
                                }
                            }

                            Text(
                                text = String.format(Locale.GERMANY, "%,.2f €", amount),
                                color = TextPrimary,
                                fontWeight = FontWeight.Bold,
                                fontSize = 16.sp
                            )
                        }

                        Spacer(modifier = Modifier.height(12.dp))

                        // Barra de Progreso
                        LinearProgressIndicator(
                            progress = { animatedProgress },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(8.dp)
                                .clip(RoundedCornerShape(4.dp)),
                            color = catColor,
                            trackColor = CardBorder
                        )
                    }
                }
            }
        }
    }
}

