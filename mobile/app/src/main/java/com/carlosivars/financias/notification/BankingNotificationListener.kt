package com.carlosivars.financias.notification

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log
import com.carlosivars.financias.data.TransactionRepository
import com.carlosivars.financias.model.CapturedNotification
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import java.security.MessageDigest

class BankingNotificationListener : NotificationListenerService() {

    companion object {
        private const val TAG = "FinancIAsListener"

        private val ALLOWED_PACKAGES = setOf(
            "net.inverline.bancosabadell.officelocator.android", // Banco Sabadell
            "com.google.android.apps.walletnfcrel",             // Google Wallet
            "com.google.android.gms",                           // Google Play Services Wallet
            "com.carlosivars.financias"                         // FinancIAs (tests)
        )
    }

    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private lateinit var repository: TransactionRepository

    override fun onCreate() {
        super.onCreate()
        repository = TransactionRepository(applicationContext)
    }

    override fun onListenerConnected() {
        super.onListenerConnected()
        Log.i(TAG, "NotificationListener conectado en FinancIAs.")
        NotificationCapture.onServiceConnected()
    }

    override fun onListenerDisconnected() {
        super.onListenerDisconnected()
        Log.i(TAG, "NotificationListener desconectado en FinancIAs.")
        NotificationCapture.onServiceDisconnected()
    }

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        super.onNotificationPosted(sbn)
        if (sbn == null) return

        val packageName = sbn.packageName ?: return

        // 1. Siempre registrar en el capturador de diagnóstico para inspección
        val notification = sbn.notification ?: return
        val extras = notification.extras ?: return

        val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString()
            ?: extras.getCharSequence(Notification.EXTRA_TITLE_BIG)?.toString()
            ?: ""

        val text = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString()
            ?: extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString()
            ?: ""

        val subText = extras.getCharSequence(Notification.EXTRA_SUB_TEXT)?.toString()
        val category = notification.category

        val extrasMap = mutableMapOf<String, String>()
        for (key in extras.keySet()) {
            extrasMap[key] = extras.get(key)?.toString() ?: "null"
        }

        val captured = CapturedNotification(
            id = "${packageName}_${sbn.id}_${sbn.postTime}",
            packageName = packageName,
            notificationId = sbn.id,
            tag = sbn.tag,
            postTime = sbn.postTime,
            title = title,
            text = text,
            subText = subText,
            category = category,
            extras = extrasMap
        )

        NotificationCapture.addNotification(captured)

        // 2. Filtro estricto para movimientos bancarios: Ignora WhatsApp, Instagram, etc.
        if (!ALLOWED_PACKAGES.contains(packageName)) {
            return
        }

        // 3. Parsear y persistir en Room SQLite
        val parsedTransaction = NotificationParser.parse(packageName, title, text, sbn.postTime)
        if (parsedTransaction != null) {
            val hash = calculateHash("$packageName|${sbn.id}|${sbn.postTime}|$title|$text")
            serviceScope.launch {
                val inserted = repository.saveTransaction(parsedTransaction, hash)
                if (inserted) {
                    Log.i(TAG, "Movimiento guardado con éxito: ${parsedTransaction.description} (${parsedTransaction.amount} ${parsedTransaction.currency})")
                } else {
                    Log.d(TAG, "Movimiento duplicado ignorado: $hash")
                }
            }
        }
    }

    private fun calculateHash(input: String): String {
        val bytes = MessageDigest.getInstance("SHA-256").digest(input.toByteArray())
        return bytes.joinToString("") { "%02x".format(it) }
    }
}

