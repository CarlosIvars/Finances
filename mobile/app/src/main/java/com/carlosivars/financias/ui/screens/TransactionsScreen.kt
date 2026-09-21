package com.carlosivars.financias.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
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

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TransactionsScreen(
    transactions: List<Transaction>,
    onAddTransactionClick: () -> Unit,
    onDeleteTransaction: (String) -> Unit,
    onRecategorizeTransaction: (transactionId: String, newCategory: String) -> Unit = { _, _ -> }
) {
    var searchQuery by remember { mutableStateOf("") }
    var selectedTypeFilter by remember { mutableStateOf<TransactionType?>(null) }
    var selectedCategoryFilter by remember { mutableStateOf<String?>(null) }
    var transactionToDelete by remember { mutableStateOf<Transaction?>(null) }
    var transactionToRecategorize by remember { mutableStateOf<Transaction?>(null) }
    var transactionForDetail by remember { mutableStateOf<Transaction?>(null) }

    val filteredTransactions = remember(transactions, searchQuery, selectedTypeFilter, selectedCategoryFilter) {
        transactions.filter { tx ->
            val matchesQuery = searchQuery.isBlank() ||
                    tx.description.contains(searchQuery, ignoreCase = true) ||
                    tx.category.contains(searchQuery, ignoreCase = true) ||
                    tx.amount.toString().contains(searchQuery)

            val matchesType = selectedTypeFilter == null || tx.type == selectedTypeFilter
            val matchesCategory = selectedCategoryFilter == null || tx.category.equals(selectedCategoryFilter, ignoreCase = true)

            matchesQuery && matchesType && matchesCategory
        }
    }

    Scaffold(
        containerColor = DarkBackground,
        floatingActionButton = {
            FloatingActionButton(
                onClick = onAddTransactionClick,
                containerColor = PrimaryAccent,
                contentColor = Color.White,
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier.padding(bottom = 70.dp)
            ) {
                Icon(Icons.Default.Add, contentDescription = "Añadir movimiento")
            }
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 20.dp),
            contentPadding = PaddingValues(top = 20.dp, bottom = 120.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Header
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(
                            text = "Transacciones",
                            color = TextPrimary,
                            fontSize = 24.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = "${filteredTransactions.size} de ${transactions.size} movimientos",
                            color = TextSecondary,
                            fontSize = 13.sp
                        )
                    }
                }
            }

            // Barra de Búsqueda
            item {
                OutlinedTextField(
                    value = searchQuery,
                    onValueChange = { searchQuery = it },
                    modifier = Modifier.fillMaxWidth(),
                    placeholder = { Text("Buscar por comercio, concepto o importe...", fontSize = 14.sp) },
                    leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, tint = TextSecondary) },
                    trailingIcon = {
                        if (searchQuery.isNotEmpty()) {
                            IconButton(onClick = { searchQuery = "" }) {
                                Icon(Icons.Default.Close, contentDescription = "Borrar", tint = TextSecondary)
                            }
                        }
                    },
                    shape = RoundedCornerShape(16.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedContainerColor = CardBackground,
                        unfocusedContainerColor = CardBackground,
                        focusedBorderColor = PrimaryAccent,
                        unfocusedBorderColor = CardBorder,
                        focusedTextColor = TextPrimary,
                        unfocusedTextColor = TextPrimary
                    ),
                    singleLine = true
                )
            }

            // Filtros de Tipo (Chips)
            item {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    FilterChip(
                        selected = selectedTypeFilter == null,
                        onClick = { selectedTypeFilter = null },
                        label = { Text("Todos") },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = PrimaryAccent.copy(alpha = 0.2f),
                            selectedLabelColor = PrimaryAccent
                        )
                    )

                    FilterChip(
                        selected = selectedTypeFilter == TransactionType.EXPENSE,
                        onClick = {
                            selectedTypeFilter = if (selectedTypeFilter == TransactionType.EXPENSE) null else TransactionType.EXPENSE
                        },
                        label = { Text("Gastos") },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = ExpenseRed.copy(alpha = 0.2f),
                            selectedLabelColor = ExpenseRed
                        )
                    )

                    FilterChip(
                        selected = selectedTypeFilter == TransactionType.INCOME,
                        onClick = {
                            selectedTypeFilter = if (selectedTypeFilter == TransactionType.INCOME) null else TransactionType.INCOME
                        },
                        label = { Text("Ingresos") },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = IncomeGreen.copy(alpha = 0.2f),
                            selectedLabelColor = IncomeGreen
                        )
                    )
                }
            }

            // Filtros de Categoría (Chips)
            item {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Category.ALL.forEach { cat ->
                        val isSelected = selectedCategoryFilter.equals(cat.name, ignoreCase = true)
                        val catColor = try {
                            Color(android.graphics.Color.parseColor(cat.colorHex))
                        } catch (_: Exception) {
                            PrimaryAccent
                        }

                        FilterChip(
                            selected = isSelected,
                            onClick = {
                                selectedCategoryFilter = if (isSelected) null else cat.name
                            },
                            label = { Text(cat.name, fontSize = 12.sp) },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = catColor.copy(alpha = 0.2f),
                                selectedLabelColor = catColor
                            )
                        )
                    }
                }
            }

            // Lista o Vacío
            if (filteredTransactions.isEmpty()) {
                item {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = CardBackground),
                        shape = RoundedCornerShape(16.dp)
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(36.dp),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Icon(
                                imageVector = Icons.Default.SearchOff,
                                contentDescription = null,
                                tint = TextSecondary.copy(alpha = 0.4f),
                                modifier = Modifier.size(48.dp)
                            )
                            Spacer(modifier = Modifier.height(12.dp))
                            Text(
                                text = "Sin resultados coincidentes",
                                color = TextPrimary,
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 15.sp
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = "Prueba a cambiar el texto de búsqueda o los filtros seleccionados.",
                                color = TextSecondary,
                                fontSize = 13.sp,
                                textAlign = androidx.compose.ui.text.style.TextAlign.Center
                            )
                        }
                    }
                }
            } else {
                items(filteredTransactions, key = { it.id }) { tx ->
                    SwipeableTransactionItem(
                        tx = tx,
                        onDeleteClick = { transactionToDelete = tx },
                        onClick = { transactionForDetail = tx }
                    )
                }
            }
        }
    }

    // Diálogo con metadatos completos de la notificación y detalles
    transactionForDetail?.let { tx ->
        com.carlosivars.financias.ui.components.TransactionDetailDialog(
            transaction = tx,
            onDismiss = { transactionForDetail = null },
            onRecategorizeClick = {
                val target = transactionForDetail
                transactionForDetail = null
                transactionToRecategorize = target
            },
            onDeleteClick = {
                val target = transactionForDetail
                transactionForDetail = null
                transactionToDelete = target
            }
        )
    }

    // Diálogo para recategorizar movimiento
    transactionToRecategorize?.let { tx ->
        com.carlosivars.financias.ui.components.RecategorizeDialog(
            currentCategory = tx.category,
            transactionDescription = tx.description,
            onCategorySelected = { newCat ->
                onRecategorizeTransaction(tx.id, newCat)
                transactionToRecategorize = null
            },
            onDismiss = { transactionToRecategorize = null }
        )
    }

    // Diálogo de confirmación de borrado
    transactionToDelete?.let { tx ->
        AlertDialog(
            onDismissRequest = { transactionToDelete = null },
            title = { Text("Eliminar movimiento", color = TextPrimary, fontWeight = FontWeight.Bold) },
            text = {
                Text(
                    "¿Deseas eliminar '${tx.description}' (${String.format(Locale.GERMANY, "%.2f €", tx.amount)})?",
                    color = TextSecondary
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        onDeleteTransaction(tx.id)
                        transactionToDelete = null
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = ExpenseRed)
                ) {
                    Text("Eliminar", color = Color.White)
                }
            },
            dismissButton = {
                TextButton(onClick = { transactionToDelete = null }) {
                    Text("Cancelar", color = TextSecondary)
                }
            },
            containerColor = CardBackground,
            shape = RoundedCornerShape(16.dp)
        )
    }
}

