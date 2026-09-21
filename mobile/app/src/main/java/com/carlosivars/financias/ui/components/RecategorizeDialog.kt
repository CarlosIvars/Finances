package com.carlosivars.financias.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.SubdirectoryArrowRight
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.carlosivars.financias.model.Category
import com.carlosivars.financias.ui.theme.*

@Composable
fun RecategorizeDialog(
    categories: List<Category>,
    currentCategory: String,
    transactionDescription: String,
    onCategorySelected: (Category) -> Unit,
    onDismiss: () -> Unit
) {
    var expandedParentId by remember { mutableStateOf<String?>(null) }
    val rootCategories = remember(categories) { categories.filter { it.parentId == null } }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Column {
                Text(
                    text = "Seleccionar Categoría",
                    color = MaterialTheme.colorScheme.onSurface,
                    fontWeight = FontWeight.Bold,
                    fontSize = 18.sp
                )
                Spacer(modifier = Modifier.height(2.dp))
                Text(
                    text = transactionDescription,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    fontSize = 13.sp,
                    maxLines = 1
                )
            }
        },
        text = {
            LazyColumn(
                verticalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(max = 420.dp)
            ) {
                items(rootCategories) { rootCat ->
                    val isCurrentRoot = rootCat.name.equals(currentCategory, ignoreCase = true)
                    val catColor = try {
                        Color(android.graphics.Color.parseColor(rootCat.colorHex))
                    } catch (_: Exception) {
                        MaterialTheme.colorScheme.primary
                    }
                    val subcategories = categories.filter { it.parentId == rootCat.id }
                    val isExpanded = expandedParentId == rootCat.id

                    Column(
                        modifier = Modifier.fillMaxWidth(),
                        verticalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        // Root category row
                        Surface(
                            color = if (isCurrentRoot) catColor.copy(alpha = 0.18f) else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
                            shape = RoundedCornerShape(12.dp),
                            border = if (isCurrentRoot) CardDefaults.outlinedCardBorder().copy(
                                brush = androidx.compose.ui.graphics.SolidColor(catColor)
                            ) else CardDefaults.outlinedCardBorder().copy(
                                brush = androidx.compose.ui.graphics.SolidColor(MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f))
                            ),
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable {
                                    if (subcategories.isNotEmpty()) {
                                        expandedParentId = if (isExpanded) null else rootCat.id
                                    } else {
                                        onCategorySelected(rootCat)
                                    }
                                }
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                                ) {
                                    CategoryIcon(
                                        categoryIdOrName = rootCat.id,
                                        colorHex = rootCat.colorHex,
                                        size = 32.dp,
                                        iconSize = 16.dp,
                                        shapeRadius = 8.dp
                                    )
                                    Column {
                                        Text(
                                            text = rootCat.name,
                                            color = if (isCurrentRoot) catColor else MaterialTheme.colorScheme.onSurface,
                                            fontSize = 14.sp,
                                            fontWeight = FontWeight.SemiBold
                                        )
                                        if (subcategories.isNotEmpty()) {
                                            Text(
                                                text = "${subcategories.size} subcategorías",
                                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                                fontSize = 11.sp
                                            )
                                        }
                                    }
                                }

                                if (subcategories.isNotEmpty()) {
                                    IconButton(
                                        onClick = {
                                            expandedParentId = if (isExpanded) null else rootCat.id
                                        },
                                        modifier = Modifier.size(28.dp)
                                    ) {
                                        Icon(
                                            Icons.Default.ChevronRight,
                                            contentDescription = null,
                                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                            modifier = Modifier.rotate(if (isExpanded) 90f else 0f)
                                        )
                                    }
                                }
                            }
                        }

                        // Subcategorías desplegables
                        if (isExpanded && subcategories.isNotEmpty()) {
                            // Opción para seleccionar categoría padre directamente
                            Surface(
                                color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.35f),
                                shape = RoundedCornerShape(10.dp),
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(start = 20.dp)
                                .clickable { onCategorySelected(rootCat) }
                            ) {
                                Text(
                                    text = "› Categoría general: ${rootCat.name}",
                                    color = MaterialTheme.colorScheme.primary,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Medium,
                                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp)
                                )
                            }

                            subcategories.forEach { sub ->
                                val isCurrentSub = sub.name.equals(currentCategory, ignoreCase = true)
                                Surface(
                                    color = if (isCurrentSub) catColor.copy(alpha = 0.18f) else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.35f),
                                    shape = RoundedCornerShape(10.dp),
                                    border = if (isCurrentSub) CardDefaults.outlinedCardBorder().copy(
                                        brush = androidx.compose.ui.graphics.SolidColor(catColor)
                                    ) else null,
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(start = 20.dp)
                                        .clickable { onCategorySelected(sub) }
                                ) {
                                    Row(
                                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                                    ) {
                                        Icon(
                                            Icons.Default.SubdirectoryArrowRight,
                                            contentDescription = null,
                                            tint = catColor,
                                            modifier = Modifier.size(14.dp)
                                        )
                                        Text(
                                            text = sub.name,
                                            color = if (isCurrentSub) catColor else MaterialTheme.colorScheme.onSurface,
                                            fontSize = 13.sp,
                                            fontWeight = if (isCurrentSub) FontWeight.Bold else FontWeight.Normal
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {},
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancelar", color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        },
        containerColor = MaterialTheme.colorScheme.surface,
        shape = RoundedCornerShape(16.dp)
    )
}
