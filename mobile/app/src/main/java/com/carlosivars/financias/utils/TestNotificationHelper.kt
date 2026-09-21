package com.carlosivars.financias.utils

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.drawable.BitmapDrawable
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.carlosivars.financias.R
import com.carlosivars.financias.data.TransactionRepository
import com.carlosivars.financias.notification.NotificationParser
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

object TestNotificationHelper {

    private const val CHANNEL_ID = "financias_test_channel"
    private const val CHANNEL_NAME = "Notificaciones FinancIAs"

    private fun getAppIconBitmap(context: Context): Bitmap? {
        return try {
            val drawable = ContextCompat.getDrawable(context, R.mipmap.ic_launcher) ?: return null
            if (drawable is BitmapDrawable) {
                return drawable.bitmap
            }
            val width = drawable.intrinsicWidth.takeIf { it > 0 } ?: 192
            val height = drawable.intrinsicHeight.takeIf { it > 0 } ?: 192
            val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
            val canvas = Canvas(bitmap)
            drawable.setBounds(0, 0, canvas.width, canvas.height)
            drawable.draw(canvas)
            bitmap
        } catch (_: Exception) {
            null
        }
    }

    fun postRealSystemNotification(
        context: Context,
        title: String,
        text: String,
        subText: String? = null,
        packageName: String = "com.carlosivars.financias"
    ) {
        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Canal para eventos y alertas de FinancIAs"
                enableVibration(true)
                setShowBadge(true)
            }
            notificationManager.createNotificationChannel(channel)
        }

        val notificationId = (System.currentTimeMillis() % 100000).toInt()
        val largeIcon = getAppIconBitmap(context)

        val builder = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_financias)
            .apply {
                if (largeIcon != null) {
                    setLargeIcon(largeIcon)
                }
            }
            .setColor(Color.parseColor("#3B82F6"))
            .setContentTitle(title)
            .setContentText(text)
            .setStyle(NotificationCompat.BigTextStyle().bigText(text))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)

        if (!subText.isNullOrBlank()) {
            builder.setSubText(subText)
        }

        notificationManager.notify(notificationId, builder.build())

        // Aseguramos también inserción directa en el repositorio para prueba instantánea
        val now = System.currentTimeMillis()
        val parsed = NotificationParser.parse(packageName, title, text, now)
        if (parsed != null) {
            val hash = "test_${now}_${Math.abs(text.hashCode())}"
            CoroutineScope(Dispatchers.IO).launch {
                val repo = TransactionRepository(context)
                repo.saveTransaction(parsed, hash)
            }
        }
    }

    fun sendFakeSabadellBizumReceived(context: Context, amount: Double = 10.0, sender: String = "Carlos") {
        val amountStr = String.format(java.util.Locale.US, "%.2f", amount).replace('.', ',')
        postRealSystemNotification(
            context = context,
            title = "Banco Sabadell",
            text = "Has recibido un Bizum de $amountStr EUR de $sender.",
            packageName = "net.inverline.bancosabadell.officelocator.android"
        )
    }

    fun sendFakeSabadellCardPayment(context: Context, amount: Double = 34.0, merchant: String = "Mercadona") {
        val amountStr = String.format(java.util.Locale.US, "%.2f", amount).replace('.', ',')
        postRealSystemNotification(
            context = context,
            title = "Banco Sabadell",
            text = "Pago con tarjeta de $amountStr EUR en $merchant.",
            packageName = "net.inverline.bancosabadell.officelocator.android"
        )
    }

    fun sendFakeWalletNotification(context: Context, amount: Double = 45.0, merchant: String = "Repsol") {
        val amountStr = String.format(java.util.Locale.US, "%.2f", amount).replace('.', ',')
        postRealSystemNotification(
            context = context,
            title = "Google Wallet",
            text = "$amountStr € en $merchant",
            packageName = "com.google.android.apps.walletnfcrel"
        )
    }

    fun sendFakeBbvaPayment(context: Context, amount: Double = 18.50, merchant: String = "ZARA") {
        val amountStr = String.format(java.util.Locale.US, "%.2f", amount).replace('.', ',')
        postRealSystemNotification(
            context = context,
            title = "BBVA",
            text = "Has realizado un pago de $amountStr € en $merchant con tu tarjeta BBVA.",
            packageName = "com.bbva.bbvacontigo"
        )
    }

    fun sendFakeSantanderPayment(context: Context, amount: Double = 22.0, merchant: String = "Decathlon") {
        val amountStr = String.format(java.util.Locale.US, "%.2f", amount).replace('.', ',')
        postRealSystemNotification(
            context = context,
            title = "Santander",
            text = "Compra con tarjeta Santander de $amountStr EUR en $merchant.",
            packageName = "es.santander.apps.android"
        )
    }

    fun sendFakeRevolutPayment(context: Context, amount: Double = 9.20, merchant: String = "Starbucks") {
        val amountStr = String.format(java.util.Locale.US, "%.2f", amount).replace('.', ',')
        postRealSystemNotification(
            context = context,
            title = "Revolut",
            text = "Has gastado $amountStr € en $merchant",
            packageName = "com.revolut.revolut"
        )
    }
}
