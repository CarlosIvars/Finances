package com.carlosivars.financias.sync

import android.content.Context
import android.util.Log
import com.carlosivars.financias.data.AppDatabase
import com.carlosivars.financias.data.SecurePreferencesManager
import com.carlosivars.financias.data.TransactionEntity
import com.carlosivars.financias.model.Category
import com.carlosivars.financias.model.Transaction
import com.carlosivars.financias.model.TransactionSource
import com.carlosivars.financias.model.TransactionType
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

data class SyncResult(
    val success: Boolean,
    val pushedCount: Int = 0,
    val pulledCount: Int = 0,
    val message: String
)

class SyncManager(private val context: Context) {

    companion object {
        private const val TAG = "FinancIAsSync"
        private val _activeConflict = MutableStateFlow<MobileSyncConflict?>(null)
        val activeConflict: StateFlow<MobileSyncConflict?> = _activeConflict.asStateFlow()

        fun clearConflict() {
            _activeConflict.value = null
        }
    }

    private val db = AppDatabase.getDatabase(context)
    private val transactionDao = db.transactionDao()
    private val categoryDao = db.categoryDao()
    private val budgetDao = db.budgetDao()
    private val securePrefs = SecurePreferencesManager(context)

    suspend fun countPendingSync(): Int = withContext(Dispatchers.IO) {
        transactionDao.countPendingSync()
    }

    /**
     * Ejecuta una sincronización completa bidireccional (Push de locales pendientes + Pull de remotos).
     */
    suspend fun performFullSync(): SyncResult = withContext(Dispatchers.IO) {
        val serverUrl = securePrefs.cloudServerUrl.trim()
        val authToken = securePrefs.cloudAuthToken.trim()

        if (serverUrl.isBlank()) {
            return@withContext SyncResult(
                success = false,
                message = "URL del servidor no configurada. Configure la URL en Ajustes."
            )
        }

        val baseUrl = normalizeBaseUrl(serverUrl)

        try {
            // 0. Asegurarse de que transacciones sin serverId estén marcadas como pendientes
            //    (fix para transacciones creadas antes de que pendingSync tuviera default=true)
            transactionDao.markAllUnsyncedAsPending()

            // 1. PUSH: Enviar cambios locales al servidor
            val pushedCount = pushPendingTransactions(baseUrl, authToken)

            // 2. PULL: Descargar transacciones nuevas o modificadas desde el servidor
            val pulledCount = pullRemoteTransactions(baseUrl, authToken)

            // 3. Actualizar timestamp de última sincronización
            securePrefs.lastSyncTimestamp = System.currentTimeMillis()

            SyncResult(
                success = true,
                pushedCount = pushedCount,
                pulledCount = pulledCount,
                message = "Sincronización completada: $pushedCount enviados, $pulledCount recibidos."
            )
        } catch (e: Exception) {
            Log.e(TAG, "Error durante la sincronización: ${e.message}", e)
            SyncResult(
                success = false,
                message = "Error en la sincronización: ${e.localizedMessage ?: "Fallo de conexión"}"
            )
        }
    }

    /**
     * Ejecuta un Hard Push/Sobrescritura total desde la Web hacia la App móvil.
     * Limpia la base de datos local de transacciones para eliminar cualquier residuo o inconsistencia
     * y descarga todo el catálogo limpio y actualizado directamente desde el servidor web.
     */
    suspend fun performHardSyncFromWeb(): SyncResult = withContext(Dispatchers.IO) {
        val serverUrl = securePrefs.cloudServerUrl.trim()
        val authToken = securePrefs.cloudAuthToken.trim()

        if (serverUrl.isBlank()) {
            return@withContext SyncResult(
                success = false,
                message = "URL del servidor no configurada. Configure la URL en Ajustes."
            )
        }

        val baseUrl = normalizeBaseUrl(serverUrl)

        try {
            // 1. Limpiar completamente la base de datos local de transacciones
            transactionDao.clearAll()

            // 2. Resetear el timestamp de última sincronización a 0 para forzar pull completo (since = null)
            securePrefs.lastSyncTimestamp = 0L

            // 3. Descargar todas las transacciones, categorías y presupuestos desde el servidor
            val pulledCount = pullRemoteTransactions(baseUrl, authToken)

            // 4. Actualizar timestamp de última sincronización
            securePrefs.lastSyncTimestamp = System.currentTimeMillis()

            SyncResult(
                success = true,
                pushedCount = 0,
                pulledCount = pulledCount,
                message = "Hard Push completado: $pulledCount transacciones descargadas limpiamente desde la web."
            )
        } catch (e: Exception) {
            Log.e(TAG, "Error durante el hard sync: ${e.message}", e)
            SyncResult(
                success = false,
                message = "Error en Hard Push: ${e.localizedMessage ?: "Fallo de conexión"}"
            )
        }
    }

