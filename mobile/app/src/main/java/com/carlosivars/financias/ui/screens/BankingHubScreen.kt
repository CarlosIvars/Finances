package com.carlosivars.financias.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.Image
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
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.carlosivars.financias.data.SecurePreferencesManager
import com.carlosivars.financias.model.CapturedNotification
import com.carlosivars.financias.model.InstalledAppInfo
import com.carlosivars.financias.model.InstalledAppsManager
import com.carlosivars.financias.notification.NotificationCapture
import com.carlosivars.financias.notification.NotificationParser
import com.carlosivars.financias.ui.theme.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BankingHubScreen(
    securePrefs: SecurePreferencesManager,
    isTrackerActive: Boolean,
    onOpenSettings: () -> Unit,
    onTriggerTestBizum: () -> Unit,
    onTriggerTestSabadellCard: () -> Unit,
    onTriggerTestWallet: () -> Unit,
    onTriggerTestBbva: (() -> Unit)? = null,
    onTriggerTestSantander: (() -> Unit)? = null,
    onTriggerTestRevolut: (() -> Unit)? = null,
    onBackClick: (() -> Unit)? = null
) {
    val context = LocalContext.current
    val capturedNotifications by NotificationCapture.notifications.collectAsState()

    var monitoredPackages by remember { mutableStateOf(securePrefs.getMonitoredPackages()) }
    var selectedFilterPackage by remember { mutableStateOf<String?>(null) }
    var isAppManagerExpanded by remember { mutableStateOf(true) }
    var isOtherAppsExpanded by remember { mutableStateOf(false) }
    var otherAppsSearchQuery by remember { mutableStateOf("") }

    // Carga asíncrona de aplicaciones reales instaladas en el dispositivo
    var installedApps by remember { mutableStateOf<List<InstalledAppInfo>>(emptyList()) }
    var isLoadingApps by remember { mutableStateOf(true) }

    LaunchedEffect(Unit) {
        withContext(Dispatchers.IO) {
            val apps = InstalledAppsManager.getInstalledApps(context)
            withContext(Dispatchers.Main) {
                installedApps = apps
                isLoadingApps = false
            }
        }
    }

    // Dividir apps en financieras detectadas y el resto de apps instaladas
    val detectedFinancialApps = remember(installedApps) {
        installedApps.filter { it.isFinancial }
    }

    val otherInstalledApps = remember(installedApps, otherAppsSearchQuery) {
        val nonFinancial = installedApps.filter { !it.isFinancial }
        if (otherAppsSearchQuery.isBlank()) {
            nonFinancial
        } else {
            nonFinancial.filter {
                it.appName.contains(otherAppsSearchQuery, ignoreCase = true) ||
                it.packageName.contains(otherAppsSearchQuery, ignoreCase = true)
            }
        }
    }

    val activeInstalledApps = remember(installedApps, monitoredPackages) {
        installedApps.filter { monitoredPackages.contains(it.packageName) }
    }

    // Filtrar notificaciones vivas para mostrar únicamente las de las apps seleccionadas
    val filteredNotifications = remember(capturedNotifications, monitoredPackages, selectedFilterPackage) {
        capturedNotifications.filter { notif ->
            val isSelected = securePrefs.isPackageMonitored(notif.packageName) || monitoredPackages.contains(notif.packageName)
            if (!isSelected) return@filter false

            if (selectedFilterPackage != null) {
                notif.packageName == selectedFilterPackage
            } else {
                true
            }
        }
    }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            text = "Bancos & Rastreo",
                            fontSize = 20.sp,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                        Text(
                            text = "Colección de apps instaladas en tu móvil",
                            fontSize = 12.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                },
                navigationIcon = {
                    if (onBackClick != null) {
                        IconButton(onClick = onBackClick) {
                            Icon(
                                imageVector = Icons.Default.ArrowBack,
                                contentDescription = "Volver",
                                tint = MaterialTheme.colorScheme.onSurface
                            )
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface,
                    titleContentColor = MaterialTheme.colorScheme.onSurface,
                    navigationIconContentColor = MaterialTheme.colorScheme.onSurface
                ),
                windowInsets = TopAppBarDefaults.windowInsets
            )
        }
    ) { innerPadding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .background(MaterialTheme.colorScheme.background)
                .padding(innerPadding)
                .padding(horizontal = 16.dp),
            contentPadding = PaddingValues(top = 16.dp, bottom = 48.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // 1. Estado del Servicio de Notificaciones
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    shape = RoundedCornerShape(16.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.25f))
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
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
                                        color = MaterialTheme.colorScheme.onSurface,
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
                                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary),
                                    shape = RoundedCornerShape(10.dp)
                                ) {
                                    Text("Activar", fontSize = 12.sp)
                                }
                            }
                        }
                    }
                }
            }

            // 2. GESTOR DE COLECCIÓN DE APPS INSTALADAS EN EL MÓVIL
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    shape = RoundedCornerShape(16.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.25f))
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        val activeCount = activeInstalledApps.size

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.Apps,
                                        contentDescription = null,
                                        tint = MaterialTheme.colorScheme.primary,
                                        modifier = Modifier.size(20.dp)
                                    )
                                    Text(
                                        text = "Apps Rastreadas en tu Móvil",
                                        color = MaterialTheme.colorScheme.onSurface,
                                        fontSize = 16.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                }
                                Text(
                                    text = if (isLoadingApps) "Escaneando aplicaciones instaladas..."
                                           else "$activeCount apps activadas de ${installedApps.size} instaladas",
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    fontSize = 12.sp
                                )
                            }

                            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                TextButton(
                                    onClick = {
                                        val financialPkgs = detectedFinancialApps.map { it.packageName }.toSet()
                                        val newSet = monitoredPackages.toMutableSet().apply { addAll(financialPkgs) }
                                        monitoredPackages = newSet
                                        securePrefs.setMonitoredPackages(newSet)
                                    },
                                    contentPadding = PaddingValues(horizontal = 8.dp, vertical = 4.dp)
                                ) {
                                    Text("Bancos", fontSize = 11.sp)
                                }
                                TextButton(
                                    onClick = {
                                        monitoredPackages = emptySet()
                                        securePrefs.setMonitoredPackages(emptySet())
                                    },
                                    contentPadding = PaddingValues(horizontal = 8.dp, vertical = 4.dp)
                                ) {
                                    Text("Ninguna", fontSize = 11.sp, color = MaterialTheme.colorScheme.error)
                                }
                                IconButton(
                                    onClick = { isAppManagerExpanded = !isAppManagerExpanded },
                                    modifier = Modifier.size(32.dp)
                                ) {
                                    Icon(
                                        imageVector = if (isAppManagerExpanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                                        contentDescription = "Desplegar",
                                        tint = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                            }
                        }

                        AnimatedVisibility(visible = isAppManagerExpanded) {
                            Column(
                                modifier = Modifier.padding(top = 12.dp),
                                verticalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.15f))

                                if (isLoadingApps) {
                                    Box(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(vertical = 16.dp),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        CircularProgressIndicator(modifier = Modifier.size(24.dp), strokeWidth = 2.dp)
                                    }
                                } else {
                                    Text(
                                        text = "Apps financieras y de pago detectadas en este dispositivo:",
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.Medium
                                    )

                                    if (detectedFinancialApps.isEmpty()) {
                                        Text(
                                            text = "No se han encontrado apps bancarias estándar instaladas. Puedes añadir cualquier app con el buscador inferior.",
                                            color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.8f),
                                            fontSize = 12.sp
                                        )
                                    } else {
                                        detectedFinancialApps.forEach { app ->
                                            InstalledAppRowItem(
                                                app = app,
                                                isSelected = monitoredPackages.contains(app.packageName),
                                                onToggle = { checked ->
                                                    val newSet = monitoredPackages.toMutableSet()
                                                    if (checked) newSet.add(app.packageName) else newSet.remove(app.packageName)
                                                    monitoredPackages = newSet
                                                    securePrefs.setPackageMonitored(app.packageName, checked)
                                                }
                                            )
                                        }
                                    }

                                    // Sección desplegable para añadir cualquier otra app instalada
                                    Spacer(modifier = Modifier.height(4.dp))
                                    Row(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .clip(RoundedCornerShape(8.dp))
                                            .clickable { isOtherAppsExpanded = !isOtherAppsExpanded }
                                            .padding(vertical = 6.dp, horizontal = 4.dp),
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.SpaceBetween
                                    ) {
                                        Row(
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                                        ) {
                                            Icon(
                                                imageVector = if (isOtherAppsExpanded) Icons.Default.RemoveCircle else Icons.Default.AddCircle,
                                                contentDescription = null,
                                                tint = MaterialTheme.colorScheme.primary,
                                                modifier = Modifier.size(18.dp)
                                            )
                                            Text(
                                                text = "Añadir otra aplicación instalada (${otherInstalledApps.size})",
                                                color = MaterialTheme.colorScheme.primary,
                                                fontSize = 13.sp,
                                                fontWeight = FontWeight.SemiBold
                                            )
                                        }

                                        Icon(
                                            imageVector = if (isOtherAppsExpanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                                            contentDescription = null,
                                            tint = MaterialTheme.colorScheme.primary,
                                            modifier = Modifier.size(20.dp)
                                        )
                                    }

                                    AnimatedVisibility(visible = isOtherAppsExpanded) {
                                        Column(
                                            modifier = Modifier.padding(top = 6.dp),
                                            verticalArrangement = Arrangement.spacedBy(8.dp)
                                        ) {
                                            OutlinedTextField(
                                                value = otherAppsSearchQuery,
                                                onValueChange = { otherAppsSearchQuery = it },
                                                placeholder = { Text("Buscar en todas las apps instaladas...", fontSize = 12.sp) },
                                                leadingIcon = {
                                                    Icon(Icons.Default.Search, contentDescription = null, modifier = Modifier.size(18.dp))
                                                },
                                                trailingIcon = {
                                                    if (otherAppsSearchQuery.isNotEmpty()) {
                                                        IconButton(onClick = { otherAppsSearchQuery = "" }) {
                                                            Icon(Icons.Default.Close, contentDescription = null, modifier = Modifier.size(16.dp))
                                                        }
                                                    }
                                                },
                                                modifier = Modifier.fillMaxWidth(),
                                                shape = RoundedCornerShape(10.dp),
                                                singleLine = true
                                            )

                                            otherInstalledApps.take(15).forEach { app ->
                                                InstalledAppRowItem(
                                                    app = app,
                                                    isSelected = monitoredPackages.contains(app.packageName),
                                                    onToggle = { checked ->
                                                        val newSet = monitoredPackages.toMutableSet()
                                                        if (checked) newSet.add(app.packageName) else newSet.remove(app.packageName)
                                                        monitoredPackages = newSet
                                                        securePrefs.setPackageMonitored(app.packageName, checked)
                                                    }
                                                )
                                            }

                                            if (otherInstalledApps.size > 15) {
                                                Text(
                                                    text = "Mostrando 15 de ${otherInstalledApps.size} apps. Usa el buscador para afinar.",
                                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                                    fontSize = 11.sp,
                                                    modifier = Modifier.padding(horizontal = 4.dp)
                                                )
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // 3. Simulador de Pruebas
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    shape = RoundedCornerShape(16.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.25f))
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Science,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.primary,
                                modifier = Modifier.size(20.dp)
                            )
                            Text(
                                text = "Simulador de Pruebas Bancarias",
                                color = MaterialTheme.colorScheme.onSurface,
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }

                        Text(
                            text = "Lanza notificaciones de prueba para verificar el código programático de detección:",
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            fontSize = 12.sp
                        )

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            OutlinedButton(
                                onClick = onTriggerTestBizum,
                                modifier = Modifier.weight(1f),
                                shape = RoundedCornerShape(10.dp),
                                contentPadding = PaddingValues(horizontal = 4.dp, vertical = 6.dp)
                            ) {
                                Text("Bizum (+10€)", fontSize = 11.sp, maxLines = 1)
                            }

                            OutlinedButton(
                                onClick = onTriggerTestSabadellCard,
                                modifier = Modifier.weight(1f),
                                shape = RoundedCornerShape(10.dp),
                                contentPadding = PaddingValues(horizontal = 4.dp, vertical = 6.dp)
                            ) {
                                Text("Sabadell (-34€)", fontSize = 11.sp, maxLines = 1)
                            }

                            OutlinedButton(
                                onClick = onTriggerTestWallet,
                                modifier = Modifier.weight(1f),
                                shape = RoundedCornerShape(10.dp),
                                contentPadding = PaddingValues(horizontal = 4.dp, vertical = 6.dp)
                            ) {
                                Text("Wallet (-45€)", fontSize = 11.sp, maxLines = 1)
                            }
                        }

                        if (onTriggerTestBbva != null || onTriggerTestSantander != null || onTriggerTestRevolut != null) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                if (onTriggerTestBbva != null) {
                                    OutlinedButton(
                                        onClick = onTriggerTestBbva,
                                        modifier = Modifier.weight(1f),
                                        shape = RoundedCornerShape(10.dp),
                                        contentPadding = PaddingValues(horizontal = 4.dp, vertical = 6.dp)
                                    ) {
                                        Text("BBVA (-18€)", fontSize = 11.sp, maxLines = 1)
                                    }
                                }
                                if (onTriggerTestSantander != null) {
                                    OutlinedButton(
                                        onClick = onTriggerTestSantander,
                                        modifier = Modifier.weight(1f),
                                        shape = RoundedCornerShape(10.dp),
                                        contentPadding = PaddingValues(horizontal = 4.dp, vertical = 6.dp)
                                    ) {
                                        Text("Santander (-22€)", fontSize = 11.sp, maxLines = 1)
                                    }
                                }
                                if (onTriggerTestRevolut != null) {
                                    OutlinedButton(
                                        onClick = onTriggerTestRevolut,
                                        modifier = Modifier.weight(1f),
                                        shape = RoundedCornerShape(10.dp),
                                        contentPadding = PaddingValues(horizontal = 4.dp, vertical = 6.dp)
                                    ) {
                                        Text("Revolut (-9€)", fontSize = 11.sp, maxLines = 1)
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // 4. REGISTRO EN VIVO (Filtrado exclusivamente a las apps seleccionadas)
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(
                            text = "Registro en Vivo (${filteredNotifications.size})",
                            color = MaterialTheme.colorScheme.onBackground,
                            fontSize = 17.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = "Solo notificaciones de las apps seleccionadas",
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            fontSize = 11.sp
                        )
                    }

                    if (capturedNotifications.isNotEmpty()) {
                        TextButton(onClick = { NotificationCapture.clear() }) {
                            Icon(Icons.Default.DeleteOutline, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("Limpiar", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 12.sp)
                        }
                    }
                }
            }

            // Chips de filtrado rápido por app activa
            if (activeInstalledApps.isNotEmpty()) {
                item {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        FilterChip(
                            selected = selectedFilterPackage == null,
                            onClick = { selectedFilterPackage = null },
                            label = { Text("Todas (${filteredNotifications.size})", fontSize = 11.sp) }
                        )

                        activeInstalledApps.take(3).forEach { app ->
                            FilterChip(
                                selected = selectedFilterPackage == app.packageName,
                                onClick = {
                                    selectedFilterPackage = if (selectedFilterPackage == app.packageName) null else app.packageName
                                },
                                label = { Text(app.appName, fontSize = 11.sp, maxLines = 1) }
                            )
                        }
                    }
                }
            }

            if (filteredNotifications.isEmpty()) {
                item {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                        shape = RoundedCornerShape(16.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.25f))
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(28.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.NotificationsNone,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.size(32.dp)
                            )
                            Text(
                                text = "Sin notificaciones de las apps activas",
                                color = MaterialTheme.colorScheme.onSurface,
                                fontSize = 14.sp,
                                fontWeight = FontWeight.SemiBold
                            )
                            Text(
                                text = "Cuando recibas un aviso bancario de las apps seleccionadas se registrará aquí en tiempo real.",
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                fontSize = 12.sp,
                                textAlign = androidx.compose.ui.text.style.TextAlign.Center
                            )
                        }
                    }
                }
            } else {
                items(filteredNotifications) { notif ->
                    val matchingApp = remember(installedApps, notif.packageName) {
                        installedApps.find { it.packageName.equals(notif.packageName, ignoreCase = true) }
                    }
                    CapturedNotificationItem(notif, matchingApp)
                }
            }
        }
    }
}

