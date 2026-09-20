package com.carlosivars.financias.ui.screens

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.carlosivars.financias.data.SecurePreferencesManager
import com.carlosivars.financias.ui.theme.*
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    securePrefs: SecurePreferencesManager,
    totalTransactionsCount: Int,
    onBackClick: () -> Unit,
    onExportBackup: suspend () -> String,
    onRestoreBackup: suspend (String) -> Result<Int>,
    onTestConnection: suspend (url: String, token: String) -> Pair<Boolean, String>,
    onClearAllData: suspend () -> Unit,
    onOpenNotificationSettings: () -> Unit
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()

    var isCloudSyncEnabled by remember { mutableStateOf(securePrefs.isCloudSyncEnabled) }
    var serverUrl by remember { mutableStateOf(securePrefs.cloudServerUrl) }
    var authToken by remember { mutableStateOf(securePrefs.cloudAuthToken) }
    var isPasswordVisible by remember { mutableStateOf(false) }

    var isSabadellEnabled by remember { mutableStateOf(securePrefs.isSabadellTrackerEnabled) }
    var isBizumEnabled by remember { mutableStateOf(securePrefs.isBizumTrackerEnabled) }
    var isWalletEnabled by remember { mutableStateOf(securePrefs.isWalletTrackerEnabled) }

    var isTestingConnection by remember { mutableStateOf(false) }
    var connectionTestResult by remember { mutableStateOf<Pair<Boolean, String>?>(null) }

    var showExportDialog by remember { mutableStateOf(false) }
    var exportJsonContent by remember { mutableStateOf("") }

    var showRestoreDialog by remember { mutableStateOf(false) }
    var restoreJsonInput by remember { mutableStateOf("") }

    var showClearDataConfirmDialog by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = "Ajustes y Seguridad",
                        color = TextPrimary,
                        fontWeight = FontWeight.Bold,
                        fontSize = 20.sp
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Volver", tint = TextPrimary)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = DarkBackground)
            )
        },
        containerColor = DarkBackground
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 20.dp),
            contentPadding = PaddingValues(top = 10.dp, bottom = 60.dp),
            verticalArrangement = Arrangement.spacedBy(20.dp)
        ) {
            // BLOQUE 1: Seguridad y Cifrado
            item {
                Text(
                    text = "🛡️ Base de Datos y Cifrado",
                    color = TextPrimary,
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Bold
                )
            }

            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = CardBackground),
                    shape = RoundedCornerShape(16.dp)
                ) {
                    Column(
                        modifier = Modifier.padding(18.dp),
                        verticalArrangement = Arrangement.spacedBy(14.dp)
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(10.dp)
                                    .background(IncomeGreen, shape = CircleShape)
                            )
                            Column {
                                Text(
                                    text = "Cifrado por Hardware Activo",
                                    color = TextPrimary,
                                    fontSize = 15.sp,
                                    fontWeight = FontWeight.SemiBold
                                )
                                Text(
                                    text = "Android Keystore / Samsung Knox (AES-256)",
                                    color = IncomeGreen,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Medium
                                )
                            }
                        }

                        Divider(color = CardBorder)

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text("Movimientos almacenados:", color = TextSecondary, fontSize = 13.sp)
                            Text("$totalTransactionsCount operaciones", color = TextPrimary, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                        }

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text("Persistencia en actualizaciones:", color = TextSecondary, fontSize = 13.sp)
                            Text("Garantizada (SQLite)", color = IncomeGreen, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                        }

                        Spacer(modifier = Modifier.height(4.dp))

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            OutlinedButton(
                                onClick = {
                                    coroutineScope.launch {
                                        exportJsonContent = onExportBackup()
                                        showExportDialog = true
                                    }
                                },
                                modifier = Modifier.weight(1f),
                                shape = RoundedCornerShape(10.dp)
                            ) {
                                Icon(Icons.Default.Upload, contentDescription = null, modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(6.dp))
                                Text("Exportar", fontSize = 12.sp)
                            }

                            OutlinedButton(
                                onClick = {
                                    restoreJsonInput = ""
                                    showRestoreDialog = true
                                },
                                modifier = Modifier.weight(1f),
                                shape = RoundedCornerShape(10.dp)
                            ) {
                                Icon(Icons.Default.Download, contentDescription = null, modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(6.dp))
                                Text("Restaurar", fontSize = 12.sp)
                            }
                        }

                        OutlinedButton(
                            onClick = { showClearDataConfirmDialog = true },
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(10.dp),
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = ExpenseRed)
                        ) {
                            Icon(Icons.Default.DeleteOutline, contentDescription = null, tint = ExpenseRed, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Borrar Base de Datos Local", fontSize = 12.sp, color = ExpenseRed)
                        }
                    }
                }
            }

            // BLOQUE 2: Sincronización en la Nube (Futura)
            item {
                Text(
                    text = "☁️ Servidor Cloud / Backend (Preparación)",
                    color = TextPrimary,
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Bold
                )
            }

            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = CardBackground),
                    shape = RoundedCornerShape(16.dp)
                ) {
                    Column(
                        modifier = Modifier.padding(18.dp),
                        verticalArrangement = Arrangement.spacedBy(14.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = "Sincronización en la Nube",
                                    color = TextPrimary,
                                    fontSize = 15.sp,
                                    fontWeight = FontWeight.SemiBold
                                )
                                Text(
                                    text = if (isCloudSyncEnabled) "Conectando con tu servidor privado" else "Desactivado (Modo 100% Local)",
                                    color = if (isCloudSyncEnabled) PrimaryAccent else TextSecondary,
                                    fontSize = 12.sp
                                )
                            }

                            Switch(
                                checked = isCloudSyncEnabled,
                                onCheckedChange = {
                                    isCloudSyncEnabled = it
                                    securePrefs.isCloudSyncEnabled = it
                                },
                                colors = SwitchDefaults.colors(
                                    checkedThumbColor = PrimaryAccent,
                                    checkedTrackColor = PrimaryAccent.copy(alpha = 0.3f)
                                )
                            )
                        }

                        OutlinedTextField(
                            value = serverUrl,
                            onValueChange = {
                                serverUrl = it
                                securePrefs.cloudServerUrl = it
                                connectionTestResult = null
                            },
                            label = { Text("URL del Servidor / Backend") },
                            placeholder = { Text("https://mi-servidor.com/api") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth(),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = PrimaryAccent,
                                focusedLabelColor = PrimaryAccent
                            )
                        )

                        OutlinedTextField(
                            value = authToken,
                            onValueChange = {
                                authToken = it
                                securePrefs.cloudAuthToken = it
                                connectionTestResult = null
                            },
                            label = { Text("Token de Acceso / API Key") },
                            placeholder = { Text("Token JWT o secreto...") },
                            singleLine = true,
                            visualTransformation = if (isPasswordVisible) VisualTransformation.None else PasswordVisualTransformation(),
                            trailingIcon = {
                                IconButton(onClick = { isPasswordVisible = !isPasswordVisible }) {
                                    Icon(
                                        if (isPasswordVisible) Icons.Default.Visibility else Icons.Default.VisibilityOff,
                                        contentDescription = null,
                                        tint = TextSecondary
                                    )
                                }
                            },
                            modifier = Modifier.fillMaxWidth(),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = PrimaryAccent,
                                focusedLabelColor = PrimaryAccent
                            )
                        )

                        // Botón de prueba de conexión
                        Button(
                            onClick = {
                                coroutineScope.launch {
                                    isTestingConnection = true
                                    connectionTestResult = null
                                    val result = onTestConnection(serverUrl.trim(), authToken.trim())
                                    connectionTestResult = result
                                    isTestingConnection = false
                                }
                            },
                            enabled = !isTestingConnection && serverUrl.isNotBlank(),
                            modifier = Modifier.fillMaxWidth(),
                            colors = ButtonDefaults.buttonColors(containerColor = PrimaryAccent),
                            shape = RoundedCornerShape(10.dp)
                        ) {
                            if (isTestingConnection) {
                                CircularProgressIndicator(color = Color.White, modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                                Spacer(modifier = Modifier.width(8.dp))
                                Text("Comprobando...", fontSize = 13.sp)
                            } else {
                                Icon(Icons.Default.NetworkCheck, contentDescription = null, modifier = Modifier.size(18.dp))
                                Spacer(modifier = Modifier.width(8.dp))
                                Text("Probar Conexión con el Servidor", fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                            }
                        }

                        // Mensaje de resultado de prueba
                        connectionTestResult?.let { (success, message) ->
                            Surface(
                                color = if (success) IncomeGreen.copy(alpha = 0.15f) else ExpenseRed.copy(alpha = 0.15f),
                                shape = RoundedCornerShape(10.dp),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Row(
                                    modifier = Modifier.padding(12.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    Icon(
                                        if (success) Icons.Default.CheckCircle else Icons.Default.Error,
                                        contentDescription = null,
                                        tint = if (success) IncomeGreen else ExpenseRed,
                                        modifier = Modifier.size(20.dp)
                                    )
                                    Text(
                                        text = message,
                                        color = if (success) IncomeGreen else ExpenseRed,
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.Medium
                                    )
                                }
                            }
                        }
                    }
                }
            }

            // BLOQUE 3: Entidades del Rastreador
            item {
                Text(
                    text = "🔔 Entidades de Rastreo",
                    color = TextPrimary,
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Bold
                )
            }

            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = CardBackground),
                    shape = RoundedCornerShape(16.dp)
                ) {
                    Column(
                        modifier = Modifier.padding(18.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        TrackerEntityToggle(
                            title = "Banco Sabadell",
                            subtitle = "Pagos con tarjeta y Bizums",
                            checked = isSabadellEnabled,
                            onCheckedChange = {
                                isSabadellEnabled = it
                                securePrefs.isSabadellTrackerEnabled = it
                            }
                        )
                        Divider(color = CardBorder)
                        TrackerEntityToggle(
                            title = "Bizum",
                            subtitle = "Intercepción de cobros y envíos",
                            checked = isBizumEnabled,
                            onCheckedChange = {
                                isBizumEnabled = it
                                securePrefs.isBizumTrackerEnabled = it
                            }
                        )
                        Divider(color = CardBorder)
                        TrackerEntityToggle(
                            title = "Google Wallet",
                            subtitle = "Pagos Contactless / NFC",
                            checked = isWalletEnabled,
                            onCheckedChange = {
                                isWalletEnabled = it
                                securePrefs.isWalletTrackerEnabled = it
                            }
                        )

                        Spacer(modifier = Modifier.height(4.dp))

                        OutlinedButton(
                            onClick = onOpenNotificationSettings,
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(10.dp)
                        ) {
                            Icon(Icons.Default.Settings, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Ajustes de Notificaciones del Sistema", fontSize = 12.sp)
                        }
                    }
                }
            }

            // BLOQUE 4: Info
            item {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 12.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = "FinancIAs v1.0.0 (Local-First Secured)",
                        color = TextSecondary,
                        fontSize = 12.sp
                    )
                    Text(
                        text = "Cifrado con hardware Android Keystore",
                        color = TextMuted,
                        fontSize = 11.sp
                    )
                }
            }
        }
    }

    // Modal Exportar Backup
    if (showExportDialog) {
        AlertDialog(
            onDismissRequest = { showExportDialog = false },
            title = { Text("Copia de Seguridad Generada", color = TextPrimary, fontWeight = FontWeight.Bold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Se ha generado un volcado completo de tus transacciones y presupuestos:", color = TextSecondary, fontSize = 13.sp)
                    OutlinedTextField(
                        value = exportJsonContent,
                        onValueChange = {},
                        readOnly = true,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(180.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = TextPrimary,
                            unfocusedTextColor = TextPrimary
                        )
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                        val clip = ClipData.newPlainText("FinancIAs Backup", exportJsonContent)
                        clipboard.setPrimaryClip(clip)
                        Toast.makeText(context, "Copia copiada al portapapeles", Toast.LENGTH_SHORT).show()
                        showExportDialog = false
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = PrimaryAccent)
                ) {
                    Text("Copiar al portapapeles")
                }
            },
            dismissButton = {
                TextButton(onClick = { showExportDialog = false }) {
                    Text("Cerrar", color = TextSecondary)
                }
            },
            containerColor = CardBackground,
            shape = RoundedCornerShape(16.dp)
        )
    }

    // Modal Restaurar Backup
    if (showRestoreDialog) {
        AlertDialog(
            onDismissRequest = { showRestoreDialog = false },
            title = { Text("Restaurar Copia de Seguridad", color = TextPrimary, fontWeight = FontWeight.Bold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Pega aquí el contenido JSON de tu copia de seguridad previa:", color = TextSecondary, fontSize = 13.sp)
                    OutlinedTextField(
                        value = restoreJsonInput,
                        onValueChange = { restoreJsonInput = it },
                        placeholder = { Text("Pega el JSON aquí...") },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(180.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = TextPrimary,
                            unfocusedTextColor = TextPrimary
                        )
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        coroutineScope.launch {
                            val res = onRestoreBackup(restoreJsonInput.trim())
                            if (res.isSuccess) {
                                Toast.makeText(context, "Restaurados ${res.getOrNull()} movimientos con éxito", Toast.LENGTH_SHORT).show()
                                showRestoreDialog = false
                            } else {
                                Toast.makeText(context, "Error al procesar el JSON de backup", Toast.LENGTH_LONG).show()
                            }
                        }
                    },
                    enabled = restoreJsonInput.isNotBlank(),
                    colors = ButtonDefaults.buttonColors(containerColor = PrimaryAccent)
                ) {
                    Text("Restaurar Datos")
                }
            },
            dismissButton = {
                TextButton(onClick = { showRestoreDialog = false }) {
                    Text("Cancelar", color = TextSecondary)
                }
            },
            containerColor = CardBackground,
            shape = RoundedCornerShape(16.dp)
        )
    }

    // Modal Confirmar Borrado de BBDD
    if (showClearDataConfirmDialog) {
        AlertDialog(
            onDismissRequest = { showClearDataConfirmDialog = false },
            title = { Text("¿Borrar todos los datos locales?", color = ExpenseRed, fontWeight = FontWeight.Bold) },
            text = {
                Text(
                    "Esta acción eliminará todas las transacciones y presupuestos guardados en este teléfono. Esta operación no se puede deshacer.",
                    color = TextSecondary,
                    fontSize = 13.sp
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        coroutineScope.launch {
                            onClearAllData()
                            showClearDataConfirmDialog = false
                            Toast.makeText(context, "Base de datos local vaciada", Toast.LENGTH_SHORT).show()
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = ExpenseRed)
                ) {
                    Text("Eliminar Todo", color = Color.White)
                }
            },
            dismissButton = {
                TextButton(onClick = { showClearDataConfirmDialog = false }) {
                    Text("Cancelar", color = TextSecondary)
                }
            },
            containerColor = CardBackground,
            shape = RoundedCornerShape(16.dp)
        )
    }
}

@Composable
fun TrackerEntityToggle(
    title: String,
    subtitle: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(title, color = TextPrimary, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
            Text(subtitle, color = TextSecondary, fontSize = 12.sp)
        }
        Switch(
            checked = checked,
            onCheckedChange = onCheckedChange,
            colors = SwitchDefaults.colors(
                checkedThumbColor = PrimaryAccent,
                checkedTrackColor = PrimaryAccent.copy(alpha = 0.3f)
            )
        )
    }
}

