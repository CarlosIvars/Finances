package com.carlosivars.financias.ui.screens

import androidx.compose.foundation.background
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.carlosivars.financias.model.CapturedNotification
import com.carlosivars.financias.notification.NotificationCapture
import com.carlosivars.financias.ui.theme.*

@Composable
fun BankingHubScreen(
    isTrackerActive: Boolean,
    onOpenSettings: () -> Unit,
    onTriggerTestBizum: () -> Unit,
    onTriggerTestSabadellCard: () -> Unit,
    onTriggerTestWallet: () -> Unit
) {
    val capturedNotifications by NotificationCapture.notifications.collectAsState()

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(DarkBackground)
            .padding(horizontal = 20.dp),
        contentPadding = PaddingValues(top = 20.dp, bottom = 100.dp),
        verticalArrangement = Arrangement.spacedBy(18.dp)
    ) {
        // Header
        item {
            Column {
                Text(
                    text = "Bancos & Rastreo",
                    color = TextPrimary,
                    fontSize = 24.sp,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = "Conexión en tiempo real con Sabadell, Bizum y Wallet",
                    color = TextSecondary,
                    fontSize = 13.sp
                )
            }
        }

        // Estado del Servicio del Sistema
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = CardBackground),
                shape = RoundedCornerShape(20.dp)
            ) {
                Column(modifier = Modifier.padding(20.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(42.dp)
                                    .background(
                                        if (isTrackerActive) IncomeGreen.copy(alpha = 0.15f) else ExpenseRed.copy(alpha = 0.15f),
                                        shape = RoundedCornerShape(12.dp)
                                    ),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    Icons.Default.Security,
                                    contentDescription = null,
                                    tint = if (isTrackerActive) IncomeGreen else ExpenseRed,
                                    modifier = Modifier.size(22.dp)
                                )
                            }

                            Column {
                                Text(
                                    text = "Rastreador de Pagos",
                                    color = TextPrimary,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 16.sp
                                )
                                Text(
                                    text = if (isTrackerActive) "Activo y escuchando en segundo plano" else "Requiere permiso de notificaciones",
                                    color = if (isTrackerActive) IncomeGreen else ExpenseRed,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Medium
                                )
                            }
                        }

                        if (!isTrackerActive) {
                            Button(
                                onClick = onOpenSettings,
                                colors = ButtonDefaults.buttonColors(containerColor = PrimaryAccent),
                                shape = RoundedCornerShape(10.dp)
                            ) {
                                Text("Activar", fontSize = 12.sp)
                            }
                        }
                    }
                }
            }
        }

        // Entidades Soportadas
        item {
            Text("Conexiones Integradas", color = TextPrimary, fontSize = 18.sp, fontWeight = FontWeight.Bold)
        }

        item {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                BankEntityItem(
                    name = "Banco Sabadell",
                    badge = "Oficial",
                    details = "Detecta compras con tarjeta y Bizums recibidos/enviados",
                    icon = "🏦",
                    isActive = isTrackerActive
                )
                BankEntityItem(
                    name = "Bizum",
                    badge = "Instantáneo",
                    details = "Intercepción automática de cobros y pagos inmediatos",
                    icon = "💸",
                    isActive = isTrackerActive
                )
                BankEntityItem(
                    name = "Google Wallet",
                    badge = "NFC / Contactless",
                    details = "Detecta pagos móviles realizados en comercios físicos y web",
                    icon = "📱",
                    isActive = isTrackerActive
                )
            }
        }

        // Simulador de Pruebas
        item {
            Text("Simulador de Pruebas", color = TextPrimary, fontSize = 18.sp, fontWeight = FontWeight.Bold)
        }

        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = CardBackground),
                shape = RoundedCornerShape(16.dp)
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Text(
                        text = "Puedes enviar notificaciones bancarias simuladas para comprobar el funcionamiento instantáneo:",
                        color = TextSecondary,
                        fontSize = 13.sp
                    )

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        OutlinedButton(
                            onClick = onTriggerTestBizum,
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(10.dp)
                        ) {
                            Text("Bizum (+10€)", fontSize = 11.sp, maxLines = 1)
                        }

                        OutlinedButton(
                            onClick = onTriggerTestSabadellCard,
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(10.dp)
                        ) {
                            Text("Sabadell (-34€)", fontSize = 11.sp, maxLines = 1)
                        }

                        OutlinedButton(
                            onClick = onTriggerTestWallet,
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(10.dp)
                        ) {
                            Text("Wallet (-45€)", fontSize = 11.sp, maxLines = 1)
                        }
                    }
                }
            }
        }

        // Log en vivo de capturas
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Registro en Vivo (${capturedNotifications.size})",
                    color = TextPrimary,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold
                )

                if (capturedNotifications.isNotEmpty()) {
                    TextButton(onClick = { NotificationCapture.clear() }) {
                        Text("Limpiar", color = TextSecondary, fontSize = 12.sp)
                    }
                }
            }
        }

        if (capturedNotifications.isEmpty()) {
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = CardBackground),
                    shape = RoundedCornerShape(16.dp)
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text(
                            text = "No hay eventos en el registro en esta sesión",
                            color = TextSecondary,
                            fontSize = 13.sp
                        )
                    }
                }
            }
        } else {
            items(capturedNotifications) { notif ->
                CapturedNotificationItem(notif)
            }
        }
    }
}

@Composable
fun BankEntityItem(
    name: String,
    badge: String,
    details: String,
    icon: String,
    isActive: Boolean
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
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
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                modifier = Modifier.weight(1f)
            ) {
                Box(
                    modifier = Modifier
                        .size(40.dp)
                        .background(PrimaryAccent.copy(alpha = 0.15f), shape = RoundedCornerShape(10.dp)),
                    contentAlignment = Alignment.Center
                ) {
                    Text(icon, fontSize = 20.sp)
                }

                Column {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Text(name, color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                        Surface(
                            color = PrimaryAccent.copy(alpha = 0.15f),
                            shape = RoundedCornerShape(6.dp)
                        ) {
                            Text(
                                text = badge,
                                color = PrimaryAccent,
                                fontSize = 10.sp,
                                fontWeight = FontWeight.SemiBold,
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                            )
                        }
                    }
                    Spacer(modifier = Modifier.height(2.dp))
                    Text(details, color = TextSecondary, fontSize = 12.sp)
                }
            }

            Box(
                modifier = Modifier
                    .size(10.dp)
                    .background(if (isActive) IncomeGreen else ExpenseRed, shape = CircleShape)
            )
        }
    }
}

@Composable
fun CapturedNotificationItem(notif: CapturedNotification) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = CardBackground),
        shape = RoundedCornerShape(12.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = notif.title,
                    color = TextPrimary,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = notif.formattedTime,
                    color = TextSecondary,
                    fontSize = 11.sp
                )
            }
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = notif.text,
                color = TextSecondary,
                fontSize = 12.sp
            )
        }
    }
}
