package com.carlosivars.financias.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.carlosivars.financias.model.Category
import com.carlosivars.financias.model.TransactionType
import com.carlosivars.financias.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddTransactionDialog(
    onDismiss: () -> Unit,
    onConfirm: (description: String, amount: Double, type: TransactionType, category: String) -> Unit
) {
    var type by remember { mutableStateOf(TransactionType.EXPENSE) }
    var description by remember { mutableStateOf("") }
    var amountText by remember { mutableStateOf("") }
    var selectedCategory by remember { mutableStateOf(Category.ALL.first()) }
    var isCategoryDropdownOpen by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text(
                text = "Nueva Transacción",
                fontWeight = FontWeight.Bold,
                fontSize = 20.sp,
                color = TextPrimary
            )
        },
        text = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 8.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Selector Tipo: Gasto / Ingreso
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    FilterChip(
                        selected = type == TransactionType.EXPENSE,
                        onClick = { type = TransactionType.EXPENSE },
                        label = { Text("Gasto") },
                        leadingIcon = {
                            Icon(Icons.Default.TrendingDown, contentDescription = null, tint = ExpenseRed)
                        },
                        modifier = Modifier.weight(1f),
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = ExpenseRed.copy(alpha = 0.2f),
                            selectedLabelColor = ExpenseRed
                        )
                    )

                    FilterChip(
                        selected = type == TransactionType.INCOME,
                        onClick = { type = TransactionType.INCOME },
                        label = { Text("Ingreso") },
                        leadingIcon = {
                            Icon(Icons.Default.TrendingUp, contentDescription = null, tint = IncomeGreen)
                        },
                        modifier = Modifier.weight(1f),
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = IncomeGreen.copy(alpha = 0.2f),
                            selectedLabelColor = IncomeGreen
                        )
                    )
                }

                // Campo Importe
                OutlinedTextField(
                    value = amountText,
                    onValueChange = {
                        amountText = it.replace(',', '.')
                        errorMessage = null
                    },
                    label = { Text("Importe (€)") },
                    placeholder = { Text("0.00") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = PrimaryAccent,
                        focusedLabelColor = PrimaryAccent
                    )
                )

                // Campo Concepto / Comercio
                OutlinedTextField(
                    value = description,
                    onValueChange = {
                        description = it
                        errorMessage = null
                    },
                    label = { Text("Concepto o Comercio") },
                    placeholder = { Text("ej. Mercadona, Restaurante, Nómina...") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = PrimaryAccent,
                        focusedLabelColor = PrimaryAccent
                    )
                )

                // Selector de Categoría
                ExposedDropdownMenuBox(
                    expanded = isCategoryDropdownOpen,
                    onExpandedChange = { isCategoryDropdownOpen = !isCategoryDropdownOpen }
                ) {
                    OutlinedTextField(
                        value = selectedCategory.name,
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("Categoría") },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = isCategoryDropdownOpen) },
                        leadingIcon = {
                            Box(
                                modifier = Modifier
                                    .size(16.dp)
                                    .background(
                                        color = try { Color(android.graphics.Color.parseColor(selectedCategory.colorHex)) } catch (_: Exception) { PrimaryAccent },
                                        shape = CircleShape
                                    )
                            )
                        },
                        modifier = Modifier
                            .fillMaxWidth()
                            .menuAnchor(),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = PrimaryAccent,
                            focusedLabelColor = PrimaryAccent
                        )
                    )

                    ExposedDropdownMenu(
                        expanded = isCategoryDropdownOpen,
                        onDismissRequest = { isCategoryDropdownOpen = false }
                    ) {
                        Category.ALL.forEach { cat ->
                            DropdownMenuItem(
                                text = {
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                                    ) {
                                        Box(
                                            modifier = Modifier
                                                .size(14.dp)
                                                .background(
                                                    color = try { Color(android.graphics.Color.parseColor(cat.colorHex)) } catch (_: Exception) { PrimaryAccent },
                                                    shape = CircleShape
                                                )
                                        )
                                        Text(cat.name, fontSize = 14.sp)
                                    }
                                },
                                onClick = {
                                    selectedCategory = cat
                                    isCategoryDropdownOpen = false
                                }
                            )
                        }
                    }
                }

                errorMessage?.let { msg ->
                    Text(
                        text = msg,
                        color = ExpenseRed,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Medium
                    )
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    val amount = amountText.toDoubleOrNull()
                    if (amount == null || amount <= 0) {
                        errorMessage = "Introduce un importe válido mayor que 0"
                        return@Button
                    }
                    if (description.isBlank()) {
                        errorMessage = "Introduce un concepto o nombre de comercio"
                        return@Button
                    }
                    onConfirm(description.trim(), amount, type, selectedCategory.name)
                },
                colors = ButtonDefaults.buttonColors(containerColor = PrimaryAccent),
                shape = RoundedCornerShape(10.dp)
            ) {
                Text("Guardar", color = Color.White, fontWeight = FontWeight.SemiBold)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancelar", color = TextSecondary)
            }
        },
        containerColor = CardBackground,
        shape = RoundedCornerShape(20.dp)
    )
}