@Composable
fun InstalledAppRowItem(
    app: InstalledAppInfo,
    isSelected: Boolean,
    onToggle: (Boolean) -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(
                color = if (isSelected) MaterialTheme.colorScheme.primary.copy(alpha = 0.06f) else Color.Transparent,
                shape = RoundedCornerShape(10.dp)
            )
            .padding(horizontal = 8.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Row(
            modifier = Modifier.weight(1f),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(36.dp)
                    .background(
                        color = if (isSelected) MaterialTheme.colorScheme.primary.copy(alpha = 0.15f)
                        else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.08f),
                        shape = RoundedCornerShape(8.dp)
                    ),
                contentAlignment = Alignment.Center
            ) {
                if (app.iconBitmap != null) {
                    Image(
                        bitmap = app.iconBitmap.asImageBitmap(),
                        contentDescription = app.appName,
                        modifier = Modifier
                            .size(28.dp)
                            .clip(RoundedCornerShape(6.dp))
                    )
                } else {
                    Icon(
                        imageVector = if (app.isFinancial) Icons.Default.AccountBalance else Icons.Default.Apps,
                        contentDescription = null,
                        tint = if (isSelected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.size(18.dp)
                    )
                }
            }

            Column(modifier = Modifier.weight(1f)) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Text(
                        text = app.appName,
                        color = MaterialTheme.colorScheme.onSurface,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 1
                    )
                    if (app.isFinancial) {
                        Surface(
                            color = MaterialTheme.colorScheme.primary.copy(alpha = 0.12f),
                            shape = RoundedCornerShape(4.dp)
                        ) {
                            Text(
                                text = "Financiera",
                                color = MaterialTheme.colorScheme.primary,
                                fontSize = 9.sp,
                                fontWeight = FontWeight.Medium,
                                modifier = Modifier.padding(horizontal = 4.dp, vertical = 1.dp)
                            )
                        }
                    }
                }
                Text(
                    text = app.packageName,
                    color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f),
                    fontSize = 10.sp,
                    fontFamily = FontFamily.Monospace,
                    maxLines = 1
                )
            }
        }

        Switch(
            checked = isSelected,
            onCheckedChange = onToggle,
            colors = SwitchDefaults.colors(
                checkedThumbColor = MaterialTheme.colorScheme.surface,
                checkedTrackColor = MaterialTheme.colorScheme.primary
            ),
            modifier = Modifier.height(28.dp)
        )
    }
}

