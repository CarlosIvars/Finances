package com.carlosivars.financias.ui.screens

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.carlosivars.financias.data.BudgetEntity
import com.carlosivars.financias.model.Category
import com.carlosivars.financias.model.Transaction
import com.carlosivars.financias.model.TransactionType
import com.carlosivars.financias.ui.components.CategoryIcon
import com.carlosivars.financias.ui.components.EditBudgetDialog
import com.carlosivars.financias.ui.theme.*
import java.util.Locale

@Composable
fun BudgetScreen(
    budgets: List<BudgetEntity>,
    transactions: List<Transaction>,
    categories: List<Category>,
    onSaveBudget: (categoryId: String, categoryName: String, limit: Double, colorHex: String) -> Unit
) {
    var categoryToEdit by remember { mutableStateOf<Pair<Category, Double>?>(null) }

    val expenseTransactions = transactions.filter { it.type == TransactionType.EXPENSE }
    val spendingByCategory = remember(expenseTransactions) {
        expenseTransactions.groupBy { it.category }.mapValues { entry -> entry.value.sumOf { it.amount } }
    }

    val totalBudget = budgets.sumOf { it.monthlyLimit }
    val totalSpentInBudgeted = budgets.sumOf { b -> spendingByCategory[b.categoryName] ?: 0.0 }
    val globalProgress = if (totalBudget > 0) (totalSpentInBudgeted / totalBudget).toFloat().coerceIn(0f, 1f) else 0f

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 20.dp),
        contentPadding = PaddingValues(top = 20.dp, bottom = 100.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Header
        item {
            Column {
                Text(
                    text = "Presupuestos",
                    color = MaterialTheme.colorScheme.onBackground,
                    fontSize = 24.sp,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = "Controla tus límites de gasto mensuales",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    fontSize = 13.sp
                )
            }
        }

        // Resumen Global
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                shape = RoundedCornerShape(16.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.35f))
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(20.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text("Total Presupuestado", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 13.sp)
                            Spacer(modifier = Modifier.height(2.dp))
                            Text(
                                text = String.format(Locale.GERMANY, "%,.2f €", totalBudget),
                                color = MaterialTheme.colorScheme.onSurface,
                                fontSize = 24.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }

                        Column(horizontalAlignment = Alignment.End) {
                            Text("Gastado", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 13.sp)
                            Spacer(modifier = Modifier.height(2.dp))
                            Text(
                                text = String.format(Locale.GERMANY, "%,.2f €", totalSpentInBudgeted),
                                color = if (totalSpentInBudgeted > totalBudget) ExpenseRed else IncomeGreen,
                                fontSize = 18.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(14.dp))

                    LinearProgressIndicator(
                        progress = { globalProgress },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(10.dp)
                            .clip(RoundedCornerShape(5.dp)),
                        color = if (totalSpentInBudgeted > totalBudget) ExpenseRed else MaterialTheme.colorScheme.primary,
                        trackColor = MaterialTheme.colorScheme.outline.copy(alpha = 0.2f)
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    Text(
                        text = if (totalSpentInBudgeted <= totalBudget) {
                            String.format(Locale.GERMANY, "Te quedan %,.2f € disponibles este mes", totalBudget - totalSpentInBudgeted)
                        } else {
                            String.format(Locale.GERMANY, "¡Has excedido tu presupuesto por %,.2f €!", totalSpentInBudgeted - totalBudget)
                        },
                        color = if (totalSpentInBudgeted <= totalBudget) MaterialTheme.colorScheme.onSurfaceVariant else ExpenseRed,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Medium
                    )
                }
            }
        }

        // Título Categorías
        item {
            Text(
                text = "Límites por Categoría",
                color = MaterialTheme.colorScheme.onBackground,
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold
            )
        }

        // Lista de todas las categorías con opción de fijar presupuesto
        val allExpenseCategories = categories.filter { !it.isIncome }
        items(allExpenseCategories) { cat ->
            val budget = budgets.find { it.categoryId == cat.id || it.categoryName.equals(cat.name, ignoreCase = true) }
            val limit = budget?.monthlyLimit ?: 0.0
            val spent = spendingByCategory[cat.name] ?: 0.0

            val progress = if (limit > 0) (spent / limit).toFloat() else 0f
            val animatedProgress by animateFloatAsState(targetValue = progress.coerceIn(0f, 1f), label = "budgetProgress")

            val statusColor = when {
                limit <= 0 -> MaterialTheme.colorScheme.onSurfaceVariant
                spent > limit -> ExpenseRed
                spent >= limit * 0.8 -> Color(0xFFF59E0B) // Advertencia 80%+
                else -> IncomeGreen
            }

            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                shape = RoundedCornerShape(16.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.25f))
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
                            val catColor = try {
                                Color(android.graphics.Color.parseColor(cat.colorHex))
                            } catch (_: Exception) {
                                MaterialTheme.colorScheme.primary
                            }

                            CategoryIcon(
                                categoryIdOrName = cat.id,
                                iconName = cat.icon,
                                colorHex = cat.colorHex,
                                categories = categories,
                                size = 36.dp,
                                iconSize = 18.dp,
                                shapeRadius = 10.dp
                            )

                            Column {
                                Text(
                                    text = cat.name,
                                    color = MaterialTheme.colorScheme.onSurface,
                                    fontWeight = FontWeight.SemiBold,
                                    fontSize = 15.sp
                                )
                                Text(
                                    text = if (limit > 0) {
                                        String.format(Locale.GERMANY, "Gastado: %,.2f € / %,.2f €", spent, limit)
                                    } else {
                                        "Sin presupuesto asignado"
                                    },
                                    color = statusColor,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Medium
                                )
                            }
                        }

                        IconButton(onClick = { categoryToEdit = Pair(cat, limit) }) {
                            Icon(
                                Icons.Default.Edit,
                                contentDescription = "Editar presupuesto",
                                tint = MaterialTheme.colorScheme.primary,
                                modifier = Modifier.size(18.dp)
                            )
                        }
                    }

                    if (limit > 0) {
                        Spacer(modifier = Modifier.height(10.dp))
                        LinearProgressIndicator(
                            progress = { animatedProgress },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(8.dp)
                                .clip(RoundedCornerShape(4.dp)),
                            color = statusColor,
                            trackColor = MaterialTheme.colorScheme.outline.copy(alpha = 0.2f)
                        )

                        Spacer(modifier = Modifier.height(6.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                text = String.format(Locale.GERMANY, "%.0f%% consumido", progress * 100),
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                fontSize = 11.sp
                            )
                            Text(
                                text = if (spent <= limit) {
                                    String.format(Locale.GERMANY, "Quedan %,.2f €", limit - spent)
                                } else {
                                    String.format(Locale.GERMANY, "Excedido por %,.2f €", spent - limit)
                                },
                                color = statusColor,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.SemiBold
                            )
                        }
                    }
                }
            }
        }
    }

    // Modal de edición de presupuesto
    categoryToEdit?.let { (category, currentLimit) ->
        EditBudgetDialog(
            initialCategory = category,
            initialLimit = currentLimit,
            onDismiss = { categoryToEdit = null },
            onConfirm = { catId, catName, newLimit, colorHex ->
                onSaveBudget(catId, catName, newLimit, colorHex)
                categoryToEdit = null
            }
        )
    }
}
