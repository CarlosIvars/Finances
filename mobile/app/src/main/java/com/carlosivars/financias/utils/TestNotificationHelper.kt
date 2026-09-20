package com.carlosivars.financias.utils

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import androidx.core.app.NotificationCompat
import com.carlosivars.financias.data.TransactionRepository
import com.carlosivars.financias.notification.NotificationParser
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

object TestNotificationHelper {

    private const val CHANNEL_ID = "financias_test_channel"
    private const val CHANNEL_NAME = "Notificaciones de Prueba FinancIAs"

    fun postRealSystemNotification(
        context: Context,
        title: String,
        text: String,
        subText: String? = null
    ) {
        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Canal para pruebas bancarias en FinancIAs"
                enableVibration(true)
                setShowBadge(true)
            }
            notificationManager.createNotificationChannel(channel)
        }

        val notificationId = (System.currentTimeMillis() % 100000).toInt()

        val builder = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.stat_notify_more)
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
        val parsed = NotificationParser.parse("net.inverline.bancosabadell.officelocator.android", title, text, now)
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
            text = "Has recibido un Bizum de $amountStr EUR de $sender."
        )
    }

    fun sendFakeSabadellCardPayment(context: Context, amount: Double = 34.0, merchant: String = "Mercadona") {
        val amountStr = String.format(java.util.Locale.US, "%.2f", amount).replace('.', ',')
        postRealSystemNotification(
            context = context,
            title = "Banco Sabadell",
            text = "Pago con tarjeta de $amountStr EUR en $merchant."
        )
    }

    fun sendFakeWalletNotification(context: Context, amount: Double = 45.0, merchant: String = "Repsol") {
        val amountStr = String.format(java.util.Locale.US, "%.2f", amount).replace('.', ',')
        postRealSystemNotification(
            context = context,
            title = "Google Wallet",
            text = "$amountStr € en $merchant"
        )
    }
}
