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

data class SyncResult(
    val success: Boolean,
    val pushedCount: Int = 0,
    val pulledCount: Int = 0,
    val message: String
)

class SyncManager(private val context: Context) {

    companion object {
        private const val TAG = "FinancIAsSync"
    }

    private val db = AppDatabase.getDatabase(context)
    private val transactionDao = db.transactionDao()
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

    private suspend fun pushPendingTransactions(baseUrl: String, authToken: String): Int {
        val pendingEntities = transactionDao.getPendingSyncTransactions()
        if (pendingEntities.isEmpty()) return 0

        val pushUrl = "$baseUrl/api/sync/push/"
        val requestBody = JSONObject()
        val txArray = JSONArray()

        val dateFormat = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())

        for (item in pendingEntities) {
            val obj = JSONObject()
            obj.put("local_id", item.id)
            val isoDate = try {
                dateFormat.format(Date(item.timestamp))
            } catch (_: Exception) {
                dateFormat.format(Date())
            }
            obj.put("date", isoDate)
            obj.put("description", item.description)
            obj.put("amount", if (item.type == "INCOME") item.amount else -item.amount)
            obj.put("type", if (item.type == "INCOME") "income" else "expense")

            txArray.put(obj)
        }
        requestBody.put("transactions", txArray)

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

        return pushedSuccess
    }

    private suspend fun pullRemoteTransactions(baseUrl: String, authToken: String): Int {
        val pullUrl = "$baseUrl/api/sync/pull/"
        val requestBody = JSONObject()

        val lastSync = securePrefs.lastSyncTimestamp
        if (lastSync > 0) {
            val isoFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US)
            requestBody.put("since", isoFormat.format(Date(lastSync)))
        } else {
            requestBody.put("since", JSONObject.NULL)
        }

        val responseJson = postJson(pullUrl, requestBody.toString(), authToken)
        val txArray = responseJson.optJSONArray("transactions") ?: JSONArray()
        var pulledCount = 0

        for (i in 0 until txArray.length()) {
            val item = txArray.getJSONObject(i)
            val serverId = item.getInt("id")
            val desc = item.getString("description")
            val rawAmount = item.getDouble("amount")
            val amount = kotlin.math.abs(rawAmount)
            val type = if (rawAmount >= 0) TransactionType.INCOME else TransactionType.EXPENSE
            val categoryName = item.optString("category_name", "Otros")
            val dateStr = item.optString("date", "")

            val existing = transactionDao.getByServerId(serverId)
            if (existing == null) {
                val newLocalId = "srv_${serverId}_${System.currentTimeMillis()}"
                val hash = "server_sync_$serverId"

                val entity = TransactionEntity(
                    id = newLocalId,
                    description = desc,
                    amount = amount,
                    currency = "EUR",
                    type = type.name,
                    category = categoryName,
                    date = dateStr,
                    timestamp = System.currentTimeMillis(),
                    source = TransactionSource.STATEMENT.name,
                    notificationHash = hash,
                    rawText = null,
                    pendingSync = false,
                    serverId = serverId
                )
                transactionDao.insertTransaction(entity)
                pulledCount++
            }
        }

        return pulledCount
    }

    private fun postJson(endpoint: String, jsonString: String, token: String): JSONObject {
        val url = URL(endpoint)
        val conn = url.openConnection() as HttpURLConnection
        conn.requestMethod = "POST"
        conn.setRequestProperty("Content-Type", "application/json; charset=utf-8")
        if (token.isNotBlank()) {
            conn.setRequestProperty("Authorization", "Bearer $token")
        }
        conn.connectTimeout = 6000
        conn.readTimeout = 8000
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
        return res
    }
}

