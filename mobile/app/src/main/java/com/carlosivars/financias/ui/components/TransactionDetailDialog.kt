package com.carlosivars.financias.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.carlosivars.financias.model.Category
import com.carlosivars.financias.model.Transaction
import com.carlosivars.financias.model.TransactionType
import com.carlosivars.financias.ui.theme.*
import java.util.Locale

@Composable
fun TransactionDetailDialog(
    transaction: Transaction,
    onDismiss: () -> Unit,
    onRecategorizeClick: () -> Unit,
    onDeleteClick: () -> Unit
) {
    var showRawDetails by remember { mutableStateOf(false) }

    val isIncome = transaction.type == TransactionType.INCOME
    val amountColor = if (isIncome) IncomeGreen else ExpenseRed
    val prefix = if (isIncome) "+" else "-"

    val category = Category.findByName(transaction.category)
    val catColor = try {
        Color(android.graphics.Color.parseColor(category.colorHex))
    } catch (_: Exception) {
        PrimaryAccent
    }

    val metadata = transaction.metadata
    val card = metadata["card"] ?: metadata["card_masked"] ?: metadata["card_last4"]
    val source = metadata["source"] ?: metadata["package"]
    val opDate = metadata["original_date"] ?: metadata["operation_time"]
    val cleanMerchant = metadata["clean_merchant"] ?: metadata["merchant"]
    val rawText = metadata["raw_text"] ?: transaction.rawNotificationText
    val rawTitle = metadata["raw_title"]

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = DarkBackground,
        shape = RoundedCornerShape(20.dp),
        title = {
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
                            .size(40.dp)
                            .background(catColor.copy(alpha = 0.15f), shape = RoundedCornerShape(10.dp)),
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
                            fontSize = 18.sp
                        )
                    }
                    Column {
                        Text(
                            text = "Detalle del Movimiento",
                            color = TextPrimary,
                            fontWeight = FontWeight.Bold,
                            fontSize = 17.sp
                        )
                        Text(
                            text = transaction.date,
                            color = TextSecondary,
                            fontSize = 12.sp
                        )
                    }
                }
                IconButton(onClick = onDismiss, modifier = Modifier.size(28.dp)) {
                    Icon(Icons.Default.Close, contentDescription = "Cerrar", tint = TextSecondary)
                }
            }
        },
        text = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                // Banner Importe y Concepto
                Surface(
                    color = CardBackground,
                    shape = RoundedCornerShape(14.dp),
                    border = CardDefaults.outlinedCardBorder().copy(
                        brush = androidx.compose.ui.graphics.SolidColor(CardBorder)
                    ),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        modifier = Modifier.padding(14.dp),
                        verticalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Text(
                            text = transaction.description,
                            color = TextPrimary,
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = String.format(Locale.GERMANY, "%s%,.2f €", prefix, transaction.amount),
                                color = amountColor,
                                fontSize = 22.sp,
                                fontWeight = FontWeight.ExtraBold
                            )
                            Surface(
                                color = if (isIncome) IncomeGreen.copy(alpha = 0.15f) else PrimaryAccent.copy(alpha = 0.15f),
                                shape = RoundedCornerShape(8.dp)
                            ) {
                                Text(
                                    text = if (isIncome) "Ingreso" else "Gasto",
                                    color = if (isIncome) IncomeGreen else PrimaryAccent,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                                )
                            }
                        }
                    }
                }

                // Categoría Actual
                Surface(
                    color = DarkSurface,
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(12.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text("Categoría", color = TextSecondary, fontSize = 11.sp)
                            Text(
                                text = if (!transaction.parentCategory.isNullOrBlank()) {
                                    "${transaction.parentCategory} › ${transaction.category}"
                                } else if (!transaction.subCategory.isNullOrBlank()) {
                                    "${transaction.category} › ${transaction.subCategory}"
                                } else {
                                    transaction.category
                                },
                                color = catColor,
                                fontSize = 14.sp,
                                fontWeight = FontWeight.SemiBold
                            )
                        }
                        OutlinedButton(
                            onClick = onRecategorizeClick,
                            shape = RoundedCornerShape(8.dp),
                            contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp),
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = PrimaryAccent)
                        ) {
                            Text("Cambiar", fontSize = 12.sp)
                        }
                    }
                }

                // Tarjeta Bancaria / Origen
                if (card != null || source != null || opDate != null) {
                    Surface(
                        color = DarkSurface,
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(
                            modifier = Modifier.padding(12.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Text(
                                text = "INFORMACIÓN DEL PAGO",
                                color = TextSecondary,
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                letterSpacing = 1.sp
                            )

                            if (card != null) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    Icon(
                                        Icons.Default.CreditCard,
                                        contentDescription = null,
                                        tint = PrimaryAccent,
                                        modifier = Modifier.size(16.dp)
                                    )
                                    Column {
                                        Text("Tarjeta empleada", color = TextSecondary, fontSize = 10.sp)
                                        Text(card, color = TextPrimary, fontSize = 13.sp, fontWeight = FontWeight.Medium)
                                    }
                                }
                            }

                            if (source != null) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    Icon(
                                        Icons.Default.AccountBalance,
                                        contentDescription = null,
                                        tint = PrimaryAccent,
                                        modifier = Modifier.size(16.dp)
                                    )
                                    Column {
                                        Text("Origen / Entidad", color = TextSecondary, fontSize = 10.sp)
                                        Text(source, color = TextPrimary, fontSize = 13.sp, fontWeight = FontWeight.Medium)
                                    }
                                }
                            }

                            if (opDate != null) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    Icon(
                                        Icons.Default.Schedule,
                                        contentDescription = null,
                                        tint = PrimaryAccent,
                                        modifier = Modifier.size(16.dp)
                                    )
                                    Column {
                                        Text("Fecha/hora de la operación bancaria", color = TextSecondary, fontSize = 10.sp)
                                        Text(opDate, color = TextPrimary, fontSize = 13.sp, fontWeight = FontWeight.Medium)
                                    }
                                }
                            }

                            if (cleanMerchant != null && cleanMerchant != transaction.description) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    Icon(
                                        Icons.Default.Storefront,
                                        contentDescription = null,
                                        tint = PrimaryAccent,
                                        modifier = Modifier.size(16.dp)
                                    )
                                    Column {
                                        Text("Comercio detectado", color = TextSecondary, fontSize = 10.sp)
                                        Text(cleanMerchant, color = TextPrimary, fontSize = 13.sp, fontWeight = FontWeight.Medium)
                                    }
                                }
                            }
                        }
                    }
                }

                // Notificación Original Cruda
                if (!rawText.isNullOrBlank() || !rawTitle.isNullOrBlank()) {
                    Surface(
                        color = DarkSurface,
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(
                            modifier = Modifier.padding(12.dp),
                            verticalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Text(
                                text = "NOTIFICACIÓN ORIGINAL",
                                color = TextSecondary,
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                letterSpacing = 1.sp
                            )
                            if (!rawTitle.isNullOrBlank()) {
                                Text(
                                    text = "Título: $rawTitle",
                                    color = TextPrimary,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.SemiBold
                                )
                            }
                            if (!rawText.isNullOrBlank()) {
                                Text(
                                    text = rawText,
                                    color = TextSecondary,
                                    fontSize = 12.sp,
                                    fontFamily = FontFamily.Monospace,
                                    lineHeight = 16.sp
                                )
                            }
                        }
                    }
                }

                // Desplegable de Metadatos Técnicos
                if (metadata.isNotEmpty()) {
                    Column {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { showRawDetails = !showRawDetails }
                                .padding(vertical = 4.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = if (showRawDetails) "Ocultar metadatos técnicos" else "Ver metadatos técnicos (${metadata.size})",
                                color = PrimaryAccent,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Medium
                            )
                            Icon(
                                if (showRawDetails) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                                contentDescription = null,
                                tint = PrimaryAccent,
                                modifier = Modifier.size(18.dp)
                            )
                        }

                        if (showRawDetails) {
                            Surface(
                                color = Color.Black.copy(alpha = 0.4f),
                                shape = RoundedCornerShape(8.dp),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Column(
                                    modifier = Modifier.padding(8.dp),
                                    verticalArrangement = Arrangement.spacedBy(4.dp)
                                ) {
                                    metadata.forEach { (key, value) ->
                                        Text(
                                            text = "$key: $value",
                                            color = TextSecondary,
                                            fontSize = 11.sp,
                                            fontFamily = FontFamily.Monospace
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = onDismiss,
                shape = RoundedCornerShape(10.dp),
                colors = ButtonDefaults.buttonColors(containerColor = PrimaryAccent)
            ) {
                Text("Aceptar")
            }
        },
        dismissButton = {
            TextButton(
                onClick = onDeleteClick,
                colors = ButtonDefaults.textButtonColors(contentColor = ExpenseRed)
            ) {
                Icon(Icons.Default.Delete, contentDescription = null, modifier = Modifier.size(16.dp))
                Spacer(modifier = Modifier.width(4.dp))
                Text("Eliminar")
            }
        }
    )
}

