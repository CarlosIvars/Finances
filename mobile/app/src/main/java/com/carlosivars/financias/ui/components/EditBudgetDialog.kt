package com.carlosivars.financias.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
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
import com.carlosivars.financias.ui.theme.*

@Composable
fun EditBudgetDialog(
    initialCategory: Category,
    initialLimit: Double,
    onDismiss: () -> Unit,
    onConfirm: (categoryId: String, categoryName: String, limit: Double, colorHex: String) -> Unit
) {
    var limitText by remember { mutableStateOf(if (initialLimit > 0) initialLimit.toString() else "") }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    val catColor = try {
        Color(android.graphics.Color.parseColor(initialCategory.colorHex))
    } catch (_: Exception) {
        PrimaryAccent
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Box(
                    modifier = Modifier
                        .size(18.dp)
                        .background(catColor, shape = CircleShape)
                )
                Text(
                    text = "Presupuesto: ${initialCategory.name}",
                    fontWeight = FontWeight.Bold,
                    fontSize = 18.sp,
                    color = TextPrimary
                )
            }
        },
        text = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 8.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text(
                    text = "Indica el límite máximo mensual que planeas gastar en esta categoría.",
                    fontSize = 13.sp,
                    color = TextSecondary
                )

                OutlinedTextField(
                    value = limitText,
                    onValueChange = {
                        limitText = it.replace(',', '.')
                        errorMessage = null
                    },
                    label = { Text("Límite Mensual (€)") },
                    placeholder = { Text("ej. 250.00") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = PrimaryAccent,
                        focusedLabelColor = PrimaryAccent
                    )
                )

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
                    val limit = limitText.toDoubleOrNull()
                    if (limit == null || limit <= 0) {
                        errorMessage = "Introduce un límite válido mayor que 0"
                        return@Button
                    }
                    onConfirm(
                        initialCategory.id,
                        initialCategory.name,
                        limit,
                        initialCategory.colorHex
                    )
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