    private suspend fun pushPendingTransactions(baseUrl: String, authToken: String): Int {
        val pendingEntities = transactionDao.getPendingSyncTransactions()
        val pendingDeleted = transactionDao.getPendingDeletedTransactions()

        if (pendingEntities.isEmpty() && pendingDeleted.isEmpty()) return 0

        val pushUrl = "$baseUrl/api/sync/push/"
        val requestBody = JSONObject()
        val txArray = JSONArray()

        val dateFormat = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())

        for (item in pendingEntities) {
            val obj = JSONObject()
            obj.put("local_id", item.id)
            obj.put("client_id", item.id)
            if (item.serverId != null) {
                obj.put("server_id", item.serverId)
            }
            val isoDate = try {
                dateFormat.format(Date(item.timestamp))
            } catch (_: Exception) {
                dateFormat.format(Date())
            }
            obj.put("date", isoDate)
            obj.put("description", item.description)
            obj.put("amount", if (item.type == "INCOME") item.amount else -item.amount)
            obj.put("type", if (item.type == "INCOME") "income" else "expense")
            // Category IDs, not labels, preserve the web catalogue's identity and hierarchy.
            val categoryId = item.categoryServerId ?: categoryDao.findServerIdByName(item.category)
            if (categoryId != null) obj.put("category_id", categoryId)

            if (!item.metadataJson.isNullOrBlank() && item.metadataJson != "{}") {
                try {
                    obj.put("metadata", JSONObject(item.metadataJson))
                } catch (_: Exception) {}
            }
            if (!item.rawText.isNullOrBlank()) {
                val rawObj = JSONObject()
                rawObj.put("text", item.rawText)
                obj.put("raw_data", rawObj)
            }

            txArray.put(obj)
        }
        requestBody.put("transactions", txArray)

        // Enviar identificadores de transacciones eliminadas en el cliente
        val deletedIdsArray = JSONArray()
        val deletedClientIdsArray = JSONArray()
        for (d in pendingDeleted) {
            if (d.serverId != null) {
                deletedIdsArray.put(d.serverId)
            }
            deletedClientIdsArray.put(d.id)
        }
        requestBody.put("deleted_ids", deletedIdsArray)
        requestBody.put("deleted_client_ids", deletedClientIdsArray)

        val responseJson = postJson(pushUrl, requestBody.toString(), authToken)
        val createdArray = responseJson.optJSONArray("created") ?: JSONArray()
        var pushedSuccess = 0

        for (i in 0 until createdArray.length()) {
            val item = createdArray.getJSONObject(i)
            val localId = item.optString("local_id")
            val serverId = item.optInt("server_id", -1)
            if (localId.isNotEmpty() && serverId != -1) {
                transactionDao.markAsSynced(localId, serverId)
                pushedSuccess++
            }
        }

        // Purgar localmente las transacciones eliminadas que han sido confirmadas por el servidor
        for (d in pendingDeleted) {
            transactionDao.markDeletedAsSynced(d.id)
        }

