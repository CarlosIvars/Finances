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

        fun isBankingOrWalletPackage(pkg: String): Boolean {
            return com.carlosivars.financias.model.SupportedBankApp.isAnySupported(pkg)
        }
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
        val prefs = repository.securePrefs

        // 1. Filtrar únicamente las apps seleccionadas en el gestor de colección de apps
        if (!prefs.isPackageMonitored(packageName)) {
            return
        }

        // 2. Registrar en el capturador en vivo exclusivamente para las apps seleccionadas
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

        // 2.1 Verificar toggles específicos por entidad si existieran
        val isSabadellPkg = packageName.contains("sabadell", ignoreCase = true) || packageName.contains("inverline", ignoreCase = true)
        val isWalletPkg = packageName.contains("wallet", ignoreCase = true) || packageName == "com.google.android.gms"

        if (isSabadellPkg && !prefs.isSabadellTrackerEnabled) {
            Log.d(TAG, "Notificación de Sabadell ignorada porque el rastreador específico está desactivado.")
            return
        }
        if (isWalletPkg && !prefs.isWalletTrackerEnabled) {
            Log.d(TAG, "Notificación de Wallet ignorada porque el rastreador específico está desactivado.")
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
                // Comprobar si la IA puede afinar la categoría por defecto.
                val finalTransaction = if (parsedTransaction.category == "Otros gastos" && prefs.isAiCategorizationEnabled) {
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
