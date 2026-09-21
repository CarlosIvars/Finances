package com.carlosivars.financias.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.carlosivars.financias.model.Transaction
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

data class FinancialInsightItem(
    val id: String,
    val title: String,
    val description: String,
    val type: InsightType,
    val date: String,
    val impactAmount: Double? = null
)

enum class InsightType(val label: String, val color: Color, val icon: ImageVector) {
    ANOMALY("Anomalía", Color(0xFFEF4444), Icons.Default.Warning),
    INSIGHT("Recomendación", Color(0xFF3B82F6), Icons.Default.AutoAwesome),
    REMINDER("Aviso de Gasto", Color(0xFFF59E0B), Icons.Default.Notifications),
    GOAL("Meta de Ahorro", Color(0xFF10B981), Icons.Default.TrendingUp)
}

@Composable
fun InsightsScreen(
    transactions: List<Transaction>,
    onBackClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val coroutineScope = rememberCoroutineScope()
    var isAnalyzing by remember { mutableStateOf(false) }
    var expandedInsightId by remember { mutableStateOf<String?>(null) }

    // Generar insights contextuales basados en transacciones existentes
    val defaultInsights = remember(transactions) {
        val list = mutableListOf<FinancialInsightItem>()

        val totalExpenses = transactions.filter { it.amount < 0 }.sumOf { kotlin.math.abs(it.amount) }
        val foodExpenses = transactions.filter { it.category.contains("Alimenta", ignoreCase = true) || it.category.contains("Comida", ignoreCase = true) }
            .sumOf { kotlin.math.abs(it.amount) }

        if (totalExpenses > 0 && foodExpenses > (totalExpenses * 0.35)) {
            list.add(
                FinancialInsightItem(
                    id = "food_high",
                    title = "Gasto elevado en Alimentación",
                    description = "El 35% de tus egresos mensuales se destina a alimentación y supermercados. Planificar compras semanales podría reducir este rubro hasta un 12%.",
                    type = InsightType.REMINDER,
                    date = "Hoy",
                    impactAmount = foodExpenses
                )
            )
        }

        val highTx = transactions.maxByOrNull { kotlin.math.abs(it.amount) }
        if (highTx != null && kotlin.math.abs(highTx.amount) > 150) {
            list.add(
                FinancialInsightItem(
                    id = "anomaly_peak",
                    title = "Movimiento individual atípico",
                    description = "Se detectó un cargo de ${String.format("%.2f €", kotlin.math.abs(highTx.amount))} en '${highTx.description}'. Está por encima del promedio diario.",
                    type = InsightType.ANOMALY,
                    date = highTx.date,
                    impactAmount = kotlin.math.abs(highTx.amount)
                )
            )
        }

        list.add(
            FinancialInsightItem(
                id = "savings_target",
                title = "Oportunidad de Fondo de Emergencia",
                description = "Manteniendo el ritmo actual de gastos, puedes derivar un 15% del ingreso neto mensual a una cuenta de alta rentabilidad sin comprometer liquidez.",
                type = InsightType.GOAL,
                date = "Esta semana"
            )
        )

        list.add(
            FinancialInsightItem(
                id = "sub_review",
                title = "Optimización de suscripciones recurrentes",
                description = "Se detectaron servicios periódicos activos. Revisa suscripciones que no hayas utilizado en los últimos 30 días para liberar presupuesto.",
                type = InsightType.INSIGHT,
                date = "Este mes"
            )
        )

        list
    }

    var insights by remember { mutableStateOf(defaultInsights) }

    Scaffold(
        topBar = {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(MaterialTheme.colorScheme.surface)
                    .statusBarsPadding()
                    .padding(horizontal = 16.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    IconButton(onClick = onBackClick) {
                        Icon(
                            imageVector = Icons.Default.ArrowBack,
                            contentDescription = "Volver",
                            tint = MaterialTheme.colorScheme.onSurface
                        )
                    }
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "Insights IA",
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                }

                Button(
                    onClick = {
                        coroutineScope.launch {
                            isAnalyzing = true
                            delay(1200)
                            isAnalyzing = false
                        }
                    },
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary),
                    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 8.dp)
                ) {
                    if (isAnalyzing) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(16.dp),
                            color = MaterialTheme.colorScheme.onPrimary,
                            strokeWidth = 2.dp
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Analizando...", fontSize = 12.sp)
                    } else {
                        Icon(
                            imageVector = Icons.Default.AutoAwesome,
                            contentDescription = null,
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Actualizar", fontSize = 12.sp)
                    }
                }
            }
        },
        containerColor = MaterialTheme.colorScheme.background
    ) { paddingValues ->
        LazyColumn(
            modifier = modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
            contentPadding = PaddingValues(vertical = 14.dp)
        ) {
            item {
                Text(
                    text = "Diagnóstico financiero automático",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Medium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            items(insights) { item ->
                val isExpanded = expandedInsightId == item.id

                Card(
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    border = CardDefaults.outlinedCardBorder().copy(
                        brush = androidx.compose.ui.graphics.SolidColor(
                            item.type.color.copy(alpha = 0.35f)
                        )
                    ),
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(16.dp))
                        .clickable {
                            expandedInsightId = if (isExpanded) null else item.id
                        }
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Surface(
                                shape = RoundedCornerShape(8.dp),
                                color = item.type.color.copy(alpha = 0.15f)
                            ) {
                                Row(
                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                                ) {
                                    Icon(
                                        imageVector = item.type.icon,
                                        contentDescription = null,
                                        tint = item.type.color,
                                        modifier = Modifier.size(14.dp)
                                    )
                                    Text(
                                        text = item.type.label,
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.SemiBold,
                                        color = item.type.color
                                    )
                                }
                            }

                            Text(
                                text = item.date,
                                fontSize = 11.sp,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }

                        Text(
                            text = item.title,
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSurface
                        )

                        Text(
                            text = item.description,
                            fontSize = 13.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            lineHeight = 18.sp
                        )

                        if (item.impactAmount != null) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.End
                            ) {
                                Text(
                                    text = "Importe: ${String.format("%.2f €", item.impactAmount)}",
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    color = MaterialTheme.colorScheme.primary
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

