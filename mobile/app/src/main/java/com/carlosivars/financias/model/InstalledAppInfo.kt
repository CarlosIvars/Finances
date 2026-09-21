package com.carlosivars.financias.model

import android.content.Context
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.drawable.BitmapDrawable
import android.graphics.drawable.Drawable

data class InstalledAppInfo(
    val packageName: String,
    val appName: String,
    val isFinancial: Boolean,
    val iconBitmap: Bitmap? = null
)

object InstalledAppsManager {

    private val FINANCIAL_KEYWORDS = listOf(
        "sabadell", "inverline",
        "bbva",
        "santander",
        "caixa", "imagin",
        "revolut",
        "n26", "number26",
        "ing", "ingdirect",
        "openbank",
        "bankinter",
        "unicaja",
        "kutxa", "kutxabank", "cajasur",
        "abanca",
        "ibercaja",
        "cajamar",
        "laboralkutxa",
        "wizink",
        "triodos",
        "pibank",
        "myinvestor",
        "trade republic", "traderepublic",
        "degiro",
        "scalable",
        "paypal",
        "wise",
        "wallet",
        "bizum",
        "splitwise",
        "binance", "coinbase", "crypto",
        "banco", "bank", "banca", "caja",
        "tarjeta", "pagos", "pay"
    )

    fun drawableToBitmap(drawable: Drawable?): Bitmap? {
        if (drawable == null) return null
        if (drawable is BitmapDrawable && drawable.bitmap != null) {
            return drawable.bitmap
        }
        return try {
            val width = if (drawable.intrinsicWidth > 0) Math.min(drawable.intrinsicWidth, 144) else 96
            val height = if (drawable.intrinsicHeight > 0) Math.min(drawable.intrinsicHeight, 144) else 96
            val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
            val canvas = Canvas(bitmap)
            drawable.setBounds(0, 0, canvas.width, canvas.height)
            drawable.draw(canvas)
            bitmap
        } catch (_: Exception) {
            null
        }
    }

    fun isAppFinancial(packageName: String, appName: String, appInfo: ApplicationInfo?): Boolean {
        // Nuestra propia app siempre se considera financiera/prueba
        if (packageName.equals("com.carlosivars.financias", ignoreCase = true)) return true

        // Detección heurística por palabras clave en paquete y nombre de la app

        val lowerPkg = packageName.lowercase()
        val lowerName = appName.lowercase()

        return FINANCIAL_KEYWORDS.any { keyword ->
            lowerPkg.contains(keyword) || lowerName.contains(keyword)
        }
    }

    fun getInstalledApps(context: Context): List<InstalledAppInfo> {
        val pm = context.packageManager
        val mainIntent = Intent(Intent.ACTION_MAIN, null).apply {
            addCategory(Intent.CATEGORY_LAUNCHER)
        }

        val resolveInfos = try {
            pm.queryIntentActivities(mainIntent, 0)
        } catch (_: Exception) {
            emptyList()
        }

        val seenPackages = mutableSetOf<String>()
        val result = mutableListOf<InstalledAppInfo>()

        for (info in resolveInfos) {
            val pkg = info.activityInfo?.packageName ?: continue
            if (seenPackages.contains(pkg)) continue
            seenPackages.add(pkg)

            val name = try {
                info.loadLabel(pm)?.toString() ?: pkg
            } catch (_: Exception) {
                pkg
            }

            val appInfo = try {
                info.activityInfo?.applicationInfo ?: pm.getApplicationInfo(pkg, 0)
            } catch (_: Exception) {
                null
            }

            val isFinancial = isAppFinancial(pkg, name, appInfo)
            val iconDrawable = try {
                info.loadIcon(pm)
            } catch (_: Exception) {
                null
            }
            val bitmap = drawableToBitmap(iconDrawable)

            result.add(
                InstalledAppInfo(
                    packageName = pkg,
                    appName = name,
                    isFinancial = isFinancial,
                    iconBitmap = bitmap
                )
            )
        }

        // Si FinancIAs no está en el listado por algún motivo, la añadimos para pruebas
        if (!seenPackages.contains(context.packageName)) {
            val ourAppInfo = try {
                pm.getApplicationInfo(context.packageName, 0)
            } catch (_: Exception) {
                null
            }
            val ourLabel = ourAppInfo?.let { pm.getApplicationLabel(it).toString() } ?: "FinancIAs"
            val ourIcon = ourAppInfo?.let { pm.getApplicationIcon(it) }
            result.add(
                0,
                InstalledAppInfo(
                    packageName = context.packageName,
                    appName = "$ourLabel (Suite Pruebas)",
                    isFinancial = true,
                    iconBitmap = drawableToBitmap(ourIcon)
                )
            )
        }

        // Ordenar: primero las financieras detectadas (alfabéticamente), luego el resto
        return result.sortedWith(
            compareByDescending<InstalledAppInfo> { it.isFinancial }
                .thenBy { it.appName.lowercase() }
        )
    }
}

