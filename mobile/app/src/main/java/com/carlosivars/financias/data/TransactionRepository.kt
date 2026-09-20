package com.carlosivars.financias.data

import android.content.Context
import com.carlosivars.financias.model.Category
import com.carlosivars.financias.model.Transaction
import com.carlosivars.financias.model.TransactionSource
import com.carlosivars.financias.model.TransactionType
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.UUID

class TransactionRepository(context: Context) {

    private val db = AppDatabase.getDatabase(context)
    private val transactionDao = db.transactionDao()
    private val budgetDao = db.budgetDao()
    val securePrefs = SecurePreferencesManager(context)
    val syncManager = com.carlosivars.financias.sync.SyncManager(context)

    suspend fun getPendingSyncCount(): Int = syncManager.countPendingSync()

    suspend fun performSync(): com.carlosivars.financias.sync.SyncResult = syncManager.performFullSync()

    val allTransactions: Flow<List<Transaction>> = transactionDao.getAllTransactions().map { entities ->
        entities.map { it.toDomain() }
    }

    val allBudgets: Flow<List<BudgetEntity>> = budgetDao.getAllBudgets()

    suspend fun saveTransaction(transaction: Transaction, notificationHash: String): Boolean {
        val entity = TransactionEntity.fromDomain(transaction, notificationHash)
        val rowId = transactionDao.insertTransaction(entity)
        return rowId != -1L
    }

    suspend fun getRecentTransactions(windowMs: Long = 120_000L): List<Transaction> = withContext(Dispatchers.IO) {
        val since = System.currentTimeMillis() - windowMs
        transactionDao.getTransactionsSince(since).map { it.toDomain() }
    }

    suspend fun addManualTransaction(
        description: String,
        amount: Double,
        type: TransactionType,
        category: String,
        date: String = SimpleDateFormat("dd/MM/yyyy HH:mm", Locale.getDefault()).format(Date())
    ): Boolean {
        val now = System.currentTimeMillis()
        val tx = Transaction(
            id = "manual_${now}_${UUID.randomUUID().toString().take(6)}",
            description = description,
            amount = amount,
            currency = "EUR",
            type = type,
            category = category,
            date = date,
            timestamp = now,
            source = TransactionSource.MANUAL,
            rawNotificationText = null
        )
        val hash = "manual_${tx.id}"
        return saveTransaction(tx, hash)
    }

    suspend fun setBudget(categoryId: String, categoryName: String, limit: Double, colorHex: String) {
        budgetDao.setBudget(
            BudgetEntity(
                categoryId = categoryId,
                categoryName = categoryName,
                monthlyLimit = limit,
                colorHex = colorHex
            )
        )
    }

    suspend fun initDefaultBudgetsIfEmpty() {
        val current = budgetDao.getAllBudgets().first()
        if (current.isEmpty()) {
            val defaults = listOf(
                BudgetEntity("food", "Alimentación", 350.0, "#10B981"),
                BudgetEntity("leisure", "Ocio & Restauración", 150.0, "#F59E0B"),
                BudgetEntity("transport", "Transporte", 100.0, "#3B82F6"),
                BudgetEntity("housing", "Hogar & Servicios", 200.0, "#8B5CF6"),
                BudgetEntity("subscriptions", "Suscripciones", 40.0, "#6366F1")
            )
            for (b in defaults) {
                budgetDao.setBudget(b)
            }
        }
    }

    suspend fun updateCategory(id: String, newCategory: String): Boolean = withContext(Dispatchers.IO) {
        val rows = transactionDao.updateCategory(id, newCategory)
        rows > 0
    }

    suspend fun deleteTransaction(id: String) {
        transactionDao.deleteTransaction(id)
    }

    suspend fun clearAll() {
        transactionDao.clearAll()
    }

    // Exportar Backup en JSON
    suspend fun exportBackupJson(): String = withContext(Dispatchers.IO) {
        val txList = allTransactions.first()
        val budgetList = allBudgets.first()

        val root = JSONObject()
        root.put("version", 1)
        root.put("exportDate", SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault()).format(Date()))
        root.put("app", "FinancIAs")

