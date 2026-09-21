package com.carlosivars.financias.ui.navigation

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.ui.graphics.vector.ImageVector

/**
 * Las 4 opciones prioritarias de uso frecuente + opción "Más" en el footer de navegación inferior.
 */
enum class FinancIAsTab(
    val title: String,
    val icon: ImageVector
) {
    DASHBOARD("Inicio", Icons.Default.Home),
    TRANSACTIONS("Movimientos", Icons.Default.ReceiptLong),
    ANALYTICS("Análisis", Icons.Default.PieChart),
    BUDGETS("Presupuesto", Icons.Default.AccountBalanceWallet),
    MORE("Más", Icons.Default.Widgets)
}

/**
 * Pantallas y vistas completas accesibles desde el Hub "Más",
 * logrando equivalencia 100% con todas las secciones de la versión web.
 */
enum class SubScreen(
    val title: String,
    val subtitle: String,
    val icon: ImageVector
) {
    BANKING("Bancos", "Colección de apps rastreadas y registro en vivo", Icons.Default.AccountBalance),
    CATEGORIES("Categorías", "Árbol jerárquico de categorías y subcategorías", Icons.Default.Category),
    INSIGHTS("Insights IA", "Recomendaciones financieras y detección de anomalías", Icons.Default.AutoAwesome),
    PRIVACY("Privacidad", "Cifrado local SQLCipher y control de datos personales", Icons.Default.Shield),
    SETTINGS("Ajustes", "Configuración de IA, backend y preferencias del sistema", Icons.Default.Settings)
}
