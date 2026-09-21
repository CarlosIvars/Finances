package com.carlosivars.financias.model

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.ui.graphics.vector.ImageVector

data class SupportedBankApp(
    val id: String,
    val name: String,
    val packageName: String,
    val alternativePackages: List<String> = emptyList(),
    val description: String,
    val supportedFeatures: String,
    val icon: ImageVector,
    val isDefaultEnabled: Boolean = true
) {
    fun matchesPackage(pkg: String): Boolean {
        if (pkg.equals(packageName, ignoreCase = true)) return true
        if (alternativePackages.any { pkg.equals(it, ignoreCase = true) }) return true
        // Matching heurístico por subcadena de paquete
        val lowerPkg = pkg.lowercase()
        return when (id) {
            "sabadell" -> lowerPkg.contains("sabadell") || lowerPkg.contains("inverline")
            "wallet" -> lowerPkg.contains("wallet") || lowerPkg == "com.google.android.gms"
            "bbva" -> lowerPkg.contains("bbva")
            "santander" -> lowerPkg.contains("santander")
            "caixabank" -> lowerPkg.contains("caixabank") || lowerPkg.contains("imagin")
            "revolut" -> lowerPkg.contains("revolut")
            "n26" -> lowerPkg.contains("number26") || lowerPkg.contains("n26")
            "ing" -> lowerPkg.contains("ing.mobile") || lowerPkg.contains("ingdirect")
            "openbank" -> lowerPkg.contains("openbank")
            "financias_test" -> lowerPkg.contains("com.carlosivars.financias")
            else -> false
        }
    }

    companion object {
        val ALL = listOf(
            SupportedBankApp(
                id = "sabadell",
                name = "Banco Sabadell",
                packageName = "net.inverline.bancosabadell.officelocator.android",
                alternativePackages = listOf("net.inverline.bancosabadell", "com.bancosabadell.wallet"),
                description = "Compras con tarjeta, TPV físico y online, Bizums recibidos y enviados",
                supportedFeatures = "Tarjetas, TPV y Bizum",
                icon = Icons.Default.AccountBalance,
                isDefaultEnabled = true
            ),
            SupportedBankApp(
                id = "wallet",
                name = "Google Wallet",
                packageName = "com.google.android.apps.walletnfcrel",
                alternativePackages = listOf("com.google.android.gms"),
                description = "Pagos NFC sin contacto en comercios físicos y suscripciones digitales",
                supportedFeatures = "NFC Contactless & Online",
                icon = Icons.Default.CreditCard,
                isDefaultEnabled = true
            ),
            SupportedBankApp(
                id = "bbva",
                name = "BBVA España",
                packageName = "com.bbva.bbvacontigo",
                alternativePackages = listOf("com.bbva.netcash"),
                description = "Compras con tarjeta de crédito/débito, Bizum y pagos en comercios",
                supportedFeatures = "Compras tarjeta y Bizum",
                icon = Icons.Default.AccountBalance,
                isDefaultEnabled = true
            ),
            SupportedBankApp(
                id = "santander",
                name = "Banco Santander",
                packageName = "es.santander.apps.android",
                alternativePackages = listOf("es.santander.wallet"),
                description = "Avisos de cargos con tarjeta Santander, transferencias y Bizum",
                supportedFeatures = "Pagos tarjeta y Bizum",
                icon = Icons.Default.AccountBalance,
                isDefaultEnabled = true
            ),
            SupportedBankApp(
                id = "caixabank",
                name = "CaixaBank & Imagin",
                packageName = "es.caixabank.mobile.android",
                alternativePackages = listOf("es.imagin.mobile", "com.caixabank.now"),
                description = "Operaciones con tarjeta imagin, compras TPV y alertas de saldo",
                supportedFeatures = "imagin & CaixaBank TPV",
                icon = Icons.Default.AccountBalance,
                isDefaultEnabled = true
            ),
            SupportedBankApp(
                id = "revolut",
                name = "Revolut",
                packageName = "com.revolut.revolut",
                alternativePackages = emptyList(),
                description = "Gastos en comercios locales y compras internacionales multimoneda",
                supportedFeatures = "Multimoneda instantáneo",
                icon = Icons.Default.SwapHoriz,
                isDefaultEnabled = true
            ),
            SupportedBankApp(
                id = "n26",
                name = "N26",
                packageName = "de.number26.android",
                alternativePackages = emptyList(),
                description = "Notificaciones instantáneas de pagos con Mastercard y retiros",
                supportedFeatures = "Push instantáneo",
                icon = Icons.Default.CreditCard,
                isDefaultEnabled = true
            ),
            SupportedBankApp(
                id = "ing",
                name = "ING España",
                packageName = "es.ing.mobile",
                alternativePackages = listOf("es.ingdirect.android"),
                description = "Pagos con tarjeta de débito/crédito ING y movimientos de cuenta",
                supportedFeatures = "Compras y Nómina",
                icon = Icons.Default.AccountBalance,
                isDefaultEnabled = true
            ),
            SupportedBankApp(
                id = "openbank",
                name = "Openbank",
                packageName = "com.openbank",
                alternativePackages = listOf("es.openbank.mobile"),
                description = "Compras con tarjeta Openbank y alertas de transacciones",
                supportedFeatures = "Tarjetas y transferencias",
                icon = Icons.Default.AccountBalance,
                isDefaultEnabled = true
            ),
            SupportedBankApp(
                id = "financias_test",
                name = "Suite Pruebas FinancIAs",
                packageName = "com.carlosivars.financias",
                alternativePackages = emptyList(),
                description = "Simulaciones internas y validación de expresiones regulares de prueba",
                supportedFeatures = "Simulador y Debug",
                icon = Icons.Default.Science,
                isDefaultEnabled = true
            )
        )

        val DEFAULT_ENABLED_IDS: Set<String> = ALL.filter { it.isDefaultEnabled }.map { it.id }.toSet()

        fun findById(id: String): SupportedBankApp? {
            return ALL.find { it.id.equals(id, ignoreCase = true) }
        }

        fun findByPackage(pkg: String): SupportedBankApp? {
            return ALL.find { it.matchesPackage(pkg) }
        }

        fun isAnySupported(pkg: String): Boolean {
            return ALL.any { it.matchesPackage(pkg) }
        }
    }
}

