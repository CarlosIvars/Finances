package com.carlosivars.financias.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.carlosivars.financias.model.Category
import com.carlosivars.financias.ui.theme.*

@Composable
fun RecategorizeDialog(
    currentCategory: String,
    transactionDescription: String,
    onCategorySelected: (String) -> Unit,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Column {
                Text(
                    text = "Cambiar categoría",
                    color = TextPrimary,
                    fontWeight = FontWeight.Bold,
                    fontSize = 18.sp
                )
                Spacer(modifier = Modifier.height(2.dp))
                Text(
                    text = transactionDescription,
                    color = TextSecondary,
                    fontSize = 13.sp,
                    maxLines = 1
                )
            }
        },
        text = {
            LazyVerticalGrid(
                columns = GridCells.Fixed(2),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(max = 380.dp)
            ) {
                items(Category.ALL) { cat ->
                    val isCurrent = cat.name.equals(currentCategory, ignoreCase = true)
                    val catColor = try {
                        Color(android.graphics.Color.parseColor(cat.colorHex))
                    } catch (_: Exception) {
                        PrimaryAccent
                    }

                    Surface(
                        color = if (isCurrent) catColor.copy(alpha = 0.25f) else DarkSurface,
                        shape = RoundedCornerShape(12.dp),
                        border = if (isCurrent) CardDefaults.outlinedCardBorder().copy(
                            brush = androidx.compose.ui.graphics.SolidColor(catColor)
                        ) else CardDefaults.outlinedCardBorder().copy(
                            brush = androidx.compose.ui.graphics.SolidColor(CardBorder)
                        ),
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable {
                                onCategorySelected(cat.name)
                            }
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(28.dp)
                                    .background(catColor.copy(alpha = 0.2f), shape = RoundedCornerShape(8.dp)),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = when (cat.id) {
                                        "food" -> "🛒"
                                        "transport" -> "⛽"
                                        "leisure" -> "🍔"
                                        "housing" -> "🏠"
                                        "health" -> "💊"
                                        "subscriptions" -> "📱"
                                        "transfers" -> "💸"
                                        "salary" -> "💰"
                                        else -> "💳"
                                    },
                                    fontSize = 14.sp
                                )
                            }
                            Text(
                                text = cat.name,
                                color = if (isCurrent) catColor else TextPrimary,
                                fontSize = 12.sp,
                                fontWeight = if (isCurrent) FontWeight.Bold else FontWeight.Medium,
                                maxLines = 2,
                                lineHeight = 14.sp
                            )
                        }
                    }
                }
            }
        },
        confirmButton = {},
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancelar", color = TextSecondary)
            }
        },
        containerColor = CardBackground,
        shape = RoundedCornerShape(18.dp)
    )
}

