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

        // 2.1 Verificar toggles por entidad en ajustes seguros
        val prefs = repository.securePrefs
        val isSabadellPkg = packageName == "net.inverline.bancosabadell.officelocator.android"
        val isWalletPkg = packageName == "com.google.android.apps.walletnfcrel" || packageName == "com.google.android.gms"

        if (isSabadellPkg && !prefs.isSabadellTrackerEnabled) {
            Log.d(TAG, "Notificación de Sabadell ignorada porque el rastreador está desactivado en ajustes.")
            return
        }
        if (isWalletPkg && !prefs.isWalletTrackerEnabled) {
            Log.d(TAG, "Notificación de Wallet ignorada porque el rastreador está desactivado en ajustes.")
            return
        }

        // 3. Parsear y persistir en Room SQLite
        val parsedTransaction = NotificationParser.parse(packageName, title, text, sbn.postTime)
        if (parsedTransaction != null) {
            // Verificar si es un Bizum y el rastreador de Bizum está desactivado
            val isBizum = title.contains("bizum", ignoreCase = true) ||
                    text.contains("bizum", ignoreCase = true) ||
                    parsedTransaction.category.contains("bizum", ignoreCase = true)

            if (isBizum && !prefs.isBizumTrackerEnabled) {
                Log.d(TAG, "Bizum ignorado porque el rastreador de Bizum está desactivado en ajustes.")
                return
            }

            val hash = calculateHash("$packageName|${sbn.id}|${sbn.postTime}|$title|$text")
            serviceScope.launch {
                // Comprobar si la IA puede afinar la categoría si vino como "Otros"
                val finalTransaction = if (parsedTransaction.category == "Otros" && prefs.isAiCategorizationEnabled) {
                    val aiCat = CategoryClassifier.classifyWithAi(
                        merchantOrText = parsedTransaction.description,
                        amount = parsedTransaction.amount,
                        isIncome = parsedTransaction.type == com.carlosivars.financias.model.TransactionType.INCOME,
                        prefs = prefs
                    )
                    parsedTransaction.copy(category = aiCat)
                } else {
                    parsedTransaction
                }

                // Comprobación de deduplicación cross-source (ej. Google Wallet + Banco Sabadell)
                val recentTransactions = repository.getRecentTransactions(TransactionDeduplicator.DEDUP_WINDOW_MS * 2)
                val dedupResult = TransactionDeduplicator.checkDuplicate(finalTransaction, recentTransactions)

                when (dedupResult) {
                    is DeduplicationResult.DuplicateOf -> {
                        Log.w(
                            TAG,
                            "⚠️ Transacción duplicada cross-source ignorada: ${dedupResult.reason} (existente: ${dedupResult.existingTransactionId})"
                        )
                    }
                    is DeduplicationResult.Unique -> {
                        val inserted = repository.saveTransaction(finalTransaction, hash)
                        if (inserted) {
                            Log.i(
                                TAG,
                                "Movimiento guardado con éxito: ${finalTransaction.description} (${finalTransaction.amount} ${finalTransaction.currency}) [${finalTransaction.category}]"
                            )
                        } else {
                            Log.d(TAG, "Movimiento duplicado ignorado por hash exacto: $hash")
                        }
                    }
                }
            }
        }
    }

    private fun calculateHash(input: String): String {
        val bytes = MessageDigest.getInstance("SHA-256").digest(input.toByteArray())
        return bytes.joinToString("") { "%02x".format(it) }
    }
}

