package com.carlosivars.financias.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Cloud
import androidx.compose.material.icons.filled.PhoneAndroid
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.carlosivars.financias.model.Category
import com.carlosivars.financias.sync.MobileSyncConflict

@Composable
fun MergeConflictDialog(
    conflict: MobileSyncConflict,
    categories: List<Category>? = null,
    onResolve: (keepLocal: Boolean) -> Unit,
    onDismiss: () -> Unit
) {
    val local = conflict.localTransaction
    val descDiff = local.description != conflict.serverDescription
    val amountDiff = local.amount != conflict.serverAmount
    val catDiff = local.category != conflict.serverCategoryName

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(36.dp)
                        .background(Color(0xFFF59E0B).copy(alpha = 0.15f), RoundedCornerShape(10.dp)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.Warning,
                        contentDescription = null,
                        tint = Color(0xFFF59E0B),
                        modifier = Modifier.size(20.dp)
                    )
                }
                Spacer(modifier = Modifier.width(10.dp))
                Column {
                    Text(
                        text = "Conflicto de Sincronización",
                        fontSize = 17.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    Text(
                        text = "Merge Editor de Movimientos",
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        },
        text = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 4.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text(
                    text = "Este movimiento fue editado tanto en el móvil como en el servidor con datos discordantes. Elige qué versión deseas conservar:",
                    fontSize = 13.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    lineHeight = 18.sp
                )

                // Tarjeta Móvil Local
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .border(1.dp, Color(0xFF3B82F6).copy(alpha = 0.3f), RoundedCornerShape(14.dp)),
                    colors = CardDefaults.cardColors(containerColor = Color(0xFF3B82F6).copy(alpha = 0.05f)),
                    shape = RoundedCornerShape(14.dp)
                ) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.padding(bottom = 6.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.PhoneAndroid,
                                contentDescription = null,
                                tint = Color(0xFF3B82F6),
                                modifier = Modifier.size(16.dp)
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = "VERSIÓN MÓVIL LOCAL",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color(0xFF3B82F6)
                            )
                        }

                        Text(
                            text = "Concepto: ${local.description}",
                            fontSize = 13.sp,
                            fontWeight = if (descDiff) FontWeight.Bold else FontWeight.Normal,
                            color = if (descDiff) Color(0xFFF59E0B) else MaterialTheme.colorScheme.onSurface
                        )
                        Text(
                            text = "Importe: ${String.format(java.util.Locale.US, "%.2f", local.amount)} € (${local.type})",
                            fontSize = 13.sp,
                            fontWeight = if (amountDiff) FontWeight.Bold else FontWeight.Normal,
                            color = if (amountDiff) Color(0xFFF59E0B) else MaterialTheme.colorScheme.onSurface
                        )
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Text(
                                text = "Categoría:",
                                fontSize = 13.sp,
                                fontWeight = if (catDiff) FontWeight.Bold else FontWeight.Normal,
                                color = if (catDiff) Color(0xFFF59E0B) else MaterialTheme.colorScheme.onSurface
                            )
                            val localCat = Category.findByName(local.category, categories)
                            CategoryIcon(
                                categoryIdOrName = localCat.id,
                                iconName = localCat.icon,
                                colorHex = localCat.colorHex,
                                size = 24.dp,
                                iconSize = 13.dp,
                                shapeRadius = 6.dp
                            )
                            Text(
                                text = local.category,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = try { Color(android.graphics.Color.parseColor(localCat.colorHex)) } catch (_: Exception) { MaterialTheme.colorScheme.primary }
                            )
                        }

                        Spacer(modifier = Modifier.height(8.dp))
                        Button(
                            onClick = { onResolve(true) },
                            modifier = Modifier.fillMaxWidth(),
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF3B82F6)),
                            shape = RoundedCornerShape(10.dp)
                        ) {
                            Text("Mantener Versión Móvil", fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                        }
                    }
                }

                // Tarjeta Servidor Nube
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .border(1.dp, Color(0xFF10B981).copy(alpha = 0.3f), RoundedCornerShape(14.dp)),
                    colors = CardDefaults.cardColors(containerColor = Color(0xFF10B981).copy(alpha = 0.05f)),
                    shape = RoundedCornerShape(14.dp)
                ) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.padding(bottom = 6.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Cloud,
                                contentDescription = null,
                                tint = Color(0xFF10B981),
                                modifier = Modifier.size(16.dp)
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = "VERSIÓN SERVIDOR (NUBE)",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color(0xFF10B981)
                            )
                        }

                        Text(
                            text = "Concepto: ${conflict.serverDescription}",
                            fontSize = 13.sp,
                            fontWeight = if (descDiff) FontWeight.Bold else FontWeight.Normal,
                            color = if (descDiff) Color(0xFFF59E0B) else MaterialTheme.colorScheme.onSurface
                        )
                        Text(
                            text = "Importe: ${String.format(java.util.Locale.US, "%.2f", conflict.serverAmount)} € (${conflict.serverType})",
                            fontSize = 13.sp,
                            fontWeight = if (amountDiff) FontWeight.Bold else FontWeight.Normal,
                            color = if (amountDiff) Color(0xFFF59E0B) else MaterialTheme.colorScheme.onSurface
                        )
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Text(
                                text = "Categoría:",
                                fontSize = 13.sp,
                                fontWeight = if (catDiff) FontWeight.Bold else FontWeight.Normal,
                                color = if (catDiff) Color(0xFFF59E0B) else MaterialTheme.colorScheme.onSurface
                            )
                            val serverCat = Category.findByName(conflict.serverCategoryName, categories)
                            CategoryIcon(
                                categoryIdOrName = serverCat.id,
                                iconName = serverCat.icon,
                                colorHex = serverCat.colorHex,
                                size = 24.dp,
                                iconSize = 13.dp,
                                shapeRadius = 6.dp
                            )
                            Text(
                                text = conflict.serverCategoryName,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = try { Color(android.graphics.Color.parseColor(serverCat.colorHex)) } catch (_: Exception) { MaterialTheme.colorScheme.primary }
                            )
                        }

                        Spacer(modifier = Modifier.height(8.dp))
                        Button(
                            onClick = { onResolve(false) },
                            modifier = Modifier.fillMaxWidth(),
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF10B981)),
                            shape = RoundedCornerShape(10.dp)
                        ) {
                            Text("Aceptar Versión Servidor", fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                        }
                    }
                }
            }
        },
        confirmButton = {},
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Omitir", color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        },
        shape = RoundedCornerShape(20.dp),
        containerColor = MaterialTheme.colorScheme.surface
    )
}

