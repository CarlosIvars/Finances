package com.carlosivars.financias.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
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

private data class SubcategoryBudgetItem(
    val category: Category,
    val spent: Double,
    val limit: Double,
    val percentageOfParent: Double
)

private data class RootBudgetItem(
    val category: Category,
    val directSpent: Double,
    val totalSpent: Double,
    val directLimit: Double,
    val childrenLimitSum: Double,
    val effectiveLimit: Double,
    val subcategories: List<SubcategoryBudgetItem>
)

@Composable
fun BudgetScreen(
    budgets: List<BudgetEntity>,
    transactions: List<Transaction>,
    categories: List<Category>,
    onSaveBudget: (categoryId: String, categoryName: String, limit: Double, colorHex: String) -> Unit
) {
    var categoryToEdit by remember { mutableStateOf<Pair<Category, Double>?>(null) }
    val expandedCategories = remember { mutableStateMapOf<String, Boolean>() }

    val expenseTransactions = remember(transactions) {
        transactions.filter { it.type == TransactionType.EXPENSE }
    }

    // Gasto directo asignado a cada categoría canónica
    val directSpentByCategory = remember(expenseTransactions, categories) {
        val map = mutableMapOf<String, Double>()
        for (tx in expenseTransactions) {
            val matchedCat = if (tx.categoryServerId != null) {
                categories.find { it.id == tx.categoryServerId.toString() } ?: Category.findByName(tx.category, categories)
            } else {
                Category.findByName(tx.category, categories)
            }
            val current = map[matchedCat.id] ?: 0.0
            map[matchedCat.id] = current + tx.amount
        }
        map
    }

    val expenseCategories = remember(categories) {
        categories.filter { !it.isIncome }
    }

    // Separar en categorías raíz y agrupar subcategorías
    val (rootCategories, subcategoriesByParentId) = remember(expenseCategories) {
        val roots = mutableListOf<Category>()
        val subMap = mutableMapOf<String, MutableList<Category>>()

        val potentialRoots = expenseCategories.filter { it.parentId == null || it.parentId.isEmpty() }
        val rootIds = potentialRoots.map { it.id }.toSet()
        val rootNames = potentialRoots.map { it.name.lowercase() }.toSet()

        for (cat in expenseCategories) {
            if (cat.parentId != null && cat.parentId.isNotEmpty()) {
                val parentKey = when {
                    cat.parentId in rootIds -> cat.parentId
                    cat.parentName?.lowercase() in rootNames -> {
                        potentialRoots.firstOrNull { it.name.equals(cat.parentName, ignoreCase = true) }?.id ?: cat.parentId
                    }
                    else -> null
                }
                if (parentKey != null) {
                    subMap.getOrPut(parentKey) { mutableListOf() }.add(cat)
                } else {
                    roots.add(cat)
                }
            } else {
                roots.add(cat)
            }
        }
        Pair(roots, subMap)
    }

    // Construir árbol con cálculo de Rollup y Presupuesto Efectivo
    val treeItems = remember(rootCategories, subcategoriesByParentId, directSpentByCategory, budgets) {
        rootCategories.map { root ->
            val directSpent = directSpentByCategory[root.id] ?: 0.0
            val subcats = subcategoriesByParentId[root.id] ?: emptyList()

            val subcatItemsRaw = subcats.map { sub ->
                val spent = directSpentByCategory[sub.id] ?: 0.0
                val budget = budgets.find { it.categoryId == sub.id || it.categoryName.equals(sub.name, ignoreCase = true) }
                val limit = budget?.monthlyLimit ?: 0.0
                Pair(sub, Pair(spent, limit))
            }

            val childrenSpentSum = subcatItemsRaw.sumOf { it.second.first }
            val childrenLimitSum = subcatItemsRaw.sumOf { it.second.second }
            val totalSpent = directSpent + childrenSpentSum

            val rootBudget = budgets.find { it.categoryId == root.id || it.categoryName.equals(root.name, ignoreCase = true) }
            val directLimit = rootBudget?.monthlyLimit ?: 0.0
            val effectiveLimit = if (directLimit > 0) directLimit else childrenLimitSum

            val subcatItems = subcatItemsRaw.map { (sub, values) ->
                val (spent, limit) = values
                val pct = if (totalSpent > 0.0) ((spent / totalSpent) * 100.0).coerceIn(0.0, 100.0) else 0.0
                SubcategoryBudgetItem(
                    category = sub,
                    spent = spent,
                    limit = limit,
                    percentageOfParent = pct
                )
            }

            RootBudgetItem(
                category = root,
                directSpent = directSpent,
                totalSpent = totalSpent,
                directLimit = directLimit,
                childrenLimitSum = childrenLimitSum,
                effectiveLimit = effectiveLimit,
                subcategories = subcatItems
            )
        }
    }

    // Totales Globales: Sin doble contabilización
    val totalRealSpent = remember(expenseTransactions) {
        expenseTransactions.sumOf { it.amount }
    }
    val totalBudget = remember(treeItems) {
        treeItems.sumOf { it.effectiveLimit }
    }
    val globalProgress = if (totalBudget > 0) (totalRealSpent / totalBudget).toFloat().coerceIn(0f, 1f) else 0f

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
                    text = "Controla tus límites de gasto con desglose en árbol",
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
                                text = String.format(Locale.GERMANY, "%,.2f €", totalRealSpent),
                                color = if (totalBudget > 0 && totalRealSpent > totalBudget) ExpenseRed else IncomeGreen,
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
                        color = if (totalBudget > 0 && totalRealSpent > totalBudget) ExpenseRed else MaterialTheme.colorScheme.primary,
                        trackColor = MaterialTheme.colorScheme.outline.copy(alpha = 0.2f)
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    Text(
                        text = if (totalBudget <= 0) {
                            "Asigna presupuestos a tus categorías para controlar tus gastos"
                        } else if (totalRealSpent <= totalBudget) {
                            String.format(Locale.GERMANY, "Te quedan %,.2f € disponibles este mes", totalBudget - totalRealSpent)
                        } else {
                            String.format(Locale.GERMANY, "¡Has excedido tu presupuesto por %,.2f €!", totalRealSpent - totalBudget)
                        },
                        color = if (totalBudget > 0 && totalRealSpent > totalBudget) ExpenseRed else MaterialTheme.colorScheme.onSurfaceVariant,
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

        // Árbol de categorías con Rollup y Desglose
        items(treeItems, key = { it.category.id }) { item ->
            val isExpanded = expandedCategories[item.category.id] == true
            val hasSubs = item.subcategories.isNotEmpty()

            val progress = if (item.effectiveLimit > 0) (item.totalSpent / item.effectiveLimit).toFloat() else 0f
            val animatedProgress by animateFloatAsState(targetValue = progress.coerceIn(0f, 1f), label = "budgetProgress")

            val statusColor = when {
                item.effectiveLimit <= 0 -> MaterialTheme.colorScheme.onSurfaceVariant
                item.totalSpent > item.effectiveLimit -> ExpenseRed
                item.totalSpent >= item.effectiveLimit * 0.8 -> Color(0xFFF59E0B)
                else -> IncomeGreen
            }

            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                shape = RoundedCornerShape(16.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.25f))
            ) {
                Column(modifier = Modifier.fillMaxWidth()) {
                    // Cabecera de la Categoría Padre
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .then(if (hasSubs) Modifier.clickable { expandedCategories[item.category.id] = !isExpanded } else Modifier)
                            .padding(16.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                            modifier = Modifier.weight(1f)
                        ) {
                            CategoryIcon(
                                categoryIdOrName = item.category.id,
                                iconName = item.category.icon,
                                colorHex = item.category.colorHex,
                                categories = categories,
                                size = 38.dp,
                                iconSize = 20.dp,
                                shapeRadius = 10.dp
                            )

                            Column {
                                Text(
                                    text = item.category.name,
                                    color = MaterialTheme.colorScheme.onSurface,
                                    fontWeight = FontWeight.SemiBold,
                                    fontSize = 15.sp
                                )
                                Text(
                                    text = if (item.effectiveLimit > 0) {
                                        String.format(Locale.GERMANY, "Gastado: %,.2f € / %,.2f €", item.totalSpent, item.effectiveLimit)
                                    } else {
                                        String.format(Locale.GERMANY, "Gastado: %,.2f € (Sin límite)", item.totalSpent)
                                    },
                                    color = statusColor,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Medium
                                )
                            }
                        }

                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            IconButton(onClick = { categoryToEdit = Pair(item.category, item.directLimit) }) {
                                Icon(
                                    Icons.Default.Edit,
                                    contentDescription = "Editar presupuesto padre",
                                    tint = MaterialTheme.colorScheme.primary,
                                    modifier = Modifier.size(18.dp)
                                )
                            }

                            if (hasSubs) {
                                Icon(
                                    imageVector = Icons.Default.ChevronRight,
                                    contentDescription = if (isExpanded) "Colapsar" else "Expandir",
                                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                    modifier = Modifier
                                        .size(20.dp)
                                        .rotate(if (isExpanded) 90f else 0f)
                                )
                            }
                        }
                    }

                    // Barra de progreso y resumen del padre
                    if (item.effectiveLimit > 0) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 16.dp)
                        ) {
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
                                    text = if (item.totalSpent <= item.effectiveLimit) {
                                        String.format(Locale.GERMANY, "Quedan %,.2f €", item.effectiveLimit - item.totalSpent)
                                    } else {
                                        String.format(Locale.GERMANY, "Excedido por %,.2f €", item.totalSpent - item.effectiveLimit)
                                    },
                                    color = statusColor,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.SemiBold
                                )
                            }
                            Spacer(modifier = Modifier.height(10.dp))
                        }
                    }

                    // Indicador de subcategorías (si existen)
                    if (hasSubs) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { expandedCategories[item.category.id] = !isExpanded }
                                .padding(horizontal = 16.dp, vertical = 6.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                text = "${item.subcategories.size} subcategorías anidadas",
                                fontSize = 11.sp,
                                color = MaterialTheme.colorScheme.primary,
                                fontWeight = FontWeight.Medium
                            )
                            Text(
                                text = if (isExpanded) "Ocultar desglose ▲" else "Ver desglose ▼",
                                fontSize = 11.sp,
                                color = MaterialTheme.colorScheme.primary,
                                fontWeight = FontWeight.Medium
                            )
                        }
                    }

                    // Desglose en Árbol (Subcategorías anidadas)
                    AnimatedVisibility(
                        visible = isExpanded && hasSubs,
                        enter = expandVertically() + fadeIn(),
                        exit = shrinkVertically() + fadeOut()
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.25f))
                                .padding(horizontal = 14.dp, vertical = 10.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            // Si existe gasto directo en el padre (sin subcategoría específica)
                            if (item.directSpent > 0) {
                                val directPct = if (item.totalSpent > 0.0) ((item.directSpent / item.totalSpent) * 100.0).coerceIn(0.0, 100.0) else 0.0
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .background(
                                            color = MaterialTheme.colorScheme.surface,
                                            shape = RoundedCornerShape(10.dp)
                                        )
                                        .padding(horizontal = 12.dp, vertical = 10.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                                    ) {
                                        Text(
                                            text = "•",
                                            fontSize = 14.sp,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                                            fontWeight = FontWeight.Bold
                                        )
                                        Column {
                                            Text(
                                                text = "Gasto directo (${item.category.name})",
                                                fontSize = 13.sp,
                                                color = MaterialTheme.colorScheme.onSurface,
                                                fontWeight = FontWeight.Medium
                                            )
                                            Text(
                                                text = "Sin subcategoría asignada",
                                                fontSize = 11.sp,
                                                color = MaterialTheme.colorScheme.onSurfaceVariant
                                            )
                                        }
                                    }

                                    Column(horizontalAlignment = Alignment.End) {
                                        Text(
                                            text = String.format(Locale.GERMANY, "%,.2f €", item.directSpent),
                                            fontSize = 13.sp,
                                            fontWeight = FontWeight.SemiBold,
                                            color = MaterialTheme.colorScheme.onSurface
                                        )
                                        Text(
                                            text = String.format(Locale.GERMANY, "%.0f%% del total", directPct),
                                            fontSize = 11.sp,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant
                                        )
                                    }
                                }
                            }

                            // Subcategorías hijas
                            item.subcategories.forEach { sub ->
                                val subProgress = if (sub.limit > 0) (sub.spent / sub.limit).toFloat() else 0f
                                val subStatusColor = when {
                                    sub.limit <= 0 -> MaterialTheme.colorScheme.onSurfaceVariant
                                    sub.spent > sub.limit -> ExpenseRed
                                    sub.spent >= sub.limit * 0.8 -> Color(0xFFF59E0B)
                                    else -> IncomeGreen
                                }

                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .background(
                                            color = MaterialTheme.colorScheme.surface,
                                            shape = RoundedCornerShape(10.dp)
                                        )
                                        .padding(horizontal = 12.dp, vertical = 10.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                                        modifier = Modifier.weight(1f)
                                    ) {
                                        Text(
                                            text = "└",
                                            fontSize = 16.sp,
                                            color = MaterialTheme.colorScheme.outline.copy(alpha = 0.5f),
                                            fontWeight = FontWeight.Bold
                                        )

                                        CategoryIcon(
                                            categoryIdOrName = sub.category.id,
                                            iconName = sub.category.icon,
                                            colorHex = sub.category.colorHex,
                                            categories = categories,
                                            size = 28.dp,
                                            iconSize = 14.dp,
                                            shapeRadius = 7.dp
                                        )

                                        Column {
                                            Text(
                                                text = sub.category.name,
                                                fontSize = 13.sp,
                                                color = MaterialTheme.colorScheme.onSurface,
                                                fontWeight = FontWeight.SemiBold
                                            )
                                            Row(
                                                horizontalArrangement = Arrangement.spacedBy(6.dp),
                                                verticalAlignment = Alignment.CenterVertically
                                            ) {
                                                Text(
                                                    text = String.format(Locale.GERMANY, "%,.2f €", sub.spent),
                                                    fontSize = 12.sp,
                                                    fontWeight = FontWeight.Bold,
                                                    color = if (sub.limit > 0) subStatusColor else MaterialTheme.colorScheme.onSurface
                                                )
                                                Text(
                                                    text = String.format(Locale.GERMANY, "(%.0f%% del total)", sub.percentageOfParent),
                                                    fontSize = 11.sp,
                                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                                )
                                            }

                                            if (sub.limit > 0) {
                                                Spacer(modifier = Modifier.height(4.dp))
                                                LinearProgressIndicator(
                                                    progress = { subProgress.coerceIn(0f, 1f) },
                                                    modifier = Modifier
                                                        .width(130.dp)
                                                        .height(4.dp)
                                                        .clip(RoundedCornerShape(2.dp)),
                                                    color = subStatusColor,
                                                    trackColor = MaterialTheme.colorScheme.outline.copy(alpha = 0.2f)
                                                )
                                                Spacer(modifier = Modifier.height(2.dp))
                                                Text(
                                                    text = String.format(Locale.GERMANY, "Límite: %,.2f €", sub.limit),
                                                    fontSize = 10.sp,
                                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                                )
                                            } else {
                                                Text(
                                                    text = "Sin límite individual",
                                                    fontSize = 10.sp,
                                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                                )
                                            }
                                        }
                                    }

                                    IconButton(
                                        onClick = { categoryToEdit = Pair(sub.category, sub.limit) },
                                        modifier = Modifier.size(32.dp)
                                    ) {
                                        Icon(
                                            Icons.Default.Edit,
                                            contentDescription = "Editar presupuesto subcategoría",
                                            tint = MaterialTheme.colorScheme.primary,
                                            modifier = Modifier.size(16.dp)
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Modal de edición de presupuesto (sirve tanto para categorías padre como para subcategorías)
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