@Composable
fun CapturedNotificationItem(
    notif: CapturedNotification,
    matchingApp: InstalledAppInfo? = null
) {
    val detectedBank = remember(notif.packageName, matchingApp) {
        matchingApp?.appName ?: NotificationParser.detectBankName(notif.packageName)
    }

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        shape = RoundedCornerShape(12.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.2f))
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    if (matchingApp?.iconBitmap != null) {
                        Image(
                            bitmap = matchingApp.iconBitmap.asImageBitmap(),
                            contentDescription = null,
                            modifier = Modifier
                                .size(16.dp)
                                .clip(RoundedCornerShape(3.dp))
                        )
                    }
                    Surface(
                        color = MaterialTheme.colorScheme.primary.copy(alpha = 0.12f),
                        shape = RoundedCornerShape(6.dp)
                    ) {
                        Text(
                            text = detectedBank,
                            color = MaterialTheme.colorScheme.primary,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.SemiBold,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp)
                        )
                    }
                }

                Text(
                    text = notif.formattedTime,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    fontSize = 11.sp
                )
            }

            Text(
                text = if (notif.title.isNotBlank()) notif.title else "Notificación",
                color = MaterialTheme.colorScheme.onSurface,
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold
            )

            Text(
                text = notif.text,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                fontSize = 13.sp,
                lineHeight = 17.sp
            )

            Text(
                text = notif.packageName,
                color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f),
                fontSize = 10.sp,
                fontFamily = FontFamily.Monospace
            )
        }
    }
}