        val txArray = JSONArray()
        for (tx in txList) {
            val obj = JSONObject()
            obj.put("id", tx.id)
            obj.put("description", tx.description)
            obj.put("amount", tx.amount)
            obj.put("currency", tx.currency)
            obj.put("type", tx.type.name)
            obj.put("category", tx.category)
            obj.put("date", tx.date)
            obj.put("timestamp", tx.timestamp)
            obj.put("source", tx.source.name)
            txArray.put(obj)
        }
        root.put("transactions", txArray)

        val budgetArray = JSONArray()
        for (b in budgetList) {
            val obj = JSONObject()
            obj.put("categoryId", b.categoryId)
            obj.put("categoryName", b.categoryName)
            obj.put("monthlyLimit", b.monthlyLimit)
            obj.put("colorHex", b.colorHex)
            budgetArray.put(obj)
        }
        root.put("budgets", budgetArray)

        root.toString(2)
    }

    // Restaurar Backup desde JSON
    suspend fun restoreBackupJson(jsonString: String): Result<Int> = withContext(Dispatchers.IO) {
        try {
            val root = JSONObject(jsonString)
            val txArray = root.getJSONArray("transactions")
            var count = 0

            for (i in 0 until txArray.length()) {
                val obj = txArray.getJSONObject(i)
                val tx = Transaction(
                    id = obj.getString("id"),
                    description = obj.getString("description"),
                    amount = obj.getDouble("amount"),
                    currency = obj.optString("currency", "EUR"),
                    type = TransactionType.valueOf(obj.getString("type")),
                    category = obj.getString("category"),
                    date = obj.getString("date"),
                    timestamp = obj.getLong("timestamp"),
                    source = TransactionSource.valueOf(obj.optString("source", TransactionSource.MANUAL.name)),
                    rawNotificationText = null
                )
                val hash = "restore_${tx.id}"
                if (saveTransaction(tx, hash)) {
                    count++
                }
            }

            if (root.has("budgets")) {
                val bArray = root.getJSONArray("budgets")
                for (i in 0 until bArray.length()) {
                    val bObj = bArray.getJSONObject(i)
                    budgetDao.setBudget(
                        BudgetEntity(
                            categoryId = bObj.getString("categoryId"),
                            categoryName = bObj.getString("categoryName"),
                            monthlyLimit = bObj.getDouble("monthlyLimit"),
                            colorHex = bObj.getString("colorHex")
                        )
                    )
                }
            }

            Result.success(count)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    // Comprobar conectividad con el servidor Cloud
    suspend fun testCloudConnection(serverUrl: String, authToken: String): Pair<Boolean, String> = withContext(Dispatchers.IO) {
        if (serverUrl.isBlank()) {
            return@withContext Pair(false, "La URL del servidor no puede estar vacía.")
        }

        try {
            val cleanUrl = if (!serverUrl.startsWith("http://") && !serverUrl.startsWith("https://")) {
                "https://$serverUrl"
            } else {
                serverUrl
            }

            val url = URL(cleanUrl)
            val conn = url.openConnection() as HttpURLConnection
            conn.connectTimeout = 4000
            conn.readTimeout = 4000
            conn.requestMethod = "GET"
            if (authToken.isNotBlank()) {
                conn.setRequestProperty("Authorization", "Bearer $authToken")
            }

            val responseCode = conn.responseCode
            if (responseCode in 200..399 || responseCode == 401 || responseCode == 403) {
                // El servidor existe y responde (401/403 indica que requiere token válido)
                Pair(true, "Servidor detectado correctamente (HTTP $responseCode).")
            } else {
                Pair(false, "El servidor respondió con error HTTP $responseCode.")
            }
        } catch (e: Exception) {
            Pair(false, "No se pudo conectar: ${e.localizedMessage ?: "Tiempo de espera agotado"}")
        }
    }
}