        return pushedSuccess
    }

    private suspend fun pullRemoteTransactions(baseUrl: String, authToken: String): Int {
        val pullUrl = "$baseUrl/api/sync/pull/"
        val requestBody = JSONObject()

        val lastSync = securePrefs.lastSyncTimestamp
        if (lastSync > 0) {
            val isoFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).apply {
                timeZone = java.util.TimeZone.getTimeZone("UTC")
            }
            // Subtract a 60-second safety window to protect against clock drift
            val safeLastSync = maxOf(0L, lastSync - 60_000L)
            requestBody.put("since", isoFormat.format(Date(safeLastSync)))
        } else {
            requestBody.put("since", JSONObject.NULL)
        }

        val responseJson = postJson(pullUrl, requestBody.toString(), authToken)
        val txArray = responseJson.optJSONArray("transactions") ?: JSONArray()
        val categoriesArray = responseJson.optJSONArray("categories") ?: JSONArray()
        val serverCategories = buildList {
            for (i in 0 until categoriesArray.length()) {
                val item = categoriesArray.getJSONObject(i)
                add(com.carlosivars.financias.data.CategoryEntity(
                    serverId = item.getInt("id"),
                    name = item.getString("name"),
                    parentServerId = if (item.isNull("parent_id")) null else item.optInt("parent_id"),
                    parentName = if (item.isNull("parent_name")) null else item.optString("parent_name"),
                    colorHex = item.optString("color", "#cccccc"),
                    icon = item.optString("icon", "credit_card"),
                    isIncome = item.optBoolean("is_income", false)
                ))
            }
        }
        // The endpoint returns the complete catalogue, therefore replacement also propagates deletions.
        categoryDao.replaceAll(serverCategories)

        // Sync budgets from server
        val budgetsArray = responseJson.optJSONArray("budgets") ?: JSONArray()
        val serverBudgets = buildList {
            for (i in 0 until budgetsArray.length()) {
                val item = budgetsArray.getJSONObject(i)
                val catId = item.optString("category_id")
                val catName = item.optString("category_name")
                val amount = item.optDouble("amount", 0.0)
                val color = item.optString("color", "#10B981")
                if (catId.isNotEmpty() && catName.isNotEmpty() && amount > 0) {
                    add(
                        com.carlosivars.financias.data.BudgetEntity(
                            categoryId = catId,
                            categoryName = catName,
                            monthlyLimit = amount,
                            colorHex = color
                        )
                    )
                }
            }
        }
        if (serverBudgets.isNotEmpty()) {
            budgetDao.replaceAll(serverBudgets)
        }

        // Procesar bajas remotas notificadas por el servidor
        val deletedIds = responseJson.optJSONArray("deleted_ids") ?: JSONArray()
        for (i in 0 until deletedIds.length()) {
            val sId = deletedIds.optInt(i, -1)
            if (sId != -1) {
                transactionDao.purgeByServerId(sId)
            }
        }
        val deletedClientIds = responseJson.optJSONArray("deleted_client_ids") ?: JSONArray()
        for (i in 0 until deletedClientIds.length()) {
            val cId = deletedClientIds.optString(i, "")
            if (cId.isNotEmpty()) {
                transactionDao.purgeTransaction(cId)
            }
        }

        var pulledCount = 0

        for (i in 0 until txArray.length()) {
            val item = txArray.getJSONObject(i)
            val serverId = item.getInt("id")
            val clientId = item.optString("client_id", "")
            val isDeleted = item.optBoolean("is_deleted", false)

            if (isDeleted) {
                transactionDao.purgeByServerId(serverId)
                if (clientId.isNotEmpty()) {
                    transactionDao.purgeTransaction(clientId)
                }
                continue
            }

            val desc = item.getString("description")
            val rawAmount = item.getDouble("amount")
            val amount = kotlin.math.abs(rawAmount)
            val type = if (rawAmount >= 0) TransactionType.INCOME else TransactionType.EXPENSE
            val categoryName = item.optString("category_name", "Otros gastos")
            val categoryServerId = if (item.isNull("category")) null else item.optInt("category")
            val dateStr = item.optString("date", "")

            // Buscar por serverId o por clientId inmutable
            var existing = transactionDao.getByServerId(serverId)
            if (existing == null && clientId.isNotEmpty()) {
                existing = transactionDao.getRawTransactionById(clientId)
            }

            if (existing == null) {
                val newLocalId = if (clientId.isNotEmpty()) clientId else "srv_${serverId}_${System.currentTimeMillis()}"
                val hash = "server_sync_$serverId"

                val metaObj = item.optJSONObject("metadata")
                val metaJson = metaObj?.toString() ?: "{}"
                val parentCat = if (item.has("parent_category_name") && !item.isNull("parent_category_name")) {
                    item.getString("parent_category_name")
                } else null
                val rawDataObj = item.optJSONObject("raw_data")
                val rawTxt = rawDataObj?.optString("text", null)

                val entity = TransactionEntity(
                    id = newLocalId,
                    description = desc,
                    amount = amount,
                    currency = "EUR",
                    type = type.name,
                    category = categoryName,
                    categoryServerId = categoryServerId,
                    subCategory = null,
                    parentCategory = parentCat,
                    date = dateStr,
                    timestamp = System.currentTimeMillis(),
                    source = TransactionSource.STATEMENT.name,
                    notificationHash = hash,
                    rawText = rawTxt,
                    metadataJson = metaJson,
                    pendingSync = false,
                    serverId = serverId,
                    isDeleted = false
                )
                transactionDao.insertTransaction(entity)
                pulledCount++
            } else {
                if (existing.pendingSync) {
                    // Detección de colisión: cambios locales y del servidor discrepantes
                    val descDiffer = existing.description.trim().lowercase() != desc.trim().lowercase()
                    val amountDiffer = kotlin.math.abs(existing.amount - amount) > 0.001
                    val catDiffer = categoryServerId != null && existing.categoryServerId != categoryServerId

                    if (descDiffer || amountDiffer || catDiffer) {
                        val conflict = MobileSyncConflict(
                            localTransaction = existing,
                            serverDescription = desc,
                            serverAmount = amount,
                            serverDate = dateStr,
                            serverCategoryName = categoryName,
                            serverCategoryServerId = categoryServerId,
                            serverType = type.name,
                            serverId = serverId
                        )
                        _activeConflict.value = conflict
                        continue
                    }
                } else {
                    // Sin cambios locales pendientes: el servidor es autoritativo, actualizamos local
                    val parentCat = if (item.has("parent_category_name") && !item.isNull("parent_category_name")) {
                        item.getString("parent_category_name")
                    } else existing.parentCategory

                    val updated = existing.copy(
                        description = desc,
                        amount = amount,
                        type = type.name,
                        category = categoryName,
                        categoryServerId = categoryServerId,
                        parentCategory = parentCat,
                        date = dateStr,
                        serverId = serverId,
                        pendingSync = false,
                        isDeleted = false
                    )
                    transactionDao.updateTransaction(updated)
                    pulledCount++
                }
            }
        }
        return pulledCount
    }

    suspend fun resolveConflict(conflict: MobileSyncConflict, keepLocal: Boolean) = withContext(Dispatchers.IO) {
        if (keepLocal) {
            val entity = conflict.localTransaction.copy(pendingSync = true)
            transactionDao.updateTransaction(entity)
        } else {
            val entity = conflict.localTransaction.copy(
                description = conflict.serverDescription,
                amount = conflict.serverAmount,
                date = conflict.serverDate,
                category = conflict.serverCategoryName,
                categoryServerId = conflict.serverCategoryServerId,
                type = conflict.serverType,
                pendingSync = false
            )
            transactionDao.updateTransaction(entity)
        }
        _activeConflict.value = null
    }

    private fun postJson(endpoint: String, jsonString: String, token: String): JSONObject {
        val url = URL(endpoint)
        val conn = url.openConnection() as HttpURLConnection
        conn.requestMethod = "POST"
        conn.setRequestProperty("Content-Type", "application/json; charset=utf-8")
        if (token.isNotBlank()) {
            conn.setRequestProperty("Authorization", "Bearer $token")
        }
        val cfClientId = securePrefs.cloudFlareClientId.trim()
        val cfClientSecret = securePrefs.cloudFlareClientSecret.trim()
        if (cfClientId.isNotBlank() && cfClientSecret.isNotBlank()) {
            conn.setRequestProperty("CF-Access-Client-Id", cfClientId)
            conn.setRequestProperty("CF-Access-Client-Secret", cfClientSecret)
        }
        conn.connectTimeout = 8000
        conn.readTimeout = 10000
        conn.doOutput = true

        OutputStreamWriter(conn.outputStream, "UTF-8").use { writer ->
            writer.write(jsonString)
            writer.flush()
        }

        val code = conn.responseCode
        val stream = if (code in 200..299) conn.inputStream else conn.errorStream
            ?: throw Exception("Error HTTP $code sin contenido.")

        val responseText = BufferedReader(InputStreamReader(stream, "UTF-8")).use { it.readText() }

        if (code !in 200..299) {
            throw Exception("HTTP $code: $responseText")
        }

        return JSONObject(responseText)
    }

    private fun normalizeBaseUrl(url: String): String {
        var res = url.trim().removeSuffix("/")
        if (!res.startsWith("http://") && !res.startsWith("https://")) {
            res = "https://$res"
        }
        // Si el usuario incluyó /api al final, lo normalizamos
        if (res.endsWith("/api")) {
            res = res.removeSuffix("/api")
        }
        return res
    }
}