@Composable
fun SwipeableTransactionItem(
    tx: Transaction,
    onDeleteClick: () -> Unit,
    onClick: () -> Unit = {}
) {
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
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() },
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
                        val displayCategory = when {
                            !tx.parentCategory.isNullOrBlank() -> "${tx.parentCategory} › ${tx.category}"
                            !tx.subCategory.isNullOrBlank() -> "${tx.category} › ${tx.subCategory}"
                            else -> tx.category
                        }
                        Text(
                            text = displayCategory,
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
                        val cardTag = tx.metadata["card"] ?: tx.metadata["card_masked"] ?: tx.metadata["card_last4"]
                        if (cardTag != null) {
                            Text("•", color = TextSecondary, fontSize = 10.sp)
                            Text(
                                text = if (cardTag.contains("••")) "💳 " + cardTag.substring(cardTag.indexOf("••")) else "💳 $cardTag",
                                color = TextSecondary,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Medium
                            )
                        }
                    }
                }
            }

            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = String.format(Locale.GERMANY, "%s%,.2f €", prefix, tx.amount),
                    color = amountColor,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold
                )

                IconButton(
                    onClick = onDeleteClick,
                    modifier = Modifier.size(32.dp)
                ) {
                    Icon(
                        Icons.Default.DeleteOutline,
                        contentDescription = "Eliminar",
                        tint = TextSecondary.copy(alpha = 0.6f),
                        modifier = Modifier.size(18.dp)
                    )
                }
            }
        }
    }
}

